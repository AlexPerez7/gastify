import { useState } from "react";
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
    <div className="bg-bg min-h-screen flex flex-col items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-xl p-7 w-full max-w-[360px]"
      >
        <img src={logo} alt="" width={40} height={40} className="block mb-3.5" />
        <div className="display text-[17px] font-semibold text-ink mb-1">
          Elige una nueva contraseña
        </div>
        <div className="text-[12.5px] text-muted mb-5">
          Esto reemplaza tu contraseña anterior en todos tus dispositivos.
        </div>

        <FieldInput label="Contraseña nueva" type="password" value={password} onChange={setPassword} required minLength={6} autoComplete="new-password" style={{ marginBottom: 12 }} />
        <FieldInput label="Repetir contraseña" type="password" value={confirm} onChange={setConfirm} required minLength={6} autoComplete="new-password" style={{ marginBottom: 16 }} />

        {error && <div className="text-[12.5px] text-expense mb-3.5">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg border-0 bg-accent text-bg text-[13.5px] font-semibold disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer"
        >
          {loading ? "Un momento…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
