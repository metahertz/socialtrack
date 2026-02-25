"use client";

import { useState, useEffect, type ReactNode } from "react";

interface DbGuardProps {
  children: ReactNode;
}

export function DbGuard({ children }: DbGuardProps) {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.status === "ok") {
          setStatus("ok");
        } else {
          setStatus("error");
          setMessage(data.message || "Database is unavailable.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setMessage("Could not reach the server. Please try again later.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-chart-green/70">Checking database connection…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-chart-dark-card p-8 text-center">
          <h1 className="text-xl font-bold text-red-400">
            Database unavailable
          </h1>
          <p className="mt-3 text-sm text-chart-green/80">{message}</p>
          <p className="mt-4 text-xs text-chart-green/50">
            If you&apos;re setting up locally, copy .env.example to .env and add
            your MongoDB Atlas connection string. See the README for details.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
