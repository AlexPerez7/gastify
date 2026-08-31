import { CheckCircle2, AlertTriangle, XCircle, Loader2, X } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

const KIND = {
  loading: { icon: Loader2, color: TOKENS.accent, spin: true },
  ok: { icon: CheckCircle2, color: TOKENS.income },
  warn: { icon: AlertTriangle, color: TOKENS.pending },
  error: { icon: XCircle, color: TOKENS.expense },
};

export function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => {
        const { icon: Icon, color, spin } = KIND[t.type] || KIND.ok;
        const showProgress = t.type === "loading" && typeof t.progress === "number";
        return (
          <div
            key={t.id}
            role="status"
            className={`toast flex flex-col gap-1.5 px-3 py-[11px] rounded-[10px] bg-surface border border-border${t.leaving ? " toast-leaving" : ""}`}
            style={{ boxShadow: "0 10px 28px rgba(0,0,0,0.4)" }}
          >
            <div className="flex items-start gap-2.5">
              <Icon size={16} color={color} className={`shrink-0 mt-px${spin ? " spin" : ""}`} />
              <div className="text-[12.5px] text-ink flex-1 leading-[1.4]">{t.text}</div>
              {t.type !== "loading" && (
                <button
                  onClick={() => onDismiss(t.id)}
                  aria-label="Cerrar notificación"
                  className="bg-transparent border-0 cursor-pointer text-faint p-0 shrink-0 mt-px"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {showProgress && (
              <div className="h-1 rounded-full bg-surface-alt overflow-hidden ml-[26px]">
                <div
                  className="h-full bg-accent rounded-full transition-[width] duration-[120ms] ease-out"
                  style={{ width: `${t.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
