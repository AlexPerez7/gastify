import { useState } from "react";
import { TOKENS } from "../lib/constants.js";
import { FieldInput } from "./Shared.jsx";
import { supabase } from "../lib/supabaseClient.js";
import logo from "../assets/logo.png";

export function Auth({ initialError }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? translateAuthError(initialError) : null);
  const [info, setInfo] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    // si signInWithOAuth falla (ej. proveedor no configurado), no hay
    // redirección de por medio — si tiene éxito, el navegador ya se fue a
    // Google antes de que este código siga corriendo.
    if (oauthError) {
      setError(translateAuthError(oauthError.message));
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL,
        });
        if (resetError) throw resetError;
        setInfo("Si esa cuenta existe, te llegó un correo con un link para elegir una nueva contraseña.");
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setInfo("Cuenta creada. Revisa tu correo y confirma tu email antes de iniciar sesión.");
          setMode("signin");
          setPassword("");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const titles = { signin: "Iniciar sesión", signup: "Crear cuenta", forgot: "Recuperar contraseña" };
  const submitLabels = { signin: "Entrar", signup: "Crear cuenta", forgot: "Enviar link de recuperación" };

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 360 }}
      >
        <img src={logo} alt="" width={40} height={40} style={{ display: "block", marginBottom: 14 }} />
        <div className="display" style={{ fontSize: 17, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
          {titles[mode]}
        </div>
        <div style={{ fontSize: 12.5, color: TOKENS.textMuted, marginBottom: 20 }}>
          {mode === "forgot"
            ? "Escribe tu email y te mandamos un link para elegir una nueva contraseña."
            : "Tus movimientos y categorías, sincronizados entre tus dispositivos."}
        </div>

        <FieldInput label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" style={{ marginBottom: mode === "forgot" ? 16 : 12 }} />
        {mode !== "forgot" && (
          <FieldInput label="Contraseña" type="password" value={password} onChange={setPassword} required minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"} style={{ marginBottom: 16 }} />
        )}

        {error && <div style={{ fontSize: 12.5, color: TOKENS.expense, marginBottom: 14 }}>{error}</div>}
        {info && <div style={{ fontSize: 12.5, color: TOKENS.income, marginBottom: 14 }}>{info}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
            background: TOKENS.accent, color: TOKENS.bg, fontSize: 13.5, fontWeight: 600,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Un momento…" : submitLabels[mode]}
        </button>

        {mode !== "forgot" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: TOKENS.border }} />
              <span style={{ fontSize: 11, color: TOKENS.textFaint }}>o</span>
              <div style={{ flex: 1, height: 1, background: TOKENS.border }} />
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                padding: "9px 0", borderRadius: 8, border: `1px solid ${TOKENS.border}`, background: TOKENS.bg,
                color: TOKENS.text, fontSize: 13, fontWeight: 500, cursor: googleLoading ? "default" : "pointer",
                opacity: googleLoading ? 0.6 : 1,
              }}
            >
              <GoogleIcon size={16} />
              {googleLoading ? "Redirigiendo…" : "Continuar con Google"}
            </button>
          </>
        )}

        {mode === "signin" && (
          <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: TOKENS.textFaint }}>
            <span onClick={() => switchMode("forgot")} style={{ cursor: "pointer" }}>¿Olvidaste tu contraseña?</span>
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: TOKENS.textMuted }}>
          {mode === "forgot" ? (
            <span onClick={() => switchMode("signin")} style={{ color: TOKENS.accent, cursor: "pointer" }}>Volver a iniciar sesión</span>
          ) : (
            <>
              {mode === "signin" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
              <span onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} style={{ color: TOKENS.accent, cursor: "pointer" }}>
                {mode === "signin" ? "Crear una" : "Inicia sesión"}
              </span>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.2-5.5l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C41.9 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function translateAuthError(message) {
  if (/invalid login credentials/i.test(message)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "Todavía no confirmaste tu email. Revisa tu bandeja de entrada.";
  if (/user already registered/i.test(message)) return "Ya existe una cuenta con ese email.";
  if (/link is invalid or has expired/i.test(message)) return "El link del correo venció o ya fue usado. Pedí uno nuevo.";
  if (/provider is not enabled/i.test(message)) return "El login con Google todavía no está activado en el proyecto.";
  return message;
}
