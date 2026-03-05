"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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

function CopyableUrl({ url }: { url?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select and copy
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [url]);

  if (!url) return <span className="text-chart-slate">—</span>;
  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-[280px] truncate text-chart-blue hover:underline"
        title={url}
      >
        {url}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded border border-chart-dark-grid px-2 py-0.5 text-xs text-chart-green/80 hover:bg-chart-dark-card hover:text-chart-green"
        title="Copy URL"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function needsTitleFetch(post: LinkedInPostRow): boolean {
  return !!post.postUrl && (!post.postContent || /^Post\s+/i.test(post.postContent));
}

function isUrlLike(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith("http") || t.includes("linkedin.com") || t.includes("urn:li:");
}

function contentForLabel(displayContent: string, datePart: string): string {
  if (!displayContent || displayContent === "—") return "—";
  if (isUrlLike(displayContent)) return "Post";
  if (displayContent.match(/https?:\/\/[^\s]+|urn:li:activity:\d+/i)) return "Post";
  return displayContent;
}

function extractUrlFromText(text: string): string | undefined {
  const match = text.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/[^\s<>"']+|urn:li:activity:\d+/i
  );
  return match ? match[0].trim() : undefined;
}

type LinkedInPostType = "video" | "repost" | "post" | "processing";

async function fetchTitleAndType(
  url: string
): Promise<{ title: string | null; postType?: LinkedInPostType }> {
  try {
    const res = await fetch("/api/fetch-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return { title: null };
    const json = await res.json();
    return {
      title: json.title ?? null,
      postType: json.postType ?? "post",
    };
  } catch {
    return { title: null };
  }
}

interface LinkedInPostsChartProps {
  posts: LinkedInPostRow[];
  followersByDate: Array<{ date: string; count: number }>;
}

type SortKey = "rank" | "url" | "type" | "impressions" | "impressionsPct" | "followersPct" | "engagementRate";

type ChartDataRow = {
  rank: number;
  postId: string;
  rowId: string;
  postUrl?: string;
  label: string;
  dateTime: string;
  postContent: string;
  postType: LinkedInPostType;
  impressions: number;
  impressionsPct: number;
  followersPct: number;
  engagements?: number;
  engagementRate: number | null;
};

const POST_TYPE_COLORS: Record<LinkedInPostType, string> = {
  video: "#60A5FA",
  repost: "#FBBF24",
  post: CHART_GREEN,
  processing: "#94A3B8",
};

function SortablePostsTable({ data }: { data: ChartDataRow[] }) {
  const [sortState, setSortState] = useState<{ sortBy: SortKey; sortDir: "asc" | "desc" }>({
    sortBy: "impressions",
    sortDir: "desc",
  });

  const handleSort = useCallback((key: SortKey) => {
    setSortState((prev) => {
      if (prev.sortBy === key) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" };
      }
      const defaultDesc = ["impressions", "impressionsPct", "followersPct", "engagementRate"].includes(key);
      return { sortBy: key, sortDir: defaultDesc ? "desc" : "asc" };
    });
  }, []);

  const sortedData = useMemo(() => {
    const { sortBy, sortDir } = sortState;
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "url":
          cmp = (a.postUrl ?? "").localeCompare(b.postUrl ?? "");
          break;
        case "type":
          cmp = a.postType.localeCompare(b.postType);
          break;
        case "impressions":
          cmp = a.impressions - b.impressions;
          break;
        case "impressionsPct":
          cmp = a.impressionsPct - b.impressionsPct;
          break;
        case "followersPct":
          cmp = a.followersPct - b.followersPct;
          break;
        case "engagementRate":
          cmp = (a.engagementRate ?? -1) - (b.engagementRate ?? -1);
          break;
      }
      if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
      return a.rowId.localeCompare(b.rowId);
    });
  }, [data, sortState]);

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-chart-dark-grid/50 bg-chart-dark/40">
      <h3 className="border-b border-chart-dark-grid/50 px-4 py-3 text-sm font-medium text-chart-green">
        Posts table — copy URLs for further investigation
      </h3>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-chart-dark-grid/50 text-left text-chart-green/80">
            <SortHeader label="#" sortKey="rank" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="LinkedIn URL" sortKey="url" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="Type" sortKey="type" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="Impressions" sortKey="impressions" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="% total" sortKey="impressionsPct" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="% reach" sortKey="followersPct" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
            <SortHeader label="Eng. rate" sortKey="engagementRate" currentSort={sortState.sortBy} sortDir={sortState.sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={row.rowId}
              className="border-b border-chart-dark-grid/30 hover:bg-chart-dark-card/30"
            >
              <td className="px-4 py-2 text-chart-green/90">{row.rank}</td>
              <td className="px-4 py-2">
                <CopyableUrl url={row.postUrl} />
              </td>
              <td className="px-4 py-2">
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${POST_TYPE_COLORS[row.postType]}33`,
                    color: POST_TYPE_COLORS[row.postType],
                  }}
                >
                  {row.postType}
                </span>
              </td>
              <td className="px-4 py-2 text-chart-green/90">
                {formatCompact(row.impressions)}
              </td>
              <td className="px-4 py-2 text-chart-green/90">
                {row.impressionsPct.toFixed(1)}%
              </td>
              <td className="px-4 py-2 text-chart-green/90">
                {row.followersPct > 0 ? `${row.followersPct.toFixed(1)}%` : "—"}
              </td>
              <td className="px-4 py-2 text-chart-green/90">
                {row.engagementRate != null
                  ? `${row.engagementRate.toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey | null;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  const handleClick = useCallback(() => {
    onSort(sortKey);
  }, [onSort, sortKey]);
  return (
    <th className="px-4 py-2 text-left font-medium text-chart-green/80">
      <button
        type="button"
        className="flex w-full cursor-pointer select-none items-center gap-1 text-left hover:bg-chart-dark-card/50 hover:text-chart-green"
        onClick={handleClick}
      >
        {label}
        {isActive && (
          <span className="text-chart-green" title={sortDir === "asc" ? "Ascending (click to toggle)" : "Descending (click to toggle)"}>
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

export function LinkedInPostsChart({
  posts,
  followersByDate,
}: LinkedInPostsChartProps) {
  const [titlesByPostId, setTitlesByPostId] = useState<Record<string, string>>({});
  const [postTypesByPostId, setPostTypesByPostId] = useState<
    Record<string, LinkedInPostType>
  >({});

  useEffect(() => {
    const toFetch = posts.filter((p) => p.postUrl);
    if (toFetch.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const post of toFetch) {
        if (cancelled) return;
        const { title, postType } = await fetchTitleAndType(post.postUrl!);
        if (cancelled) return;
        setTitlesByPostId((prev) =>
          title ? { ...prev, [post.postId]: title } : prev
        );
        setPostTypesByPostId((prev) => ({
          ...prev,
          [post.postId]: postType ?? "post",
        }));
        await new Promise((r) => setTimeout(r, 150));
      }
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
        const safeContent = contentForLabel(displayContent, datePart);
        const contentPreview =
          safeContent.length > 30
            ? safeContent.slice(0, 30) + "…"
            : safeContent;
        const resolvedUrl =
          p.postUrl ??
          extractUrlFromText(displayContent) ??
          extractUrlFromText(p.postContent ?? "");
        const postType: LinkedInPostType =
          postTypesByPostId[p.postId] ?? (p.postUrl ? "processing" : "post");
        return {
          rank: i + 1,
          postId: p.postId,
          rowId: `${p.postId}:${p.date}`,
          postUrl: resolvedUrl || undefined,
          label: `${datePart} · ${contentPreview || "—"}`,
          dateTime: formatDateWithTime(p),
          postContent: displayContent,
          postType,
          impressions: p.impressions,
          impressionsPct,
          followersPct,
          engagements: p.engagements,
          engagementRate,
        };
      });

    return {
      chartData: ranked,
      totalImpressions,
      totalFollowers,
    };
  }, [posts, followersByDate, titlesByPostId, postTypesByPostId]);

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
          total impressions · Hover for details
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-chart-green/70">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: POST_TYPE_COLORS.processing }}
            />
            processing
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: POST_TYPE_COLORS.post }}
            />
            post
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: POST_TYPE_COLORS.video }}
            />
            video
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: POST_TYPE_COLORS.repost }}
            />
            repost
          </span>
        </div>
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
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof chartData)[0];
                if (!row) return null;
                return (
                  <div className="rounded-lg border border-chart-dark-grid bg-chart-dark-card p-3">
                    <p className="mb-2 font-medium text-chart-green">
                      #{row.rank} · {row.dateTime}
                      {row.postType !== "post" && (
                        <span
                          className="ml-2 rounded px-1.5 py-0.5 text-xs text-chart-dark/90"
                          style={{
                            backgroundColor: POST_TYPE_COLORS[row.postType],
                          }}
                        >
                          {row.postType}
                        </span>
                      )}
                    </p>
                    <p className="mb-2 line-clamp-3 text-sm text-chart-green/90">
                      {row.postContent}
                    </p>
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
              {chartData.map((row, i) => (
                <Cell key={row.rowId} fill={POST_TYPE_COLORS[row.postType]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SortablePostsTable data={chartData} />
    </div>
  );
}
