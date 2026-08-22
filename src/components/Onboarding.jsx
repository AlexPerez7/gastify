import { useState } from "react";
import { Upload, Tags, CheckCircle2, ChevronRight, X } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

const STEPS = [
  {
    icon: Upload,
    title: "Sube tu archivo",
    text: "Arrastra el .xls o la cartola .pdf de tu banco (o agrega un gasto a mano) para empezar a ver tus finanzas aquí.",
  },
  {
    icon: Tags,
    title: "Categoriza",
    text: "Cada movimiento se categoriza solo cuando puede. Toca el lápiz para ajustar la categoría o el nombre, y recordarlo para la próxima vez.",
  },
  {
    icon: CheckCircle2,
    title: "Concilia",
    text: "Compara lo que registraste a mano con lo que reportó el banco, para asegurarte de que no falte ni sobre nada.",
  },
];

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, text } = STEPS[step];

  return (
    <div
      onClick={onDone}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-panel"
        style={{
          background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16,
          padding: 28, maxWidth: 360, width: "100%", textAlign: "center", position: "relative",
        }}
      >
        <button
          onClick={onDone}
          aria-label="Saltar introducción"
          title="Saltar"
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer", padding: 4 }}
        >
          <X size={16} />
        </button>

        <div key={step} className="tab-panel">
          <div
            style={{
              width: 56, height: 56, borderRadius: 14, background: "var(--tint-accent)", display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
            }}
          >
            <Icon size={26} color={TOKENS.accent} />
          </div>

          <div className="display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13, color: TOKENS.textMuted, lineHeight: 1.5, marginBottom: 22 }}>{text}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                background: i === step ? TOKENS.accent : TOKENS.border, transition: "width 180ms ease",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {isLast ? "Empezar" : "Siguiente"}
          {!isLast && <ChevronRight size={14} />}
        </button>

        <div style={{ fontSize: 11, color: TOKENS.textFaint, marginTop: 14 }}>
          ¿Necesitas verlo de nuevo? Búscalo en el botón <strong>?</strong> de arriba.
        </div>
      </div>
    </div>
  );
}
