"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PublicProfileSettings } from "@/components/PublicProfileSettings";
import { useLinkedInData } from "@/hooks/useLinkedInData";
import { useYouTubeData } from "@/hooks/useYouTubeData";
import { useAuth } from "@/contexts/AuthContext";

export default function SharePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { stored } = useLinkedInData();
  const { stored: youtubeStored } = useYouTubeData();

  const dataDateBounds = useMemo(() => {
    const linkedInDates = [
      ...(stored?.dailyImpressions?.map((d) => d.date) ?? []),
      ...(stored?.posts?.map((p) => p.date) ?? []),
    ];
    const youtubeDates = youtubeStored?.dailyData?.map((d) => d.date) ?? [];
    const all = [...linkedInDates, ...youtubeDates];
    if (all.length === 0) return null;
    const sorted = [...new Set(all)].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [stored?.dailyImpressions, stored?.posts, youtubeStored?.dailyData]);

  if (authLoading) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-24">
        <p className="text-chart-green/70">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24">
        <h1 className="text-2xl font-bold text-chart-green">Sign in required</h1>
        <p className="mt-2 text-chart-green/70">
          You need to sign in to manage your public profile.
        </p>
        <Link
          href="/login"
          className="mt-6 rounded-lg bg-chart-green px-4 py-2 text-sm font-medium text-chart-dark hover:opacity-90"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-chart-green">Share</h1>
          <p className="mt-1 text-chart-green/70">
            Make your profile publicly viewable with a read-only link
          </p>
        </div>
        <Link
          href="/"
          className="self-start rounded-lg border border-chart-dark-grid px-3 py-1.5 text-sm text-chart-green/80 hover:bg-chart-dark-card"
        >
          ← Back to dashboard
        </Link>
      </header>

      <PublicProfileSettings dataDateBounds={dataDateBounds} expanded />
    </main>
  );
}
