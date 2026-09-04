// Formas de datos "de app" (camelCase) que circulan por App.jsx y los
// componentes. No hay TypeScript en el proyecto, pero estos @typedef los
// levantan VS Code / los editores para autocompletado y para chequear el
// mapeo camelCase↔snake_case de src/lib/storage.js (toRow/fromRow), que es
// donde más fácil se cuela un bug de nombre de campo.
//
// Este archivo no exporta nada en runtime — es solo documentación de tipos.

/**
 * @typedef {"bank" | "manual"} TxSource
 */

/**
 * Movimiento de la cuenta corriente (débito). Tabla `transactions`.
 * @typedef {Object} Transaction
 * @property {string}  id           id único (crypto.randomUUID); PK junto a user_id
 * @property {string}  key          clave determinística fecha|saldo|cargo|abono (dedupe)
 * @property {string}  date         ISO "YYYY-MM-DD"
 * @property {string}  description  descripción normalizada del banco / texto manual
 * @property {string}  alias        nombre amigable puesto por el usuario o una regla ("" si no hay)
 * @property {number}  amount       con signo: negativo = gasto, positivo = ingreso/abono
 * @property {string}  category     id de categoría
 * @property {TxSource} source
 * @property {boolean} reconciled   legado; hoy la fusión borra la fila manual (ver reconcile.js)
 * @property {string|null} matchedId  si es `bank` y se fusionó con un manual, el id de ese manual
 * @property {string|null} [subscriptionId]  si vino de / se vinculó a una suscripción
 * @property {string}  [createdAt]  ISO; lo pone Supabase (default now()), se manda solo para el optimista
 */

/**
 * Categoría editable. Tabla `categories`.
 * @typedef {Object} Category
 * @property {string}  id
 * @property {string}  label
 * @property {string}  color        token CSS o hex
 * @property {string}  [icon]       nombre de ícono lucide
 * @property {boolean} excludeFromExpense  "no cuenta como gasto" (transferencias entre cuentas propias)
 * @property {number|null} budget   presupuesto mensual; null = sin límite
 * @property {"income"|"expense"|"both"|null} type
 * @property {boolean} [isSavings]  sus movimientos se acumulan en "Total ahorrado"
 */

/**
 * Regla de "memoria de comercio". Tabla `merchant_rules`.
 * @typedef {Object} MerchantRule
 * @property {string} id
 * @property {string} matchText    substring (case-insensitive) a buscar en la descripción
 * @property {string} categoryId
 * @property {string} alias
 */

/**
 * Suscripción declarada. Tabla `subscriptions`.
 * @typedef {Object} Subscription
 * @property {string}  id           prefijo "sub_"
 * @property {string}  name
 * @property {number}  amount       positivo (el signo lo pone el movimiento generado)
 * @property {string}  category     id de categoría
 * @property {number}  dayOfMonth   1..31
 * @property {boolean} active
 */

/**
 * Movimiento de la tarjeta de crédito (CMR). Tabla `credit_transactions`.
 * @typedef {Object} CreditTransaction
 * @property {string}  id
 * @property {string}  key                 makeCreditKey(...) — incluye statementMonth
 * @property {string}  statementMonth      "YYYY-MM" del ciclo (no el mes de la compra)
 * @property {string}  date                ISO "YYYY-MM-DD" (fecha de compra original)
 * @property {string}  description
 * @property {string}  alias
 * @property {number}  amount              con signo (negativo = gasto), = -valorCuota
 * @property {number|null} totalAmount     monto total de la compra
 * @property {number}  installmentsPending cuotas que faltan
 * @property {string}  [holder]            titular / adicional
 * @property {string}  category
 * @property {string}  [createdAt]
 */

/**
 * Resumen del Estado de Cuenta CMR (PDF). Tabla `credit_statements`.
 * @typedef {Object} CreditStatement
 * @property {string}  id
 * @property {string}  statementMonth
 * @property {string|null} statementDate
 * @property {string|null} periodFrom
 * @property {string|null} periodTo
 * @property {string|null} payBy
 * @property {number|null} totalToPay
 * @property {number|null} minToPay
 * @property {number|null} cupoTotal
 * @property {number|null} cupoUsed
 * @property {number|null} cupoAvailable
 * @property {string}  [createdAt]
 */

/**
 * Ajustes de cuenta (una fila por usuario). Tabla `account_settings`.
 * @typedef {Object} AccountSettings
 * @property {number}  baseBalance
 * @property {string}  lastSyncDate       ISO
 * @property {number|null} [savingsBase]
 * @property {string|null} [savingsBaseDate]
 */

export {};
