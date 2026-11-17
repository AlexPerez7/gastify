# Revisión funcional — 17 de noviembre de 2026

Revisión del código de importación, conciliación, suscripciones, saldos,
persistencia, categorías, autenticación, exportación y formularios. Las
regresiones se comprobaron con datos ficticios y fallos de red simulados;
no se modificaron directamente los movimientos de ninguna cuenta.

## Problemas corregidos

| Prioridad | Problema reproducido | Corrección |
| --- | --- | --- |
| Alta | Conciliar elegía el primer banco del mismo monto/fecha aunque hubiera varios candidatos; podía borrar el manual y reclasificar el pago equivocado. | Solo concilia parejas únicas en ambas direcciones. Los casos ambiguos permanecen pendientes. |
| Alta | La vinculación explícita con un banco sin confirmar admitía otro monto o incluso el signo contrario. | Exige el mismo monto con signo y filtra el selector con esa condición. |
| Alta | Una carga fallida de movimientos podía terminar con suscripciones disponibles y activar su generación contra una lista vacía. | La automatización espera la carga completa. Si falla el inicio, se bloquea la edición y se ofrece reintentar. |
| Alta | El «respaldo completo» solo contenía débito y categorías. | Exporta también crédito, estados de cuenta, reglas, suscripciones y ajustes de saldo/ahorro, con versión de formato. Una lectura fallida cancela la descarga. |
| Alta | Un error al leer ajustes se interpretaba como cuenta sin saldo; una lectura antigua podía pisar un ajuste reciente. | Conserva el último valor conocido, distingue errores y descarta lecturas anteriores a cambios locales. Los ajustes manuales se contabilizan como guardados pendientes. |
| Media | El formulario de alta se cerraba aunque fallara el guardado y admitía envíos repetidos mientras esperaba. | Conserva el formulario y sus datos, muestra el error y permite reintentar. Bloquea el doble envío. |
| Media | El parser aceptaba fechas imposibles como 31 de febrero, que podían hacer fallar una importación completa. | Valida día, mes y año, incluidos los años bisiestos. |
| Media | Un cambio de sesión entre usuarios podía reutilizar la misma instancia de App y sus datos en memoria. | La instancia de App se identifica por usuario y reinicia sus datos al cambiar de cuenta. |

## Pendientes prioritarios

### 1. Guardados atómicos en servidor — alta

[`storage.set`](../src/lib/storage.js) ejecuta el upsert y el borrado en
peticiones separadas. Si la primera funciona y la segunda falla, el cliente
revierte su vista pero el servidor ya conserva parte del cambio. Una
conciliación puede reaparecer duplicada al recargar.

Recomendación: operación transaccional mediante RPC de Postgres, limitada al
usuario autenticado. Requiere migración SQL y pruebas de rollback real; aún
no está implementada.

Incluso una pareja única por monto/fecha sigue siendo una heurística, no
una prueba de identidad del comercio. Conviene añadir vista previa,
señales del comercio y una operación de deshacer que conserve el manual
original; hoy la fusión solo retiene su id y elimina la fila.

### 2. Edición simultánea en dispositivos — alta

[`persistenceQueue`](../src/lib/persistenceQueue.js) protege operaciones de
una sesión. Dos dispositivos pueden sobrescribir campos de la misma fila
porque el upsert envía la fila completa sin comprobar una versión previa.
Además, los pendientes automáticos usan UUID aleatorios: dos sesiones que
arrancan a la vez pueden generar el mismo cobro con ids diferentes.

Recomendación: versiones por fila y rechazo de escrituras obsoletas; para
suscripciones, unicidad del período de cobro garantizada en el servidor.

### 3. Borrado de categorías — alta

[`deleteCategory`](../src/hooks/useCatalogActions.js) recategoriza débito,
suscripciones y reglas, pero omite `creditTransactions`. El crédito puede
quedar apuntando a una categoría eliminada. También lanza guardados en
varias tablas sin una transacción común ni esperar sus resultados.

Recomendación: reasignar también crédito, proteger la categoría de destino
y ejecutar el cambio de forma atómica. Mostrar el resultado real antes de
cerrar el editor.

### 4. Transferencias entre cuentas propias e ingresos — alta

[`computeMonthStats`](../src/lib/stats.js) suma todos los montos positivos
como ingreso. `excludeFromExpense` solo excluye gastos. Una transferencia
desde otra cuenta propia puede inflar ingresos, balance del mes y tasa de
ahorro aunque el patrimonio no haya crecido.

Recomendación: modelar transferencias propias explícitamente y distinguir
ingresos reales de entradas de caja. Definir esa semántica antes de cambiar
los indicadores existentes.

### 5. Suscripciones durante sesiones largas — media

[`useAppData`](../src/hooks/useAppData.js) genera cobros una vez por sesión.
Si la app sigue abierta al llegar otro día de cobro, no se generan hasta
reiniciarla; editar una suscripción tampoco garantiza recalcular el mes.

Recomendación: recalcular al cambiar la fecha local y al volver a primer
plano, con deduplicación por período garantizada por el servidor.

### 6. Respaldo recuperable y trabajo sin conexión — media

El respaldo ya contiene todas las entidades, pero no hay una función para
restaurarlo con validación, vista previa y política de duplicados. La PWA
guarda los archivos de la aplicación, pero no hay una base local persistente
de movimientos ni una cola durable de cambios offline.

Recomendación: restauración validada y almacenamiento local cifrado o
protegido por sesión, con cola de cambios, reintentos y resolución de
conflictos. La apertura del app shell sin conexión no equivale a poder
gestionar los datos offline.

### 7. Navegación y formularios restantes — media

[`goToCategoryMovements`](../src/App.jsx) no limpia la búsqueda/origen ni
fuerza la vista Débito al abrir desde un gráfico. Si antes se usó Crédito o
un filtro distinto, la lista puede no corresponder al gráfico pulsado.

Los editores de movimientos, categorías rápidas y suscripciones todavía
tienen caminos que cierran sin esperar el guardado o ignoran su resultado.
El alta manual ya quedó corregida, pero el patrón debe extenderse.

### 8. Diferenciar consumo y flujo de caja — mejora funcional

El resumen actual cuenta el pago de la tarjeta desde débito y analiza las
compras de crédito por separado. Es un criterio de flujo de caja válido,
pero no representa necesariamente el consumo del mes en que se compró.

Recomendación: explicitar el criterio en la interfaz y, si se quiere un
resumen por consumo, integrar las cuotas/compras y excluir el pago de la
tarjeta de ese mismo resumen para evitar doble conteo.

## Orden recomendado

1. Transacciones y control de concurrencia en servidor.
2. Borrado seguro de categorías y unicidad de cobros de suscripción.
3. Semántica de ingresos/transferencias y consumo/flujo de caja.
4. Restauración de respaldos, funcionamiento offline y pulido de navegación.

No se aplicaron migraciones de base de datos en esta revisión. Las tareas
de servidor deben implementarse y verificarse antes de anunciarse como
resueltas.
