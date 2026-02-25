"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  if (user) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        router.replace("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="w-full rounded-xl border border-chart-dark-grid bg-chart-dark-card p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-chart-green">Sign in</h1>
        <p className="mt-1 text-sm text-chart-green/70">
          Sign in to your SocialTrack account
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-chart-green/90"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-chart-dark-grid bg-chart-dark px-3 py-2 text-chart-green placeholder-chart-green/40 focus:border-chart-green focus:outline-none focus:ring-1 focus:ring-chart-green"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-chart-green/90"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-chart-dark-grid bg-chart-dark px-3 py-2 text-chart-green placeholder-chart-green/40 focus:border-chart-green focus:outline-none focus:ring-1 focus:ring-chart-green"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-chart-green px-4 py-2 font-medium text-chart-dark transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-chart-green/70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-chart-green hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
