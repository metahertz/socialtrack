import type { PlatformMetrics, AggregatedMetrics, PostOnDate } from "@/types/social";

/**
 * Forward-fill a platform's daily data to cover full date range.
 */
function fillPlatformDates(
  dailyData: {
    date: string;
    impressions: number;
    followers: number;
    postPublished?: boolean;
    postsOnDate?: PostOnDate[];
  }[],
  allDates: string[]
): Map<string, { impressions: number; followers: number; postPublished: boolean; postsOnDate?: PostOnDate[] }> {
  const byDate = new Map(
    dailyData.map((d) => [d.date, { ...d, postPublished: d.postPublished ?? false }])
  );
  let lastFollowers = 0;
  const result = new Map<
    string,
    { impressions: number; followers: number; postPublished: boolean; postsOnDate?: PostOnDate[] }
  >();

  for (const date of allDates) {
    const existing = byDate.get(date);
    if (existing) {
      lastFollowers = existing.followers;
      result.set(date, {
        impressions: existing.impressions,
        followers: existing.followers,
        postPublished: existing.postPublished,
        postsOnDate: existing.postsOnDate,
      });
    } else {
      result.set(date, { impressions: 0, followers: lastFollowers, postPublished: false });
    }
  }
  return result;
}

/**
 * Aggregates metrics across selected platforms into daily totals.
 * Handles missing dates by forward-filling from last known value for followers.
 * Passes through postsOnDate from first platform that has it (for LinkedIn tooltips).
 */
export function aggregatePlatforms(
  platforms: PlatformMetrics[],
  selectedPlatforms: string[] = ["linkedin", "twitter", "youtube"]
): AggregatedMetrics[] {
  const filtered = platforms.filter((p) =>
    selectedPlatforms.includes(p.platform)
  );
  if (filtered.length === 0) return [];

  const allDates = Array.from(
    new Set(filtered.flatMap((p) => p.dailyData.map((d) => d.date)))
  ).sort();

  const filled = filtered.map((p) => fillPlatformDates(p.dailyData, allDates));

  let cumulative = 0;
  const result: AggregatedMetrics[] = [];

  for (const date of allDates) {
    let totalImpressions = 0;
    let totalFollowers = 0;
    let anyPost = false;
    let postsOnDate: PostOnDate[] | undefined;

    for (const platformMap of filled) {
      const row = platformMap.get(date)!;
      totalImpressions += row.impressions;
      totalFollowers += row.followers;
      anyPost = anyPost || row.postPublished;
      if (row.postsOnDate?.length && !postsOnDate) postsOnDate = row.postsOnDate;
    }

    cumulative += totalImpressions;
    result.push({
      date,
      cumulativeImpressions: cumulative,
      followers: totalFollowers,
      postPublished: anyPost,
      postsOnDate,
    });
  }

  return result;
}

/**
 * Get date range label (e.g. "Feb 2026")
 */
export function getDateRangeLabel(dates: string[]): string {
  if (dates.length === 0) return "";
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const month = first.toLocaleString("default", { month: "short" });
  const year = first.getFullYear();
  return `${month} ${year}`;
}

/**
 * Format number for display (e.g. 241500 -> "241.5K")
 */
export function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}
