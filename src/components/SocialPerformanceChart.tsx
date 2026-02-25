"use client";

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

const CHART_GREEN = "#6EE7B7";
const CHART_WHITE = "#E5E7EB";
const DARK_CARD = "#1C302B";
const DARK_GRID = "#2D4A42";

function formatDate(d: string) {
  const [_, m, day] = d.split("-");
  return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
}

interface SocialPerformanceChartProps {
  data: AggregatedMetrics[];
  title?: string;
}

export function SocialPerformanceChart({
  data,
  title = "Follower Growth & Cumulative Impressions",
}: SocialPerformanceChartProps) {
  if (data.length === 0) return null;

  const dates = data.map((d) => d.date);
  const totalImpressions = data[data.length - 1]?.cumulativeImpressions ?? 0;
  const startFollowers = data[0]?.followers ?? 0;
  const endFollowers = data[data.length - 1]?.followers ?? 0;
  const growth = endFollowers - startFollowers;
  const dateRange = getDateRangeLabel(dates);

  const DiamondDot = (props: { cx?: number; cy?: number; payload?: AggregatedMetrics }) => {
    const { cx, cy, payload } = props;
    if (!payload?.postPublished || cx == null || cy == null) return null;
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
          {dateRange} • Diamonds mark post dates • Hover for details
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-6 rounded-lg bg-chart-dark/60 px-4 py-3">
        <span className="text-chart-green/90">
          Total impressions <strong className="text-chart-green">{formatCompact(totalImpressions)}</strong>
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
            data={data}
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
                value: "Cumulative Impressions",
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
                if (name === "cumulativeImpressions")
                  return [formatCompact(value), "Cumulative Impressions"];
                if (name === "followers") return [value.toLocaleString(), "Followers"];
                return [value, name];
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length || !label) return null;
                const item = payload[0]?.payload as {
                  date: string;
                  cumulativeImpressions: number;
                  followers: number;
                  postPublished?: boolean;
                  postsOnDate?: Array<{ content: string; impressions: number }>;
                };
                const postsOnDate = item?.postsOnDate;
                return (
                  <div className="rounded-lg border border-chart-dark-grid bg-chart-dark-card p-3">
                    <p className="mb-2 font-medium text-chart-green">
                      {formatDate(label)}
                    </p>
                    {payload.map((entry) => (
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
                          Posts this day:
                        </p>
                        {postsOnDate.map((p, i) => (
                          <div
                            key={i}
                            className="text-xs text-chart-white/70"
                            title={p.content}
                          >
                            <span className="line-clamp-2">{p.content}</span>
                            <span className="text-chart-green">
                              {" "}
                              — {p.impressions.toLocaleString()} impressions
                            </span>
                          </div>
                        ))}
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
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cumulativeImpressions"
              name="Cumulative Impressions"
              stroke={CHART_GREEN}
              strokeWidth={2}
              dot={<DiamondDot />}
              activeDot={{ r: 4, fill: CHART_GREEN }}
            />
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

      <div className="mt-2 flex justify-center gap-8 text-sm text-chart-green/80">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-6 rounded"
            style={{ backgroundColor: CHART_GREEN }}
          />
          Cumulative Impressions
        </span>
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
          Post published
        </span>
      </div>
    </div>
  );
}
