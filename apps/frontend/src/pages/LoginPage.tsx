import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, name, password });
      }
      navigate("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logo}>murmur</div>
        <h1 className={styles.title}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && (
            <div className={styles.field}>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading
              ? "Loading..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className={styles.toggle}>
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
