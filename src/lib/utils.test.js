import { describe, it, expect } from "vitest";
import {
  autoCategory, suggestMatchKey, applyMerchantRules, parseClpNumber,
  parseBankDate, makeKey, formatCLP, formatDateDisplay, monthKey, nextMonthKey, uid,
  formatDayHeading, groupByDate,
} from "./utils.js";

describe("parseClpNumber", () => {
  it("parsea formato chileno con puntos de miles y coma decimal", () => {
    expect(parseClpNumber("1.234,56")).toBeCloseTo(1234.56);
  });
  it("parsea con símbolo de peso y espacios", () => {
    expect(parseClpNumber("$ 12.500")).toBe(12500);
  });
  it("devuelve el número tal cual si ya es number", () => {
    expect(parseClpNumber(500)).toBe(500);
  });
  it("devuelve 0 para vacío, null o undefined", () => {
    expect(parseClpNumber("")).toBe(0);
    expect(parseClpNumber(null)).toBe(0);
    expect(parseClpNumber(undefined)).toBe(0);
  });
  it("devuelve 0 si no se puede parsear", () => {
    expect(parseClpNumber("no es un número")).toBe(0);
  });
});

describe("parseBankDate", () => {
  it("convierte una fecha serial de Excel a ISO", () => {
    // 45000 = 2023-03-15 en el epoch de Excel (1899-12-30)
    expect(parseBankDate(45000)).toBe("2023-03-15");
  });
  it("convierte dd-mm-yyyy a yyyy-mm-dd", () => {
    expect(parseBankDate("15-03-2023")).toBe("2023-03-15");
  });
  it("convierte dd/mm/yyyy a yyyy-mm-dd", () => {
    expect(parseBankDate("05/01/2024")).toBe("2024-01-05");
  });
  it("deja pasar una fecha que ya viene en ISO", () => {
    expect(parseBankDate("2024-01-05")).toBe("2024-01-05");
  });
  it("devuelve null para un string que no es fecha", () => {
    expect(parseBankDate("Saldo inicial")).toBeNull();
    expect(parseBankDate("")).toBeNull();
  });
  it("devuelve null para un serial de Excel inválido", () => {
    expect(parseBankDate(0)).toBeNull();
    expect(parseBankDate(-5)).toBeNull();
    expect(parseBankDate(NaN)).toBeNull();
  });
});

describe("formatCLP", () => {
  it("formatea con separador de miles y símbolo de peso", () => {
    expect(formatCLP(1234567)).toBe("$1.234.567");
  });
  it("antepone el signo para negativos, después del símbolo se ve el valor absoluto", () => {
    expect(formatCLP(-12500)).toBe("-$12.500");
  });
  it("redondea decimales", () => {
    expect(formatCLP(999.6)).toBe("$1.000");
  });
  it("formatea cero", () => {
    expect(formatCLP(0)).toBe("$0");
  });
});

describe("formatDateDisplay", () => {
  it("convierte yyyy-mm-dd a dd-mm-yyyy", () => {
    expect(formatDateDisplay("2026-07-28")).toBe("28-07-2026");
  });
  it("devuelve vacío para input vacío", () => {
    expect(formatDateDisplay("")).toBe("");
    expect(formatDateDisplay(null)).toBe("");
  });
});

describe("monthKey", () => {
  it("extrae yyyy-mm de una fecha ISO", () => {
    expect(monthKey("2026-07-28")).toBe("2026-07");
  });
  it("devuelve vacío si no hay fecha", () => {
    expect(monthKey("")).toBe("");
  });
});

describe("nextMonthKey", () => {
  it("avanza al mes siguiente dentro del mismo año", () => {
    expect(nextMonthKey("2026-07")).toBe("2026-08");
  });
  it("cruza de diciembre a enero del año siguiente", () => {
    expect(nextMonthKey("2025-12")).toBe("2026-01");
  });
});

describe("makeKey", () => {
  it("normaliza espacios y mayúsculas en la descripción", () => {
    expect(makeKey("2026-07-28", "  uber   eats  ", 12500, 0))
      .toBe("2026-07-28|UBER EATS|12500|0");
  });
});

describe("autoCategory", () => {
  it("reconoce comercios de comida", () => {
    expect(autoCategory("UBER EATS SANTIAGO CHL")).toBe("comida");
  });
  it("reconoce suscripciones", () => {
    expect(autoCategory("NETFLIX.COM")).toBe("suscripciones");
  });
  it("reconoce ingresos por Assertiva sin importar el resto del texto", () => {
    expect(autoCategory("ASSERTIVA SPA PAGO NOMINA")).toBe("ingreso");
  });
  it("reconoce transferencias por prefijo", () => {
    expect(autoCategory("TRANSF A JUAN PEREZ")).toBe("transferencias");
  });
  it("cae en 'otros' si no coincide nada", () => {
    expect(autoCategory("COMERCIO DESCONOCIDO XYZ")).toBe("otros");
  });
});

describe("suggestMatchKey", () => {
  it("quita códigos de país y ciudad al final", () => {
    expect(suggestMatchKey("UBER EATS SANTIAGO CHL")).toBe("UBER EATS");
  });
  it("quita ruido numérico y fechas al final", () => {
    expect(suggestMatchKey("FARMACIA NETFLIX.COM 12345 2024-01-05")).toBe("FARMACIA NETFLIX.COM");
  });
  it("nunca deja menos de 2 tokens", () => {
    expect(suggestMatchKey("CHL 0")).toBe("CHL 0");
  });
  it("no toca tokens que no son ruido", () => {
    expect(suggestMatchKey("FARMACIA CRUZ VERDE")).toBe("FARMACIA CRUZ VERDE");
  });
});

describe("applyMerchantRules", () => {
  const rules = [
    { id: "1", matchText: "UBER", categoryId: "transporte", alias: "" },
    { id: "2", matchText: "UBER EATS", categoryId: "comida", alias: "Delivery" },
  ];
  it("elige la regla más específica (match más largo) cuando varias coinciden", () => {
    const match = applyMerchantRules("UBER EATS SANTIAGO", rules);
    expect(match.categoryId).toBe("comida");
  });
  it("es case-insensitive", () => {
    const match = applyMerchantRules("uber eats santiago", rules);
    expect(match.categoryId).toBe("comida");
  });
  it("devuelve null si ninguna regla coincide", () => {
    expect(applyMerchantRules("FARMACIA AHUMADA", rules)).toBeNull();
  });
});

describe("formatDayHeading", () => {
  const today = new Date(2026, 7, 3); // 3 de agosto de 2026 (lunes)
  it("devuelve 'Hoy' para la fecha de referencia", () => {
    expect(formatDayHeading("2026-08-03", today)).toBe("Hoy");
  });
  it("devuelve 'Ayer' para el día anterior", () => {
    expect(formatDayHeading("2026-08-02", today)).toBe("Ayer");
  });
  it("devuelve 'día de la semana, día de mes' para el resto", () => {
    expect(formatDayHeading("2026-07-28", today)).toBe("Martes, 28 de julio");
  });
  it("cruza correctamente el límite de mes/año al calcular 'ayer'", () => {
    expect(formatDayHeading("2025-12-31", new Date(2026, 0, 1))).toBe("Ayer");
  });
  it("devuelve vacío para input vacío", () => {
    expect(formatDayHeading("", today)).toBe("");
  });
});

describe("groupByDate", () => {
  it("agrupa transacciones consecutivas del mismo día", () => {
    const tx = [
      { id: "1", date: "2026-08-03" },
      { id: "2", date: "2026-08-03" },
      { id: "3", date: "2026-08-02" },
    ];
    const groups = groupByDate(tx);
    expect(groups).toEqual([
      { date: "2026-08-03", items: [tx[0], tx[1]] },
      { date: "2026-08-02", items: [tx[2]] },
    ]);
  });
  it("mantiene el orden de primera aparición de cada fecha", () => {
    const tx = [
      { id: "1", date: "2026-08-01" },
      { id: "2", date: "2026-08-02" },
      { id: "3", date: "2026-08-01" },
    ];
    const groups = groupByDate(tx);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-01", "2026-08-02"]);
    expect(groups[0].items).toEqual([tx[0], tx[2]]);
  });
  it("devuelve un array vacío para una lista vacía", () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe("uid", () => {
  it("genera un string no vacío", () => {
    const id = uid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
  it("genera valores distintos en llamadas sucesivas", () => {
    expect(uid()).not.toBe(uid());
  });
});
