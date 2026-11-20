import React, { useState } from "react";
import { apiRequest } from "./api";

const colors = {
  bg: "#070811",
  card: "#10121e",
  input: "#171a29",
  border: "#30354c",
  cyan: "#44f3ff",
  purple: "#c77aff",
  text: "#f0f3ff",
  muted: "#aab2c9",
  error: "#ff8296",
};

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("landing");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function authenticate(credentials, action) {
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest(`/api/auth/${action}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await authenticate(
      { username, password },
      mode === "login" ? "login" : "register"
    );
  }

  const showForm = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  return (
    <main style={{
      width: "100%",
      maxWidth: 430,
      margin: "0 auto",
      minHeight: "100dvh",
      background: `radial-gradient(ellipse at 50% 20%, #14182a 0%, ${colors.bg} 62%)`,
      color: colors.text,
      display: "grid",
      placeItems: "center",
      padding: 18,
      fontFamily: "'Space Mono','Courier New',monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box}
        @keyframes authFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .auth-input:focus{border-color:${colors.cyan}!important;box-shadow:0 0 0 3px ${colors.cyan}24}
        .auth-action:hover{filter:brightness(1.15)}
      `}</style>
      <section style={{
        width: "100%",
        maxWidth: 390,
        padding: "24px 22px",
        borderRadius: 18,
        background: `linear-gradient(160deg, ${colors.card}, #0b0d17)`,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 24px 80px #0009",
        animation: "authFade .35s ease",
      }}>
        <header style={{ textAlign: "center", marginBottom: mode === "landing" ? 24 : 20 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: colors.cyan,
            textShadow: `0 0 18px ${colors.cyan}66`,
          }}>
            NIGHT<span style={{ color: colors.purple }}>⚡</span>PULSE
          </div>
          <div style={{
            color: colors.muted,
            fontSize: 10,
            letterSpacing: 2,
            marginTop: 7,
          }}>
            {mode === "landing" ? "YOUR NIGHT, MORE CONNECTED" : "ACCOUNT ACCESS"}
          </div>
        </header>

        {mode === "landing" ? (
          <>
            <div style={{
              borderRadius: 12,
              border: `1px solid ${colors.cyan}55`,
              background: `linear-gradient(135deg, ${colors.cyan}13, ${colors.purple}12)`,
              padding: "20px 17px",
              marginBottom: 16,
            }}>
              <div style={{
                color: colors.cyan,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                marginBottom: 10,
              }}>THE NIGHT IS BETTER TOGETHER</div>
              <h1 style={{
                color: colors.text,
                fontSize: 23,
                lineHeight: 1.35,
                letterSpacing: 1,
                margin: "0 0 10px",
              }}>Find your people. Feel the pulse.</h1>
              <p style={{
                color: colors.muted,
                fontSize: 12,
                lineHeight: 1.8,
                margin: 0,
              }}>
                See who’s nearby, make a match, and meet on the dancefloor.
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 18,
            }}>
              {[
                ["◉", "NEARBY"],
                ["♡", "MATCH"],
                ["⌁", "YOUR VIBE"],
              ].map(([icon, label]) => (
                <div key={label} style={{
                  padding: "12px 5px",
                  borderRadius: 9,
                  background: colors.input,
                  border: `1px solid ${colors.border}`,
                  textAlign: "center",
                }}>
                  <div style={{ color: colors.cyan, fontSize: 19, marginBottom: 5 }}>{icon}</div>
                  <div style={{ color: colors.text, fontSize: 9, letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}
            <button
              type="button"
              className="auth-action"
              disabled={busy}
              onClick={() => authenticate({ username: "user", password: "user123" }, "login")}
              style={primaryButtonStyle(colors, busy)}
            >
              {busy ? "OPENING THE DEMO..." : "TRY THE DEMO →"}
            </button>
            <div style={{
              color: colors.muted,
              fontSize: 10,
              textAlign: "center",
              margin: "9px 0 16px",
            }}>
              Trial access · user / user123
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <button
                type="button"
                className="auth-action"
                onClick={() => showForm("login")}
                style={secondaryButtonStyle(colors)}
              >
                LOG IN
              </button>
              <button
                type="button"
                className="auth-action"
                onClick={() => showForm("register")}
                style={secondaryButtonStyle(colors, true)}
              >
                CREATE ACCOUNT
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => showForm("landing")} style={{
              background: "none",
              border: 0,
              color: colors.muted,
              font: "inherit",
              fontSize: 11,
              padding: "0 0 15px",
              cursor: "pointer",
            }}>← BACK</button>
            <div style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
              marginBottom: 18,
            }}>{mode === "login" ? "WELCOME BACK" : "JOIN THE NIGHT"}</div>

            <form onSubmit={submit}>
              <label htmlFor="username" style={labelStyle(colors)}>USERNAME</label>
              <input
                id="username"
                className="auth-input"
                autoComplete="username"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
                style={inputStyle(colors)}
              />
              <label htmlFor="password" style={labelStyle(colors)}>PASSWORD</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                style={{ ...inputStyle(colors), marginBottom: 16 }}
              />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <button type="submit" className="auth-action" disabled={busy} style={primaryButtonStyle(colors, busy)}>
                {busy ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
              </button>
            </form>

            <div style={{
              textAlign: "center",
              fontSize: 11,
              color: colors.muted,
              marginTop: 17,
            }}>
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => showForm(mode === "login" ? "register" : "login")} style={{
                border: 0,
                background: "none",
                padding: 4,
                color: colors.cyan,
                cursor: "pointer",
                font: "inherit",
                fontWeight: 700,
              }}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ErrorMessage({ children }) {
  return (
    <div role="alert" style={{
      color: colors.error,
      fontSize: 11,
      lineHeight: 1.6,
      margin: "0 0 14px",
    }}>{children}</div>
  );
}

function primaryButtonStyle(theme, busy) {
  return {
    width: "100%",
    minHeight: 49,
    borderRadius: 9,
    border: `1px solid ${theme.cyan}99`,
    background: busy ? theme.input : `linear-gradient(100deg, ${theme.cyan}24, ${theme.purple}24)`,
    color: theme.text,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    fontFamily: "inherit",
    cursor: busy ? "wait" : "pointer",
  };
}

function secondaryButtonStyle(theme, accent = false) {
  return {
    minHeight: 44,
    borderRadius: 8,
    border: `1px solid ${accent ? theme.purple : theme.border}`,
    background: theme.input,
    color: accent ? theme.purple : theme.text,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    fontFamily: "inherit",
    cursor: "pointer",
  };
}

function labelStyle(theme) {
  return {
    display: "block",
    color: theme.muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    marginBottom: 7,
  };
}

function inputStyle(theme) {
  return {
    width: "100%",
    minHeight: 48,
    marginBottom: 14,
    padding: "11px 12px",
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    outline: "none",
    background: theme.input,
    color: theme.text,
    fontFamily: "'Space Mono','Courier New',monospace",
    fontSize: 13,
  };
}
