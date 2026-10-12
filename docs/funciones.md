# Qué hace Gastify

> Parte de la documentación de Gastify — volver al [README](../README.md).

**Movimientos (cuenta corriente)**
- Importa el `.xls` del banco o la cartola mensual en `.pdf`, arrastrándolos
  o desde un modal, con barra de progreso real. Detecta y omite duplicados
  aunque subas el `.xls` y el `.pdf` del mismo período, y concilia el saldo
  automáticamente con el del archivo más reciente.
- Carga manual de gastos e ingresos que aún no aparecen en el banco: monto
  primero con formato CLP en vivo, categoría y fecha con atajos "Hoy"/"Ayer".
  Arriba aparecen tus "frecuentes" (lo que anotas a mano seguido, como el
  almuerzo o el Uber) para completarlos con un toque, y cualquier movimiento
  se puede **duplicar** desde su editor.
- Lista agrupada por día ("Hoy", "Ayer", "Lunes, 3 de agosto"), con lo gastado
  y lo que entró ese día en cada encabezado. En mobile:
  tocar edita, deslizar muestra editar/borrar y mantener presionado entra al
  modo selección. En desktop: edición en la misma fila.
- Selección múltiple con barra de acciones masivas para recategorizar o
  borrar varios movimientos a la vez.
- Borrar es inmediato y siempre se puede **deshacer** desde el aviso que
  aparece (el movimiento vuelve tal cual estaba).
- Búsqueda y filtros por categoría, tipo (ingreso/gasto), origen
  (manual/banco) y rango de monto; aviso de posibles duplicados entre un manual y uno del banco.
- Exportación a `.csv` y respaldo completo a `.json`.

**Tarjeta de crédito (CMR)**
- Importa el Excel de "Movimientos Facturados" por ciclo, con cuotas
  pendientes y monto total de cada compra (una compra en cuotas no se pierde
  al reaparecer en la cartola del mes siguiente).
- Importa el PDF del Estado de Cuenta para mostrar cupo, total a pagar y
  fecha límite. Separada de la cuenta corriente para no contar dos veces el
  mismo gasto (el pago de la tarjeta ya aparece como cargo en débito).

**Categorías**
- Categorías editables (nombre, ícono, color, presupuesto mensual) y una
  "memoria de comercio": puedes indicar que una descripción como
  `GOOGLE PLAY...` corresponde a "Claude", y la app recuerda esa regla para
  futuras importaciones (y corrige retroactivamente las que ya coincidían).
- Pantalla de **reglas de comercio** (pestaña Categorías): cada regla compara
  la descripción con "contiene", "empieza con", "termina con", "es
  exactamente" o una expresión regular, y puede exigir un rango de monto
  (ej. "transferencia a Juan por $450.000 = Arriendo"). Al guardarla muestra
  qué movimientos ya cargados cambiarían y deja aplicarla con un toque.
- Cada categoría es de gasto o de ingreso, y los selectores solo sugieren las
  del tipo que corresponde según el monto.
- Al importar, las transferencias que salen van a "Transferencias a
  terceros" (cuentan como gasto), las que entran a "Ingresos", y el pago de la
  tarjeta a "Pago de tarjeta" (ahí se cuenta lo gastado con ella). Las de tus
  propias cuentas se marcan con una regla con tu nombre ("Agrega tu nombre" en
  la pantalla de reglas) y van a "Transferencias personales".
- Interruptor "cuenta como gasto" para transferencias entre tus propias
  cuentas: salen de la cuenta corriente pero no son consumo real, así que se
  excluyen de todos los cálculos sin dejar de aparecer en la lista.
- Una categoría puede sumar a un "Total ahorrado" aparte en Resumen (ej.
  traspasos a tu cuenta de ahorro), con un monto inicial ajustable.

**Suscripciones**
- Declaras cada cobro recurrente ("Netflix, $9.990, día 19"), mensual o
  anual (ej. un dominio que se paga cada marzo) y con fecha de término
  opcional, o marcas un movimiento existente como suscripción; la app genera el movimiento
  pendiente el día del cobro y lo concilia con el cargo real del banco.

**Resumen** (siempre de un mes concreto)
- Saldo actual (último saldo del banco + manuales cargados después) y
  tarjetas de ingresos, gastos (con comparación contra el mismo tramo de días
  del mes anterior), balance con tasa de ahorro y total ahorrado.
- **Gasto por día**: calendario del mes con lo gastado cada día (más oscuro =
  más gasto); al tocar un día se ven sus movimientos.
- **Saldo de la cuenta**: cómo evolucionó el saldo en los últimos 3, 6 o 12
  meses, según las cartolas importadas.
- Proyección del gasto a fin de mes: lo gastado hasta hoy más lo que el mes
  anterior gastó desde este mismo día en adelante (así el arriendo no se
  proyecta 30 veces).
- Insights en texto: variación del gasto vs. el mes pasado y la categoría
  que más subió.
- Donas de gasto e ingreso por categoría (tocar una abre sus movimientos),
  barras de los últimos 6 meses, presupuestos por categoría y un mapa de
  actividad diaria del último año (tocar un día muestra cuánto gastaste).
- Paleta de colores validada para daltonismo y contraste en ambos temas.
- Exportación del dashboard como imagen PNG.

**Conciliación**
- Compara los movimientos manuales contra el reporte del banco (mismo monto;
  fecha del banco hasta 5 días después de la manual o 2 antes, por la "fecha
  contable") y los fusiona: el del banco queda como oficial y hereda la
  categoría que le pusiste. Separa lo confirmado, lo que aún no tiene
  reporte importado y lo que no calza, con vínculo manual para los casos
  raros.

**General**
- Cuenta con email/contraseña (confirmación por correo) y recuperación de
  contraseña.
- Modo claro/oscuro con detección de la preferencia del sistema.
- Instalable como PWA, con soporte offline y actualización automática.
- Pensada primero para el teléfono: zonas táctiles amplias, hojas que suben
  desde abajo, sin zoom al escribir, respeta el notch.
- Onboarding de 3 pasos y ayuda integrada.
