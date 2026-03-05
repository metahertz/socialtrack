"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { SocialPerformanceChart } from "@/components/SocialPerformanceChart";
import { LinkedInPostsChart } from "@/components/LinkedInPostsChart";
import { LinkedInUpload } from "@/components/LinkedInUpload";
import { LinkedInImportPreview } from "@/components/LinkedInImportPreview";
import { PublicProfileSettings } from "@/components/PublicProfileSettings";
import { YouTubeUpload } from "@/components/YouTubeUpload";
import { YouTubeImportPreview } from "@/components/YouTubeImportPreview";
import { aggregatePlatforms, getDateRangeLabel } from "@/lib/aggregate";
import { useLinkedInData } from "@/hooks/useLinkedInData";
import { useYouTubeData } from "@/hooks/useYouTubeData";
import { useAuth } from "@/contexts/AuthContext";
import type { Platform } from "@/types/social";

const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter (X)",
  youtube: "YouTube",
};

export default function Home() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const {
    linkedInMetrics,
    stored,
    error,
    isLoading,
    pendingImport,
    handleFile,
    approveImport,
    rejectImport,
    clear,
  } = useLinkedInData();

  const {
    youtubeMetrics,
    stored: youtubeStored,
    error: youtubeError,
    isLoading: youtubeIsLoading,
    pendingImport: youtubePendingImport,
    handleFile: handleYouTubeFile,
    approveImport: approveYouTubeImport,
    rejectImport: rejectYouTubeImport,
    clear: clearYouTube,
  } = useYouTubeData();

  const platformsForChart = [
    ...(linkedInMetrics ? [linkedInMetrics] : []),
    ...(youtubeMetrics ? [youtubeMetrics] : []),
  ];
  const availablePlatforms = platformsForChart.map((p) => p.platform);
  const [selected, setSelected] = useState<Set<Platform>>(
    () => new Set(availablePlatforms)
  );

  useEffect(() => {
    if (availablePlatforms.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of availablePlatforms) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [availablePlatforms.join(",")]);

  const handleLinkedInFile = useCallback(
    (file: File) => handleFile(file),
    [handleFile]
  );

  const handleYouTubeFileCb = useCallback(
    (file: File) => handleYouTubeFile(file),
    [handleYouTubeFile]
  );

  const toggle = (id: Platform) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const linkedInDataRaw =
    linkedInMetrics && selected.has("linkedin")
      ? aggregatePlatforms([linkedInMetrics], ["linkedin"])
      : [];

  const linkedInDateBounds = useMemo(() => {
    if (!stored?.dailyImpressions?.length && !stored?.posts?.length) return null;
    const dates = [
      ...(stored.dailyImpressions?.map((d) => d.date) ?? []),
      ...(stored.posts?.map((p) => p.date) ?? []),
    ];
    if (dates.length === 0) return null;
    const sorted = [...new Set(dates)].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [stored?.dailyImpressions, stored?.posts]);

  const dataDateBounds = useMemo(() => {
    const linkedIn = linkedInDateBounds;
    const youtubeDates = youtubeStored?.dailyData?.map((d) => d.date) ?? [];
    const yMin = youtubeDates.length ? [...youtubeDates].sort()[0] : null;
    const yMax = youtubeDates.length ? [...youtubeDates].sort().pop() ?? null;
    if (!linkedIn && !yMin) return null;
    const all = [
      linkedIn?.min,
      linkedIn?.max,
      yMin,
      yMax,
    ].filter(Boolean) as string[];
    const sorted = [...new Set(all)].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [linkedInDateBounds, youtubeStored?.dailyData]);

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
    linkedInDateFilter && stored?.posts
      ? stored.posts.filter(
          (p) => p.date >= linkedInDateFilter.from && p.date <= linkedInDateFilter.to
        )
      : stored?.posts ?? [];

  const youtubeData =
    youtubeMetrics && selected.has("youtube")
      ? aggregatePlatforms([youtubeMetrics], ["youtube"])
      : [];

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
        <h1 className="text-3xl font-bold text-chart-green">SocialTrack</h1>
        <p className="mt-2 text-chart-green/70">
          Sign in to track your social media performance
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-chart-green px-4 py-2 font-medium text-chart-dark hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-chart-green px-4 py-2 font-medium text-chart-green hover:bg-chart-dark-card"
          >
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-chart-green">
            SocialTrack
          </h1>
          <p className="mt-1 text-chart-green/70">
            Follower growth & cumulative impressions across your social channels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-chart-green/70">{user.email}</span>
          <button
            onClick={() => logout()}
            className="rounded-lg border border-chart-dark-grid px-3 py-1.5 text-sm text-chart-green/80 hover:bg-chart-dark-card"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mb-6 space-y-4">
        <LinkedInUpload
          onFile={handleLinkedInFile}
          isLoading={isLoading}
          error={error}
          storedPostCount={stored?.posts?.length ?? null}
          storedDateRange={
            stored?.dailyImpressions?.length || stored?.posts?.length
              ? getDateRangeLabel(
                  [...new Set([
                    ...(stored.dailyImpressions?.map((d) => d.date) ?? []),
                    ...(stored.posts?.map((p) => p.date) ?? []),
                  ])].sort()
                )
              : null
          }
          onClear={clear}
        />
        {pendingImport && (
          <LinkedInImportPreview
            pending={pendingImport}
            onApprove={approveImport}
            onReject={rejectImport}
          />
        )}
        <YouTubeUpload
          onFile={handleYouTubeFileCb}
          isLoading={youtubeIsLoading}
          error={youtubeError}
          storedDayCount={youtubeStored?.dailyData?.length ?? null}
          storedDateRange={
            youtubeStored?.dailyData?.length
              ? getDateRangeLabel(
                  youtubeStored.dailyData.map((d) => d.date)
                )
              : null
          }
          onClear={clearYouTube}
        />
        {youtubePendingImport && (
          <YouTubeImportPreview
            pending={youtubePendingImport}
            onApprove={approveYouTubeImport}
            onReject={rejectYouTubeImport}
          />
        )}
      </div>

      <PublicProfileSettings dataDateBounds={dataDateBounds} />

      {availablePlatforms.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {availablePlatforms.map((id) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected.has(id)
                  ? "bg-chart-green text-chart-dark"
                  : "bg-chart-dark-card text-chart-green/70 hover:bg-chart-dark-grid hover:text-chart-green"
              }`}
            >
              {PLATFORM_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      {linkedInDataRaw.length > 0 && linkedInDateBounds && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-chart-dark-grid/50 bg-chart-dark/40 px-4 py-3">
            <span className="text-sm font-medium text-chart-green">Date range:</span>
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
              {linkedInDateBounds.min} – {linkedInDateBounds.max} (imported)
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
                followersByDate={stored?.followersByDate ?? []}
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
            youtubeVideos={youtubeStored?.videos}
            youtubeChartVideos={youtubeStored?.chartVideos}
          />
        </div>
      )}

      {linkedInData.length === 0 && youtubeData.length === 0 && (
        <p className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-8 text-center text-chart-green/70">
          No data yet. Upload your LinkedIn Creator Analytics or YouTube Analytics
          export above to get started.
        </p>
      )}

      {(linkedInData.length > 0 || youtubeData.length > 0) && (
        <p className="mt-6 text-center text-sm text-chart-green/50">
          Upload exports regularly to merge new metrics; duplicates are merged by
          post/date.
        </p>
      )}
    </main>
  );
}
