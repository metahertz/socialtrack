"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AggregatedMetrics } from "@/types/social";
import { formatCompact, getDateRangeLabel } from "@/lib/aggregate";
import type { YouTubeVideoRow, YouTubeChartVideoRow } from "@/lib/youtubeImport";

const CHART_GREEN = "#6EE7B7";
const CHART_WHITE = "#E5E7EB";
const DARK_CARD = "#1C302B";
const DARK_GRID = "#2D4A42";

/** Distinct colors for per-video lines */
const VIDEO_COLORS = [
  "#6EE7B7", "#F472B6", "#A78BFA", "#FBBF24", "#34D399",
  "#F87171", "#60A5FA", "#C084FC", "#4ADE80", "#FB923C",
];

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${parseInt(m, 10)}/${parseInt(day, 10)}/${y}`;
}

interface SocialPerformanceChartProps {
  data: AggregatedMetrics[];
  platform: "linkedin" | "youtube";
  title?: string;
  youtubeVideos?: YouTubeVideoRow[];
  youtubeChartVideos?: YouTubeChartVideoRow[];
}

/** Build per-video cumulative views from publish date. Returns data with video_${id} keys. */
function buildYouTubePerVideoData(
  data: AggregatedMetrics[],
  videos: YouTubeVideoRow[],
  chartVideos: YouTubeChartVideoRow[]
): { chartData: Record<string, unknown>[]; videoSeries: { id: string; title: string; color: string }[] } {
  const byVideo = new Map<string, YouTubeChartVideoRow[]>();
  for (const cv of chartVideos) {
    const id = cv.videoId || cv.videoTitle;
    const list = byVideo.get(id) ?? [];
    list.push(cv);
    byVideo.set(id, list);
  }
  for (const list of byVideo.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const videoMeta = new Map<string, { title: string; publishedDate: string }>();
  for (const v of videos) {
    const id = v.videoId || v.videoTitle;
    videoMeta.set(id, { title: v.videoTitle, publishedDate: v.publishedDate });
  }

  const videoSeries: { id: string; title: string; color: string }[] = [];
  const seriesByVideo = new Map<string, Map<string, number>>();

  videos.forEach((v, idx) => {
    const id = v.videoId || v.videoTitle;
    const meta = videoMeta.get(id);
    if (!meta) return;
    const rows = byVideo.get(id) ?? [];
    const cumByDate = new Map<string, number>();
    for (const r of rows) {
      if (r.date >= meta.publishedDate) {
        cumByDate.set(r.date, r.views);
      }
    }
    seriesByVideo.set(id, cumByDate);
    videoSeries.push({
      id,
      title: v.videoTitle,
      color: VIDEO_COLORS[idx % VIDEO_COLORS.length],
    });
  });

  const chartData = data.map((row) => {
    const out: Record<string, unknown> = { ...row };
    let maxCum = 0;
    for (const { id } of videoSeries) {
      const cumMap = seriesByVideo.get(id);
      const val = cumMap?.get(row.date);
      if (val !== undefined) {
        (out as Record<string, number>)[`video_${id}`] = val;
        maxCum = Math.max(maxCum, val);
      }
    }
    (out as Record<string, number>).diamondY = row.postPublished ? maxCum : 0;
    return out;
  });

  return { chartData, videoSeries };
}

export function SocialPerformanceChart({
  data,
  platform,
  title = "Follower Growth & Impressions",
  youtubeVideos = [],
  youtubeChartVideos = [],
}: SocialPerformanceChartProps) {
  if (data.length === 0) return null;

  const useCumulative = platform === "linkedin";
  const isYouTube = platform === "youtube";
  const hasPerVideo = isYouTube && youtubeVideos.length > 0 && youtubeChartVideos.length > 0;

  const { chartData, videoSeries } = useMemo(() => {
    if (!hasPerVideo) return { chartData: data, videoSeries: [] as { id: string; title: string; color: string }[] };
    return buildYouTubePerVideoData(data, youtubeVideos, youtubeChartVideos);
  }, [data, hasPerVideo, youtubeVideos, youtubeChartVideos]);

  const dataKey = useCumulative ? "cumulativeImpressions" : "dailyImpressions";
  const lineName = useCumulative ? "Cumulative Impressions" : "Views per day";

  const dates = data.map((d) => d.date);
  const totalImpressions = useMemo(() => {
    if (hasPerVideo && youtubeVideos.length > 0) {
      return youtubeVideos.reduce((s, v) => s + v.viewsTotal, 0);
    }
    return useCumulative
      ? (data[data.length - 1]?.cumulativeImpressions ?? 0)
      : data.reduce((s, d) => s + (d.dailyImpressions ?? 0), 0);
  }, [hasPerVideo, youtubeVideos, data, useCumulative]);
  const startFollowers = data[0]?.followers ?? 0;
  const endFollowers = data[data.length - 1]?.followers ?? 0;
  const growth = endFollowers - startFollowers;
  const dateRange = getDateRangeLabel(dates);

  const shouldHighlight = (payload: AggregatedMetrics) =>
    useCumulative || isYouTube ? !!payload.postPublished : (payload.dailyImpressions ?? 0) > 0;

  const DiamondDot = (props: { cx?: number; cy?: number; payload?: AggregatedMetrics }) => {
    const { cx, cy, payload } = props;
    if (!payload || !shouldHighlight(payload) || cx == null || cy == null) return null;
    return (
      <g transform={`translate(${cx},${cy})`}>
        <polygon
          points="0,-6 6,0 0,6 -6,0"
          fill={CHART_GREEN}
          stroke="none"
        />
      </g>
    );
  };

  return (
    <div className="rounded-xl bg-chart-dark-card p-6 shadow-xl border border-chart-dark-grid/50">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-chart-green">{title}</h2>
        <p className="mt-1 text-sm text-chart-green/80">
          {dateRange}
          {useCumulative
            ? " • Diamonds mark post dates"
            : isYouTube
              ? " • Diamonds mark video publish dates"
              : " • Diamonds mark days with views"}
          {" • "}Hover for details
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-6 rounded-lg bg-chart-dark/60 px-4 py-3">
        <span className="text-chart-green/90">
          {useCumulative ? "Total impressions" : "Total views"}{" "}
          <strong className="text-chart-green">{formatCompact(totalImpressions)}</strong>
        </span>
        <span className="text-chart-green/90">
          Followers{" "}
          <strong className="text-chart-green">
            {formatCompact(startFollowers)} → {formatCompact(endFollowers)}
          </strong>
        </span>
        <span className="text-chart-green/90">
          Growth{" "}
          <strong className="text-chart-green">
            {growth >= 0 ? "+" : ""}
            {growth}
          </strong>
        </span>
      </div>

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 50, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={DARK_GRID}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke={CHART_WHITE}
              tick={{ fill: CHART_WHITE, fontSize: 12 }}
              axisLine={{ stroke: DARK_GRID }}
              tickLine={{ stroke: DARK_GRID }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke={CHART_GREEN}
              tick={{ fill: CHART_GREEN, fontSize: 11 }}
              axisLine={{ stroke: DARK_GRID }}
              tickLine={{ stroke: DARK_GRID }}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              label={{
                value: hasPerVideo ? "Cumulative views" : lineName,
                angle: -90,
                position: "insideLeft",
                fill: CHART_GREEN,
                fontSize: 12,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={CHART_WHITE}
              tick={{ fill: CHART_WHITE, fontSize: 11 }}
              axisLine={{ stroke: DARK_GRID }}
              tickLine={{ stroke: DARK_GRID }}
              label={{
                value: "Followers",
                angle: 90,
                position: "insideRight",
                fill: CHART_WHITE,
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: DARK_CARD,
                border: `1px solid ${DARK_GRID}`,
                borderRadius: "8px",
                maxWidth: 360,
              }}
              labelStyle={{ color: CHART_GREEN }}
              itemStyle={{ color: CHART_WHITE }}
              labelFormatter={(label) => formatDate(label)}
              formatter={(value: number, name: string) => {
                if (name === "diamondY") return [null, null];
                if (name === "dailyImpressions")
                  return [formatCompact(value), "Views per day"];
                if (name === "cumulativeImpressions")
                  return [formatCompact(value), "Cumulative Impressions"];
                if (name === "followers") return [value.toLocaleString(), "Followers"];
                if (name.startsWith("video_")) {
                  const vid = videoSeries.find((v) => `video_${v.id}` === name);
                  return [formatCompact(value), vid?.title ?? name];
                }
                return [value, name];
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length || !label) return null;
                const item = payload[0]?.payload as {
                  date: string;
                  dailyImpressions?: number;
                  cumulativeImpressions?: number;
                  followers: number;
                  postPublished?: boolean;
                  postsOnDate?: Array<{ content: string; impressions: number; contentType?: "post" | "comment" | "repost" | "likely_repost" }>;
                };
                const postsOnDate = item?.postsOnDate;
                return (
                  <div className="rounded-lg border border-chart-dark-grid bg-chart-dark-card p-3">
                    <p className="mb-2 font-medium text-chart-green">
                      {formatDate(label)}
                    </p>
                    {payload
                      .filter((entry) => entry.name !== "diamondY")
                      .map((entry) => (
                        <p key={entry.name} className="text-sm text-chart-white/90">
                          {entry.name}:{" "}
                          {typeof entry.value === "number"
                            ? entry.value >= 1000
                              ? formatCompact(entry.value)
                              : entry.value.toLocaleString()
                            : entry.value}
                        </p>
                      ))}
                    {postsOnDate && postsOnDate.length > 0 && (
                      <div className="mt-2 border-t border-chart-dark-grid pt-2">
                        <p className="mb-1 text-xs font-medium text-chart-green/80">
                          {isYouTube ? "Video published" : "Posts & comments this day"}:
                        </p>
                        {postsOnDate.map((p, i) => {
                          const isComment = p.contentType === "comment";
                          const isRepost = p.contentType === "repost";
                          const isLikelyRepost = p.contentType === "likely_repost";
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
                            <div
                              key={i}
                              className="text-xs text-chart-white/70"
                              title={p.content}
                            >
                              {!isYouTube && (
                                <span className={`mr-1.5 font-medium ${typeColor}`}>
                                  [{typeLabel}]
                                </span>
                              )}
                              <span className="line-clamp-2">{p.content}</span>
                              {p.impressions > 0 && (
                                <span className={typeColor}>
                                  {" "}
                                  — {p.impressions.toLocaleString()} views
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => (
                <span className="text-chart-green/90 text-sm">{value}</span>
              )}
              iconType="line"
            />
            {hasPerVideo ? (
              videoSeries.map(({ id, title, color }) => (
                <Line
                  key={id}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`video_${id}`}
                  name={title}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: color }}
                  connectNulls
                />
              ))
            ) : (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={dataKey}
                name={lineName}
                stroke={CHART_GREEN}
                strokeWidth={2}
                dot={<DiamondDot />}
                activeDot={{ r: 4, fill: CHART_GREEN }}
              />
            )}
            {hasPerVideo && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="diamondY"
                stroke="none"
                dot={<DiamondDot />}
                isAnimationActive={false}
                legendType="none"
                hide
              />
            )}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="followers"
              name="Followers"
              stroke={CHART_WHITE}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: CHART_WHITE }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-8 text-sm text-chart-green/80">
        {!hasPerVideo && (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-6 rounded"
              style={{ backgroundColor: CHART_GREEN }}
            />
            {lineName}
          </span>
        )}
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-6 rounded border border-dashed border-chart-green/80"
            style={{ backgroundColor: "transparent" }}
          />
          Followers
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rotate-45"
            style={{ backgroundColor: CHART_GREEN }}
          />
          {useCumulative ? "Post published" : isYouTube ? "Video published" : "Day with views"}
        </span>
      </div>
    </div>
  );
}
