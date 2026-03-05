"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SocialPerformanceChart } from "@/components/SocialPerformanceChart";
import { LinkedInPostsChart } from "@/components/LinkedInPostsChart";
import { aggregatePlatforms, getDateRangeLabel } from "@/lib/aggregate";
import {
  toPlatformMetrics as linkedInToPlatformMetrics,
} from "@/lib/linkedinImport";
import {
  toPlatformMetrics as youtubeToPlatformMetrics,
} from "@/lib/youtubeImport";
import type { Platform } from "@/types/social";

const CHANNEL_NAME = "Channel";

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<{
    linkedIn: import("@/lib/linkedinImport").StoredLinkedInData | null;
    youtube: import("@/lib/youtubeImport").StoredYouTubeData | null;
    dateFrom: string;
    dateTo: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error || "Profile not found");
          setData(null);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json);
      } catch {
        if (!cancelled) setError("Failed to load profile");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const linkedInMetrics = useMemo(() => {
    if (!data?.linkedIn) return null;
    const d = data.linkedIn;
    return linkedInToPlatformMetrics(
      d.dailyImpressions ?? [],
      d.posts ?? [],
      d.followersByDate ?? []
    );
  }, [data?.linkedIn]);

  const youtubeMetrics = useMemo(() => {
    if (!data?.youtube) return null;
    const d = data.youtube;
    return youtubeToPlatformMetrics(
      d.dailyData ?? [],
      d.channelName ?? CHANNEL_NAME,
      d.videos ?? [],
      d.chartVideos ?? []
    );
  }, [data?.youtube]);

  const platformsForChart = [
    ...(linkedInMetrics ? [linkedInMetrics] : []),
    ...(youtubeMetrics ? [youtubeMetrics] : []),
  ];
  const availablePlatforms = platformsForChart.map((p) => p.platform);
  const [selected, setSelected] = useState<Set<Platform>>(
    () => new Set(availablePlatforms)
  );

  const linkedInDataRaw =
    linkedInMetrics
      ? aggregatePlatforms([linkedInMetrics], ["linkedin"])
      : [];

  const linkedInDateBounds = useMemo(() => {
    const stored = data?.linkedIn;
    if (!stored?.dailyImpressions?.length && !stored?.posts?.length)
      return null;
    const dates = [
      ...(stored.dailyImpressions?.map((d) => d.date) ?? []),
      ...(stored.posts?.map((p) => p.date) ?? []),
    ];
    if (dates.length === 0) return null;
    const sorted = [...new Set(dates)].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [data?.linkedIn]);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    if (!linkedInDateBounds) return;
    setDateFrom((prev) => {
      if (!prev || prev < linkedInDateBounds.min || prev > linkedInDateBounds.max)
        return linkedInDateBounds.min;
      return prev;
    });
    setDateTo((prev) => {
      if (!prev || prev < linkedInDateBounds.min || prev > linkedInDateBounds.max)
        return linkedInDateBounds.max;
      return prev;
    });
  }, [linkedInDateBounds]);

  const linkedInDateFilter = useMemo(() => {
    if (!linkedInDateBounds || !dateFrom || !dateTo) return null;
    const from = dateFrom >= linkedInDateBounds.min ? dateFrom : linkedInDateBounds.min;
    const to = dateTo <= linkedInDateBounds.max ? dateTo : linkedInDateBounds.max;
    return { from, to };
  }, [linkedInDateBounds, dateFrom, dateTo]);

  const linkedInData =
    linkedInDateFilter && linkedInDataRaw.length > 0
      ? linkedInDataRaw.filter(
          (d) => d.date >= linkedInDateFilter.from && d.date <= linkedInDateFilter.to
        )
      : linkedInDataRaw;

  const linkedInPostsFiltered =
    linkedInDateFilter && data?.linkedIn?.posts
      ? data.linkedIn.posts.filter(
          (p) => p.date >= linkedInDateFilter.from && p.date <= linkedInDateFilter.to
        )
      : data?.linkedIn?.posts ?? [];

  const youtubeData =
    youtubeMetrics
      ? aggregatePlatforms([youtubeMetrics], ["youtube"])
      : [];

  if (isLoading) {
    return (
      <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-24">
        <p className="text-chart-green/70">Loading…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24">
        <h1 className="text-2xl font-bold text-chart-green">Profile not found</h1>
        <p className="mt-2 text-chart-green/70">
          {error ?? "This profile is not available or has been made private."}
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg border border-chart-green px-4 py-2 text-sm font-medium text-chart-green hover:bg-chart-dark-card"
        >
          Back to SocialTrack
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-chart-green">SocialTrack</h1>
          <p className="mt-1 text-sm text-chart-green/70">
            Public profile · Read-only view
          </p>
        </div>
        <Link
          href="/"
          className="self-start rounded-lg border border-chart-dark-grid px-3 py-1.5 text-sm text-chart-green/80 hover:bg-chart-dark-card"
        >
          Sign in to SocialTrack
        </Link>
      </header>

      {availablePlatforms.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {availablePlatforms.map((id) => (
            <button
              key={id}
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected.has(id)
                  ? "bg-chart-green text-chart-dark"
                  : "bg-chart-dark-card text-chart-green/70 hover:bg-chart-dark-grid hover:text-chart-green"
              }`}
            >
              {id === "linkedin" ? "LinkedIn" : id === "youtube" ? "YouTube" : id}
            </button>
          ))}
        </div>
      )}

      {linkedInDataRaw.length > 0 && linkedInDateBounds && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-chart-dark-grid/50 bg-chart-dark/40 px-4 py-3">
            <span className="text-sm font-medium text-chart-green">
              Date range:
            </span>
            <label className="flex items-center gap-2 text-sm text-chart-green/90">
              From
              <input
                type="date"
                value={dateFrom}
                min={linkedInDateBounds.min}
                max={dateTo || linkedInDateBounds.max}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-chart-dark-grid bg-chart-dark-card px-2 py-1.5 text-chart-green focus:border-chart-green focus:outline-none focus:ring-1 focus:ring-chart-green"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-chart-green/90">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || linkedInDateBounds.min}
                max={linkedInDateBounds.max}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-chart-dark-grid bg-chart-dark-card px-2 py-1.5 text-chart-green focus:border-chart-green focus:outline-none focus:ring-1 focus:ring-chart-green"
              />
            </label>
            <span className="text-xs text-chart-green/60">
              {linkedInDateBounds.min} – {linkedInDateBounds.max}
            </span>
          </div>
          <div className="mb-10">
            <SocialPerformanceChart
              data={linkedInData}
              platform="linkedin"
              title="LinkedIn — Follower Growth & Cumulative Impressions"
            />
          </div>
          {linkedInPostsFiltered.length > 0 && (
            <div className="mb-10">
              <LinkedInPostsChart
                posts={linkedInPostsFiltered}
                followersByDate={data.linkedIn?.followersByDate ?? []}
              />
            </div>
          )}
        </>
      )}

      {youtubeData.length > 0 && (
        <div className="mb-10">
          <SocialPerformanceChart
            data={youtubeData}
            platform="youtube"
            title="YouTube — Cumulative Views per Video & Subscribers"
            youtubeVideos={data.youtube?.videos}
            youtubeChartVideos={data.youtube?.chartVideos}
          />
        </div>
      )}

      {linkedInData.length === 0 && youtubeData.length === 0 && (
        <p className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-8 text-center text-chart-green/70">
          No data in the selected date range.
        </p>
      )}
    </main>
  );
}
