import { useState } from "react";
import { TOKENS } from "../lib/constants.js";
import { FieldInput } from "./Shared.jsx";
import { supabase } from "../lib/supabaseClient.js";
import logo from "../assets/logo.png";

export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 360 }}
      >
        <img src={logo} alt="" width={40} height={40} style={{ display: "block", marginBottom: 14 }} />
        <div className="display" style={{ fontSize: 17, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
          Elige una nueva contraseña
        </div>
        <div style={{ fontSize: 12.5, color: TOKENS.textMuted, marginBottom: 20 }}>
          Esto reemplaza tu contraseña anterior en todos tus dispositivos.
        </div>

        <FieldInput label="Contraseña nueva" type="password" value={password} onChange={setPassword} required minLength={6} autoComplete="new-password" style={{ marginBottom: 12 }} />
        <FieldInput label="Repetir contraseña" type="password" value={confirm} onChange={setConfirm} required minLength={6} autoComplete="new-password" style={{ marginBottom: 16 }} />

        {error && <div style={{ fontSize: 12.5, color: TOKENS.expense, marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
            background: TOKENS.accent, color: TOKENS.bg, fontSize: 13.5, fontWeight: 600,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Un momento…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
