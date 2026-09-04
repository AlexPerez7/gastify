import { parseClpNumber, parseBankDate } from "./utils.js";

// Extrae las filas de "Movimientos Facturados" del Excel mensual que exporta
// CMR Falabella. A diferencia del .xls de la cuenta corriente, este formato
// no trae saldo corrido — cada fila es un cargo/abono de este ciclo, y las
// columnas se mapean por NOMBRE de encabezado (no por posición fija), para
// que una reordenación futura del export no rompa el import en silencio.
export async function parseCreditCardRows(buf) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets["Movimientos Facturados"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const headerIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toUpperCase() === "FECHA"));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => String(c).trim().toUpperCase());
  const col = (name) => header.indexOf(name);
  const idx = {
    fecha: col("FECHA"),
    desc: col("DESCRIPCION"),
    titular: col("TITULAR/ADICIONAL"),
    // en el export real la columna viene con un espacio inicial (" MONTO"),
    // así que se compara sin espacios en vez de buscar el string exacto.
    monto: header.findIndex((c) => c.replace(/\s/g, "") === "MONTO"),
    cuotasPend: col("CUOTAS PENDIENTES"),
    valorCuota: col("VALOR CUOTA"),
  };

  return rows
    .slice(headerIdx + 1)
    .filter((r) => r[idx.fecha] && String(r[idx.fecha]).trim() !== "")
    .map((r) => ({
      date: parseBankDate(r[idx.fecha]),
      description: String(r[idx.desc] ?? "").trim().replace(/\s+/g, " "),
      holder: idx.titular >= 0 ? String(r[idx.titular] ?? "").trim() : "",
      montoTotal: parseClpNumber(r[idx.monto]),
      cuotasPendientes: parseInt(r[idx.cuotasPend], 10) || 0,
      valorCuota: parseClpNumber(r[idx.valorCuota]),
    }))
    // "PAGO TARJETA CMR" es una línea de sistema fija que liquida la deuda
    // del PERÍODO ANTERIOR (confirmado contra el Estado de Cuenta PDF: ahí
    // figura con "Monto Total a Pagar = 0", ya contabilizada en la sección
    // "Período Anterior"), no un movimiento de este ciclo. El Excel la
    // mezcla igual entre las demás filas con su monto completo — sumarla
    // resta de más y desajusta el total contra lo que realmente factura
    // Falabella. El pago real ya se ve, aparte, como un cargo en la cartola
    // de débito (fuera de esta tabla por diseño).
    .filter((r) => !r.description.toUpperCase().includes("PAGO TARJETA"))
    // fila con fecha ilegible: se descarta (parseBankDate devuelve null) para
    // no contaminar statementMonth ni makeCreditKey con un valor inválido.
    .filter((r) => r.date);
}
