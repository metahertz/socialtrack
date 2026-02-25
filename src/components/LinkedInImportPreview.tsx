"use client";

import type { PendingImport } from "@/hooks/useLinkedInData";
import { formatCompact } from "@/lib/aggregate";

interface LinkedInImportPreviewProps {
  pending: PendingImport;
  onApprove: () => void;
  onReject: () => void;
}

const MAX_PREVIEW_ROWS = 50;

export function LinkedInImportPreview({
  pending,
  onApprove,
  onReject,
}: LinkedInImportPreviewProps) {
  const { filename, dailyImpressions, posts, followersByDate, dateRange } = pending;
  const totalImpressions = dailyImpressions.reduce((sum, d) => sum + d.impressions, 0);
  const followerCount = followersByDate.size;
  const sortedPosts = [...posts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.impressions - a.impressions
  );
  const showPosts = sortedPosts.slice(0, MAX_PREVIEW_ROWS);
  const hasMore = sortedPosts.length > MAX_PREVIEW_ROWS;

  const truncate = (s: string, len: number) =>
    s.length <= len ? s : s.slice(0, len) + "…";

  return (
    <div className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-chart-green">
        Review import: {filename}
      </h3>

      <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-chart-dark/60 px-4 py-3">
        <span className="text-chart-green/90">
          <strong className="text-chart-green">{dailyImpressions.length}</strong> daily
          impression{dailyImpressions.length !== 1 ? "s" : ""} (ENGAGEMENT)
        </span>
        <span className="text-chart-green/90">
          <strong className="text-chart-green">{posts.length}</strong> post
          {posts.length !== 1 ? "s" : ""} (TOP POSTS)
        </span>
        <span className="text-chart-green/90">
          <strong className="text-chart-green">
            {formatCompact(totalImpressions)}
          </strong>{" "}
          total impressions
        </span>
        {followerCount > 0 && (
          <span className="text-chart-green/90">
            <strong className="text-chart-green">{followerCount}</strong> follower
            data point{followerCount !== 1 ? "s" : ""}
          </span>
        )}
        {dateRange && (
          <span className="text-chart-green/90">
            Date range:{" "}
            <strong className="text-chart-green">
              {dateRange.start} → {dateRange.end}
            </strong>
          </span>
        )}
      </div>

      <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-chart-dark-grid">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-chart-dark-card">
            <tr className="border-b border-chart-dark-grid">
              <th className="px-3 py-2 text-chart-green/80">Date</th>
              <th className="px-3 py-2 text-right text-chart-green/80">
                Impressions
              </th>
              <th className="px-3 py-2 text-chart-green/80">Post</th>
            </tr>
          </thead>
          <tbody>
            {showPosts.map((p, i) => (
              <tr
                key={`${p.postId}-${i}`}
                className="border-b border-chart-dark-grid/50"
              >
                <td className="px-3 py-2 text-chart-green/90">{p.date}</td>
                <td className="px-3 py-2 text-right text-chart-green/90">
                  {p.impressions.toLocaleString()}
                </td>
                <td className="max-w-xs px-3 py-2 text-chart-green/70">
                  {truncate(p.postContent || "—", 60)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <p className="px-3 py-2 text-xs text-chart-green/50">
            … and {sortedPosts.length - MAX_PREVIEW_ROWS} more posts
          </p>
        )}
      </div>

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
