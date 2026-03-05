"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { LinkedInPostRow } from "@/lib/linkedinImport";
import { formatCompact } from "@/lib/aggregate";

const CHART_GREEN = "#6EE7B7";
const CHART_AMBER = "#FBBF24";
const CHART_BLUE = "#60A5FA";
const CHART_SLATE = "#94A3B8";
const DARK_CARD = "#1C302B";
const DARK_GRID = "#2D4A42";

function getFollowersAtDate(
  followersByDate: Array<{ date: string; count: number }>,
  date: string
): number {
  const sorted = [...followersByDate].sort((a, b) => b.date.localeCompare(a.date));
  const exact = sorted.find((f) => f.date === date);
  if (exact) return exact.count;
  const prior = sorted.find((f) => f.date <= date);
  return prior?.count ?? 0;
}

function formatDateWithTime(post: LinkedInPostRow): string {
  if (post.dateTime) return post.dateTime;
  const [y, m, d] = post.date.split("-");
  if (y && m && d) {
    return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
  }
  return post.date;
}

function needsTitleFetch(post: LinkedInPostRow): boolean {
  return !!post.postUrl && (!post.postContent || /^Post\s+/i.test(post.postContent));
}

async function fetchTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch("/api/fetch-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.title ?? null;
  } catch {
    return null;
  }
}

interface LinkedInPostsChartProps {
  posts: LinkedInPostRow[];
  followersByDate: Array<{ date: string; count: number }>;
  onConfirmRepost?: (postId: string) => Promise<boolean>;
}

export function LinkedInPostsChart({
  posts,
  followersByDate,
  onConfirmRepost,
}: LinkedInPostsChartProps) {
  const [titlesByPostId, setTitlesByPostId] = useState<Record<string, string>>({});

  useEffect(() => {
    const toFetch = posts.filter(needsTitleFetch);
    if (toFetch.length === 0) return;
    let cancelled = false;
    const run = async () => {
      const next: Record<string, string> = {};
      for (const post of toFetch) {
        if (cancelled) return;
        const title = await fetchTitle(post.postUrl!);
        if (cancelled) return;
        if (title) next[post.postId] = title;
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setTitlesByPostId((prev) => ({ ...prev, ...next }));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [posts]);

  const { chartData, totalImpressions, totalFollowers } = useMemo(() => {
    const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
    const sortedByDate = [...followersByDate].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const totalFollowers =
      sortedByDate.length > 0 ? sortedByDate[0].count : 0;

    const ranked = [...posts]
      .sort((a, b) => b.impressions - a.impressions)
      .map((p, i) => {
        const followersAtDate = getFollowersAtDate(followersByDate, p.date);
        const impressionsPct =
          totalImpressions > 0
            ? (p.impressions / totalImpressions) * 100
            : 0;
        const followersPct =
          followersAtDate > 0
            ? (p.impressions / followersAtDate) * 100
            : 0;
        const engagementRate =
          p.impressions > 0 && p.engagements != null
            ? (p.engagements / p.impressions) * 100
            : null;

        const displayContent =
          titlesByPostId[p.postId] ?? p.postContent ?? "—";
        const datePart = formatDateWithTime(p).split(" ")[0];
        const contentPreview =
          displayContent.length > 30
            ? displayContent.slice(0, 30) + "…"
            : displayContent;
        return {
          rank: i + 1,
          postId: p.postId,
          label: `${datePart} · ${contentPreview || "—"}`,
          dateTime: formatDateWithTime(p),
          postContent: displayContent,
          impressions: p.impressions,
          impressionsPct,
          followersPct,
          engagements: p.engagements,
          engagementRate,
          contentType: p.contentType ?? "post",
        };
      });

    return {
      chartData: ranked,
      totalImpressions,
      totalFollowers,
    };
  }, [posts, followersByDate, titlesByPostId]);

  if (chartData.length === 0) return null;

  const medianImpressions =
    chartData.length > 0
      ? chartData[Math.floor(chartData.length / 2)]?.impressions ?? 0
      : 0;
  const top5Impressions = chartData
    .slice(0, 5)
    .reduce((s, p) => s + p.impressions, 0);
  const top5Pct =
    totalImpressions > 0 ? (top5Impressions / totalImpressions) * 100 : 0;
  const topPost = chartData[0];

  return (
    <div className="rounded-xl border border-chart-dark-grid/50 bg-chart-dark-card p-6 shadow-xl">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-chart-green">
          Posts Ranked by Impressions
        </h2>
        <p className="mt-1 text-sm text-chart-green/80">
          {chartData.length} item{chartData.length !== 1 ? "s" : ""} · Bar = % of
          total impressions ·{" "}
          <span className="text-chart-green">Posts</span> /{" "}
          <span className="text-chart-amber">Comments</span> /{" "}
          <span className="text-chart-blue">Reposts</span> /{" "}
          <span className="text-chart-slate">Likely Repost</span> · Hover for details
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-6 rounded-lg bg-chart-dark/60 px-4 py-3">
        <span className="text-chart-green/90">
          Total{" "}
          <strong className="text-chart-green">
            {formatCompact(totalImpressions)}
          </strong>{" "}
          imp
        </span>
        {topPost && (
          <span className="text-chart-green/90">
            Top post{" "}
            <strong className="text-chart-green">
              {formatCompact(topPost.impressions)} imp
            </strong>{" "}
            ({topPost.dateTime.split(" ")[0]})
          </span>
        )}
        <span className="text-chart-green/90">
          Median{" "}
          <strong className="text-chart-green">
            {formatCompact(medianImpressions)}
          </strong>{" "}
          imp
        </span>
        <span className="text-chart-green/90">
          Top 5 ={" "}
          <strong className="text-chart-green">{top5Pct.toFixed(1)}%</strong> of
          total
        </span>
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 80 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={DARK_GRID}
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke="#E5E7EB"
              tick={{ fill: "#E5E7EB", fontSize: 11 }}
              axisLine={{ stroke: DARK_GRID }}
              tickLine={{ stroke: DARK_GRID }}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              domain={[0, "auto"]}
              label={{
                value: "% of total impressions",
                position: "insideBottom",
                offset: -50,
                fill: CHART_GREEN,
                fontSize: 12,
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={180}
              stroke={CHART_GREEN}
              tick={{ fill: CHART_GREEN, fontSize: 10 }}
              axisLine={{ stroke: DARK_GRID }}
              tickLine={{ stroke: DARK_GRID }}
              tickFormatter={(_, i) => {
                const row = chartData[i];
                return row ? `#${row.rank} ${row.label}` : "";
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: DARK_CARD,
                border: `1px solid ${DARK_GRID}`,
                borderRadius: "8px",
                maxWidth: 400,
              }}
              labelStyle={{ color: CHART_GREEN }}
              formatter={(value: number, name: string) => {
                if (name === "impressionsPct")
                  return [`${value.toFixed(2)}%`, "% of total impressions"];
                if (name === "followersPct")
                  return [`${value.toFixed(2)}%`, "% of followers (reach)"];
                return [value, name];
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof chartData)[0];
                if (!row) return null;
                const isComment = row.contentType === "comment";
                const isRepost = row.contentType === "repost";
                const isLikelyRepost = row.contentType === "likely_repost";
                const typeColor = isComment
                  ? "text-chart-amber"
                  : isRepost
                    ? "text-chart-blue"
                    : isLikelyRepost
                      ? "text-chart-slate"
                      : "text-chart-green";
                const typeLabel = isComment
                  ? "Comment"
                  : isRepost
                    ? "Repost"
                    : isLikelyRepost
                      ? "Likely Repost"
                      : "Post";
                return (
                  <div className="rounded-lg border border-chart-dark-grid bg-chart-dark-card p-3">
                    <p className={`mb-2 font-medium ${typeColor}`}>
                      #{row.rank} · [{typeLabel}] · {row.dateTime}
                    </p>
                    <p className="mb-2 line-clamp-3 text-sm text-chart-green/90">
                      {row.postContent}
                    </p>
                    {isLikelyRepost && onConfirmRepost && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmRepost(row.postId);
                        }}
                        className="mb-2 rounded border border-chart-blue/50 bg-chart-blue/10 px-2 py-1 text-xs text-chart-blue hover:bg-chart-blue/20"
                      >
                        Confirm as repost
                      </button>
                    )}
                    <div className="space-y-1 text-sm text-chart-green/80">
                      <p>
                        <strong>{formatCompact(row.impressions)}</strong>{" "}
                        impressions
                      </p>
                      <p>
                        <strong>{row.impressionsPct.toFixed(2)}%</strong> of
                        total impressions
                      </p>
                      {row.followersPct > 0 && (
                        <p>
                          <strong>{row.followersPct.toFixed(2)}%</strong> of
                          followers (reach)
                        </p>
                      )}
                      {row.engagementRate != null && (
                        <p>
                          <strong>{row.engagementRate.toFixed(1)}%</strong>{" "}
                          engagement rate
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="impressionsPct" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.postId}
                  fill={
                    entry.contentType === "comment"
                      ? CHART_AMBER
                      : entry.contentType === "repost"
                        ? CHART_BLUE
                        : entry.contentType === "likely_repost"
                          ? CHART_SLATE
                          : CHART_GREEN
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {onConfirmRepost && (() => {
        const likelyReposts = chartData.filter((d) => d.contentType === "likely_repost");
        if (likelyReposts.length === 0) return null;
        return (
          <div className="mt-4 rounded-lg border border-chart-dark-grid bg-chart-dark/40 p-4">
            <h3 className="mb-3 text-sm font-medium text-chart-slate">
              Review Likely Reposts ({likelyReposts.length})
            </h3>
            <p className="mb-3 text-xs text-chart-green/70">
              These were flagged as possible reposts (short content or only hashtags). Confirm to mark as repost.
            </p>
            <ul className="space-y-2">
              {likelyReposts.map((row) => (
                <li
                  key={row.postId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-chart-dark-grid/50 bg-chart-dark-card/50 px-3 py-2"
                >
                  <span className="line-clamp-2 flex-1 text-sm text-chart-green/90">
                    {row.postContent}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-chart-slate">
                      {formatCompact(row.impressions)} imp
                    </span>
                    <button
                      type="button"
                      onClick={() => onConfirmRepost(row.postId)}
                      className="rounded border border-chart-blue/50 bg-chart-blue/10 px-2 py-1 text-xs text-chart-blue hover:bg-chart-blue/20"
                    >
                      Confirm repost
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
