"use client";

import type { PendingYouTubeImport } from "@/hooks/useYouTubeData";
import { formatCompact, getDateRangeLabel } from "@/lib/aggregate";

interface YouTubeImportPreviewProps {
  pending: PendingYouTubeImport;
  onApprove: () => void;
  onReject: () => void;
}

const MAX_PREVIEW_ROWS = 50;

export function YouTubeImportPreview({
  pending,
  onApprove,
  onReject,
}: YouTubeImportPreviewProps) {
  const { filename, dailyData, videos, chartVideos } = pending;
  const totalViews = dailyData.reduce((sum, d) => sum + d.views, 0);
  const sorted = [...dailyData].sort((a, b) => b.date.localeCompare(a.date));
  const showRows = sorted.slice(0, MAX_PREVIEW_ROWS);
  const hasMore = sorted.length > MAX_PREVIEW_ROWS;
  const sortedVideos = [...videos].sort(
    (a, b) =>
      b.publishedDate.localeCompare(a.publishedDate) || b.viewsTotal - a.viewsTotal
  );
  const showVideos = sortedVideos.slice(0, 20);

  return (
    <div className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-chart-green">
        Review import: {filename}
      </h3>

      <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-chart-dark/60 px-4 py-3">
        <span className="text-chart-green/90">
          <strong className="text-chart-green">{dailyData.length}</strong> daily
          row{dailyData.length !== 1 ? "s" : ""} (Chart data)
        </span>
        <span className="text-chart-green/90">
          <strong className="text-chart-green">{videos.length}</strong> video
          {videos.length !== 1 ? "s" : ""} (Table: subs/totals)
        </span>
        {chartVideos.length > 0 && (
          <span className="text-chart-green/90">
            <strong className="text-chart-green">{chartVideos.length}</strong> per-day
            per-video (Chart)
          </span>
        )}
        <span className="text-chart-green/90">
          <strong className="text-chart-green">
            {formatCompact(totalViews)}
          </strong>{" "}
          total views
        </span>
        {dailyData.length > 0 && (
          <span className="text-chart-green/90">
            Date range:{" "}
            <strong className="text-chart-green">
              {getDateRangeLabel(dailyData.map((d) => d.date))}
            </strong>
          </span>
        )}
      </div>

      <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-chart-dark-grid">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-chart-dark-card">
            <tr className="border-b border-chart-dark-grid">
              <th className="px-3 py-2 text-chart-green/80">Date</th>
              <th className="px-3 py-2 text-right text-chart-green/80">Views</th>
              <th className="px-3 py-2 text-right text-chart-green/80">
                Subscribers gained
              </th>
            </tr>
          </thead>
          <tbody>
            {showRows.map((r, i) => (
              <tr
                key={`${r.date}-${i}`}
                className="border-b border-chart-dark-grid/50"
              >
                <td className="px-3 py-2 text-chart-green/90">{r.date}</td>
                <td className="px-3 py-2 text-right text-chart-green/90">
                  {r.views.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-chart-green/90">
                  {r.subscribersGained.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <p className="px-3 py-2 text-xs text-chart-green/50">
            … and {sorted.length - MAX_PREVIEW_ROWS} more rows
          </p>
        )}
      </div>

      {videos.length > 0 && (
        <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-chart-dark-grid">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-chart-dark-card">
              <tr className="border-b border-chart-dark-grid">
                <th className="px-3 py-2 text-chart-green/80">Video (Table)</th>
                <th className="px-3 py-2 text-chart-green/80">Published</th>
                <th className="px-3 py-2 text-right text-chart-green/80">Total views</th>
                <th className="px-3 py-2 text-right text-chart-green/80">Subs gained</th>
              </tr>
            </thead>
            <tbody>
              {showVideos.map((v, i) => (
                <tr
                  key={`${v.videoId}-${i}`}
                  className="border-b border-chart-dark-grid/50"
                >
                  <td className="max-w-xs truncate px-3 py-2 text-chart-green/90">
                    {v.videoTitle}
                  </td>
                  <td className="px-3 py-2 text-chart-green/90">{v.publishedDate}</td>
                  <td className="px-3 py-2 text-right text-chart-green/90">
                    {v.viewsTotal.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-chart-green/90">
                    {v.subscribersGained.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {videos.length > 20 && (
            <p className="px-3 py-2 text-xs text-chart-green/50">
              … and {videos.length - 20} more videos
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onApprove}
          className="rounded-lg bg-chart-green px-4 py-2 text-sm font-medium text-chart-dark transition-opacity hover:opacity-90"
        >
          Approve & add to chart
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded-lg border border-chart-dark-grid px-4 py-2 text-sm font-medium text-chart-green/80 transition-colors hover:bg-chart-dark-grid hover:text-chart-green"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
