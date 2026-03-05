import {
  type StoredLinkedInData,
  type LinkedInPostRow,
  type DailyImpressionsRow,
  mergeLinkedInPosts,
  mergeDailyImpressions,
  mergeFollowers,
} from "./linkedinImport";

/** Load from API (MongoDB) when authenticated */
export async function loadLinkedInData(): Promise<StoredLinkedInData | null> {
  try {
    const res = await fetch("/api/linkedin", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Save to API (MongoDB) when authenticated */
/** Update a single post's contentType (e.g. confirm likely_repost → repost) */
export async function updatePostContentType(
  postId: string,
  contentType: "repost"
): Promise<boolean> {
  try {
    const res = await fetch("/api/linkedin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, contentType }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveLinkedInData(data: StoredLinkedInData): Promise<boolean> {
  try {
    const res = await fetch("/api/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mergeAndSave(
  existing: StoredLinkedInData | null,
  incoming: {
    dailyImpressions: DailyImpressionsRow[];
    posts: LinkedInPostRow[];
    followersByDate: Map<string, number>;
  }
): Promise<StoredLinkedInData> {
  const prevDaily = existing?.dailyImpressions ?? [];
  const prevPosts = existing?.posts ?? [];
  const prevFollowers = existing?.followersByDate ?? [];
  const mergedDaily = mergeDailyImpressions(prevDaily, incoming.dailyImpressions);
  const mergedPosts = mergeLinkedInPosts(prevPosts, incoming.posts);
  const mergedFollowers = mergeFollowers(prevFollowers, incoming.followersByDate);
  const allDates = [
    ...mergedDaily.map((d) => d.date),
    ...mergedPosts.map((p) => p.date),
  ];
  const sortedDates = [...new Set(allDates)].sort();
  const exportDateRange =
    sortedDates.length > 0
      ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
      : undefined;
  const result: StoredLinkedInData = {
    platform: "linkedin",
    dailyImpressions: mergedDaily,
    posts: mergedPosts,
    followersByDate: mergedFollowers,
    lastImportedAt: new Date().toISOString(),
    exportDateRange,
  };
  await saveLinkedInData(result);
  return result;
}

/** Clear from API (MongoDB) when authenticated */
export async function clearLinkedInData(): Promise<boolean> {
  try {
    const res = await fetch("/api/linkedin", {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
