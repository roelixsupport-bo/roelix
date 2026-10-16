import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { STORE_SUPPORT_EMAIL } from "@/lib/store";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect:
      typeof s["redirect"] === "string" &&
      s["redirect"].startsWith("/") &&
      !s["redirect"].startsWith("//")
        ? s["redirect"]
        : "/admin",
  }),
  head: () => ({
    meta: [
      { title: "Admin Login — ROELIX Atelier" },
      { name: "description", content: "Sign in to manage the ROELIX collection and orders." },
      { property: "og:title", content: "Admin Login — ROELIX Atelier" },
      { property: "og:description", content: "Sign in to manage the ROELIX collection and orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  const [email, setEmail] = useState(STORE_SUPPORT_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Could not check the Supabase session", error);
        return;
      }
      if (active && data.session) void nav({ to: redirect });
    });
    return () => {
      active = false;
    };
  }, [nav, redirect]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      nav({ to: redirect });
    } catch (error) {
      console.error("Could not sign in to the ROELIX dashboard", error);
      setError(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <p className="eyebrow text-gold">Atelier</p>
      <h1 className="font-serif text-5xl">Admin Login</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Sign in with your ROELIX dashboard account. Staff accounts have access to orders only.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          type="email"
          required
          autoComplete="username"
          aria-label="Dashboard email"
          placeholder="Email"
          className="input-lux w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          aria-label="Dashboard password"
          placeholder="Password"
          className="input-lux w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button disabled={busy} className="btn-lux w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-xs text-muted-foreground">
        Dashboard access is managed through Supabase. Contact the primary administrator if you
        need an account.
      </p>
    </div>
  );
}
