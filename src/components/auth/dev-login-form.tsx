"use client";

import { Eye, EyeOff, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { readDevEnvDefaults } from "@/lib/auth/utils/dev-auth";

export function DevLoginForm() {
  const router = useRouter();
  const { signInWithDevSession, loading, isAuthenticated } = useAuth();
  const envDefaults = readDevEnvDefaults();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loading, router]);

  const [email, setEmail] = useState(envDefaults.email ?? "");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState(envDefaults.companyId ?? "");
  const [name, setName] = useState(envDefaults.name ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signInWithDevSession({
        email,
        password,
        companyId,
        name: name.trim() || null,
      });
      router.replace("/");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Dev sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const busy = loading || isLoading;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Wrench className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dev session login</h1>
          <p className="mt-2 text-sm text-slate-400">
            Auth bypass is enabled. Sign in with API credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="dev-company-id" className="text-sm font-medium text-slate-200">
              Company ID
            </label>
            <input
              id="dev-company-id"
              type="text"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-primary/30 transition focus:ring-2"
              placeholder="company-id"
              required
              disabled={busy}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dev-email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="dev-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-primary/30 transition focus:ring-2"
              placeholder="dev@local"
              required
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dev-name" className="text-sm font-medium text-slate-200">
              Name
            </label>
            <input
              id="dev-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-primary/30 transition focus:ring-2"
              placeholder="Optional"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dev-password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <div className="relative">
              <input
                id="dev-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 pr-11 text-sm text-white outline-none ring-primary/30 transition focus:ring-2"
                placeholder="••••••••"
                required
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-amber-300/80">
          Development bypass only. Set NEXT_PUBLIC_BYPASS_AUTH=false for Firebase login.
        </p>
      </div>
    </div>
  );
}
