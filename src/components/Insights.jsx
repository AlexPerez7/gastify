import { Lightbulb } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

export function Insights({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-5">
      {items.map((text, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-muted leading-[1.4]"
        >
          <Lightbulb size={14} color={TOKENS.accent} className="shrink-0" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
