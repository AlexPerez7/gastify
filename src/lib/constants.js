import {
  TrendingUp, Utensils, Car, Gamepad2, ShoppingBag, Receipt,
  HeartPulse, ArrowLeftRight, Banknote, Shapes, Home, Plane, Coffee, Gift,
  Book, Briefcase, Dumbbell, Wifi, Smartphone, Fuel, PawPrint, Film, Music,
  GraduationCap, Wrench, Shirt, Bus, CreditCard, PiggyBank, Users, MoreHorizontal,
} from "lucide-react";

// Design tokens — fondo esmeralda oscuro, cifras en monoespaciada,
// un duotono controlado teal/coral para ingreso vs. gasto, ámbar para lo que
// todavía necesita revisión humana (movimientos sin conciliar).
// Los valores son CSS custom properties (definidas en index.css para modo
// oscuro y claro) para que cambiar de tema no requiera tocar cada componente.
export const TOKENS = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  surfaceAlt: "var(--c-surface-alt)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  textMuted: "var(--c-text-muted)",
  textFaint: "var(--c-text-faint)",
  income: "var(--c-income)",
  expense: "var(--c-expense)",
  pending: "var(--c-pending)",
  accent: "var(--c-accent)",
};

// excludeFromExpense: true = esta categoría no cuenta como gasto en stats,
// heatmap, gráficos ni en el hero — pensado para transferencias entre tus
// propias cuentas (ahorro, etc.), que salen de la cuenta corriente pero no
// son consumo real.
// type: "income" | "expense" — filtra qué categorías se sugieren al cargar
// un movimiento manual o editar uno, para no mezclar "Comida" con "Sueldo"
// en el mismo selector. Cada categoría es de un solo tipo — si necesitas
// algo como "Transferencias" en los dos sentidos, se crean dos categorías
// separadas (una de gasto, una de ingreso).
export const DEFAULT_CATEGORIES = [
  { id: "ingreso", label: "Ingresos", color: "#3FBF8F", icon: "TrendingUp", type: "income", excludeFromExpense: false, isSavings: false },
  { id: "comida", label: "Comida y delivery", color: "#E8654F", icon: "Utensils", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "transporte", label: "Transporte", color: "#F0B94A", icon: "Car", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "suscripciones", label: "Suscripciones y juegos", color: "#9B87C4", icon: "Gamepad2", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "compras", label: "Compras", color: "#5B9BD5", icon: "ShoppingBag", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "servicios", label: "Servicios y cuentas", color: "#D98E52", icon: "Receipt", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "salud", label: "Salud y cuidado personal", color: "#6FCF97", icon: "HeartPulse", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "transferencias", label: "Transferencias personales", color: "#7C8B9C", icon: "ArrowLeftRight", type: "expense", excludeFromExpense: true, isSavings: false },
  { id: "efectivo", label: "Retiro de efectivo", color: "#A0A8B4", icon: "Banknote", type: "expense", excludeFromExpense: false, isSavings: false },
  { id: "otros", label: "Otros", color: "#57646F", icon: "Shapes", type: "expense", excludeFromExpense: false, isSavings: false },
];

// categorías creadas antes de que existiera este campo (o leídas desde una
// base sin la columna `type` todavía, o con el antiguo tipo "both") no
// tienen un `type` válido guardado — se asume "income" solo para la
// categoría por defecto de ingresos, "expense" para cualquier otra, así el
// filtro de los selectores sigue teniendo sentido.
export function categoryType(cat) {
  if (cat.type === "income" || cat.type === "expense") return cat.type;
  return cat.id === "ingreso" ? "income" : "expense";
}

// true si esa categoría debería sugerirse para un movimiento del tipo dado
// ("income"/"expense").
export function categoryMatchesType(cat, wantedType) {
  return categoryType(cat) === wantedType;
}

// nombre a mostrar para una categoría en un selector que puede listar
// categorías de los dos tipos a la vez (ej. el filtro de Movimientos, o el
// editor de un movimiento puntual que mantiene visible su categoría actual
// aunque no calce con el tipo del monto): dos categorías con el mismo
// nombre pero de tipos distintos (ej. "Transporte" de gasto y "Transporte"
// de ingreso, para poder distinguir un pasaje de una devolución) son
// indistinguibles por nombre solo — se les agrega "(gasto)"/"(ingreso)"
// únicamente cuando ese choque existe en la lista dada, para no ensuciar
// el resto de las categorías que no lo necesitan.
export function labelWithTypeIfAmbiguous(cat, allCategories) {
  const collision = allCategories.some((c) => c.id !== cat.id && c.label === cat.label && categoryType(c) !== categoryType(cat));
  if (!collision) return cat.label;
  return `${cat.label} (${categoryType(cat) === "income" ? "ingreso" : "gasto"})`;
}

export const DEFAULT_CATEGORY_ICON = Shapes;

// icono por id de categoría — respaldo para categorías guardadas en
// localStorage antes de que existiera el campo `icon` en cada categoría
export const CATEGORY_ICONS = {
  ingreso: TrendingUp,
  comida: Utensils,
  transporte: Car,
  suscripciones: Gamepad2,
  compras: ShoppingBag,
  servicios: Receipt,
  salud: HeartPulse,
  transferencias: ArrowLeftRight,
  efectivo: Banknote,
  otros: DEFAULT_CATEGORY_ICON,
};

// catálogo de íconos que el usuario puede elegir para una categoría
export const ICONS = {
  Utensils, Coffee, ShoppingBag, Car, Bus, Fuel, Home, Wifi, Smartphone,
  Receipt, CreditCard, Banknote, PiggyBank, TrendingUp, ArrowLeftRight,
  Gamepad2, Film, Music, Plane, Gift, HeartPulse, Dumbbell, Book,
  GraduationCap, Briefcase, Wrench, Shirt, PawPrint, Users, Shapes,
  MoreHorizontal,
};

export const ICON_NAMES = Object.keys(ICONS);

export function resolveCategoryIcon(cat) {
  return (cat.icon && ICONS[cat.icon]) || CATEGORY_ICONS[cat.id] || DEFAULT_CATEGORY_ICON;
}

export const PALETTE = [
  "#E8654F", "#F0B94A", "#3FBF8F", "#5B9BD5", "#9B87C4",
  "#D98E52", "#6FCF97", "#7C8B9C", "#4FC3D9", "#C9755B",
];

/** @type {Array<[string[], string]>} */
export const MERCHANT_RULES_DEFAULT = [
  [["UBER EATS", "RAPPI", "MCDONALD", "SANTA ISABEL", "STA ISABEL", "SUBWAY", "RYOMA",
    "ASUSHI", "TITO MONJE", "MERCADOPAGO MYM", "DUNKIN", "MONARCH", "MP  NATURA", "MP NATURA",
    "MINIMARKET", "COMERCIAL MANGOS", "SUMUP", "DON JULIO", "VENTI TC", "CCU", "BK SUECIA"], "comida"],
  [["UBER TRIP", "PAYU *UBER", "RED MOVILIDAD"], "transporte"],
  [["NETFLIX", "SPOTIFY", "YOUTUBE", "STEAM", "GOG", "FORTNITE", "EPC ", "GOOGLE PLAY"], "suscripciones"],
  [["WEBPAY", "FALABELLA", "MALL PLAZA", "COMERCIAL LIDA", "UNICASA"], "compras"],
  [["ENTEL", "BANCO DEL ESTADO", "COMISION", "MONTO POR COMISIONES"], "servicios"],
  [["GIMNASIO", "BARBER", "PELUQUERIA"], "salud"],
  [["GIRO CAJERO", "REDBANC"], "efectivo"],
];

export const NOISE_TOKENS = new Set([
  "CHL", "CHE", "DEU", "USA", "POL", "ARG", "SANTIAGO", "LAS", "CONDES", "PROVIDENCIA",
  "PROVIDENC", "VIRTUAL", "0",
]);
