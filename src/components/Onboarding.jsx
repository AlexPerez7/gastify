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
      className="modal-backdrop fixed inset-0 flex items-center justify-center z-[2000] p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-panel bg-surface border border-border rounded-2xl p-7 max-w-[360px] w-full text-center relative"
      >
        <button
          onClick={onDone}
          aria-label="Saltar introducción"
          title="Saltar"
          className="absolute top-3.5 right-3.5 bg-none border-0 text-faint cursor-pointer p-1"
        >
          <X size={16} />
        </button>

        <div key={step} className="tab-panel">
          <div className="w-14 h-14 rounded-[14px] bg-tint-accent flex items-center justify-center mx-auto mb-[18px]">
            <Icon size={26} color={TOKENS.accent} />
          </div>

          <div className="display text-[17px] font-semibold mb-2">{title}</div>
          <div className="text-[13px] text-muted leading-[1.5] mb-[22px]">{text}</div>
        </div>

        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-[3px] transition-[width] duration-[180ms] ${
                i === step ? "w-[18px] bg-accent" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
          className="w-full py-2.5 rounded-lg border-0 cursor-pointer bg-accent text-bg font-semibold text-[13px] flex items-center justify-center gap-1.5"
        >
          {isLast ? "Empezar" : "Siguiente"}
          {!isLast && <ChevronRight size={14} />}
        </button>

        <div className="text-[11px] text-faint mt-3.5">
          ¿Necesitas verlo de nuevo? Búscalo en el botón <strong>?</strong> de arriba.
        </div>
      </div>
    </div>
  );
}
