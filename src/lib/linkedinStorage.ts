import {
  type StoredLinkedInData,
  type LinkedInPostRow,
  type DailyImpressionsRow,
  mergeLinkedInPosts,
  mergeDailyImpressions,
  mergeFollowers,
} from "./linkedinImport";

const STORAGE_KEY = "socialtrack_linkedin_data";

export function loadLinkedInData(): StoredLinkedInData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLinkedInData & {
      dailyImpressions?: DailyImpressionsRow[];
    };
    if (parsed?.platform === "linkedin" && Array.isArray(parsed.posts)) {
      const dailyImpressions = parsed.dailyImpressions ?? [];
      return {
        ...parsed,
        dailyImpressions,
        followersByDate: parsed.followersByDate ?? [],
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLinkedInData(data: StoredLinkedInData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function mergeAndSave(
  existing: StoredLinkedInData | null,
  incoming: {
    dailyImpressions: DailyImpressionsRow[];
    posts: LinkedInPostRow[];
    followersByDate: Map<string, number>;
  },
  exportDateRange?: { start: string; end: string }
): StoredLinkedInData {
  const prevDaily = existing?.dailyImpressions ?? [];
  const prevPosts = existing?.posts ?? [];
  const prevFollowers = existing?.followersByDate ?? [];
  const mergedDaily = mergeDailyImpressions(prevDaily, incoming.dailyImpressions);
  const mergedPosts = mergeLinkedInPosts(prevPosts, incoming.posts);
  const mergedFollowers = mergeFollowers(prevFollowers, incoming.followersByDate);
  const result: StoredLinkedInData = {
    platform: "linkedin",
    dailyImpressions: mergedDaily,
    posts: mergedPosts,
    followersByDate: mergedFollowers,
    lastImportedAt: new Date().toISOString(),
    exportDateRange: exportDateRange ?? existing?.exportDateRange,
  };
  saveLinkedInData(result);
  return result;
}

export function clearLinkedInData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
