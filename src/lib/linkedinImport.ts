import type { PlatformMetrics, DailyMetrics } from "@/types/social";

/** Content type: post, comment, repost, or likely_repost (user can confirm to repost) */
export type LinkedInContentType = "post" | "comment" | "repost" | "likely_repost";

/** Raw post-level row from LinkedIn Content export (TOP POSTS or COMMENTS sheet) */
export interface LinkedInPostRow {
  postId: string;
  date: string; // YYYY-MM-DD
  dateTime?: string; // Display format: "m/d/yyyy h:mm a"
  impressions: number;
  engagements?: number;
  postContent?: string;
  postUrl?: string; // URL for fetching title when postContent is not usable
  contentType?: LinkedInContentType;
}

/** Daily impressions from ENGAGEMENT sheet (date -> impressions) */
export interface DailyImpressionsRow {
  date: string;
  impressions: number;
}

/** Parsed result from multi-sheet workbook */
export interface ParsedLinkedInWorkbook {
  dailyImpressions: DailyImpressionsRow[];
  posts: LinkedInPostRow[];
  followersByDate: Map<string, number>;
}

/** Stored format */
export interface StoredLinkedInData {
  platform: "linkedin";
  dailyImpressions: DailyImpressionsRow[];
  posts: LinkedInPostRow[];
  followersByDate: Array<{ date: string; count: number }>;
  lastImportedAt: string; // ISO timestamp
  exportDateRange?: { start: string; end: string };
}

const DATE_COL_ALIASES = [
  "date",
  "published",
  "publication date",
  "post date",
  "post publish date",
  "created",
  "date range",
];
const IMPRESSIONS_COL_ALIASES = [
  "impressions",
  "impression",
  "views",
  "reach",
  "members reached",
  "member reach",
  "discovery",
];
const FOLLOWERS_COL_ALIASES = [
  "followers",
  "follower count",
  "total followers",
  "new followers",
  "follower",
];
const POST_COL_ALIASES = ["post", "content", "title", "update", "share", "update text"];
const POST_CONTENT_ALIASES = ["update text", "post", "content", "share", "title", "update"];
const ENGAGEMENTS_COL_ALIASES = ["engagements", "engagement", "total engagement"];

function isUrlLike(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith("http") || t.includes("linkedin.com") || t.includes("urn:li:");
}

/** Extract first LinkedIn URL from text (e.g. when URL is in content column but not Post URL column) */
function extractUrlFromText(text: string): string | undefined {
  const match = text.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/[^\s<>"']+|urn:li:activity:\d+/i
  );
  return match ? match[0].trim() : undefined;
}

function getPostDisplayName(content: string, url: string): string {
  const text = content.trim();
  if (text && !isUrlLike(text)) return text;
  const urlText = url.trim();
  if (urlText && !isUrlLike(urlText)) return urlText;
  return "";
}

function findColumnForPostContent(
  headers: string[],
  _nearIdx: number
): { index: number; name: string } | null {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  for (const alias of POST_CONTENT_ALIASES) {
    for (let i = 0; i < lower.length; i++) {
      const h = lower[i];
      if (h.includes("url") || h === "url") continue;
      if (h === alias || h.includes(alias)) return { index: i, name: headers[i] };
    }
  }
  return null;
}

function findColumn(
  headers: string[],
  aliases: string[]
): { index: number; name: string } | null {
  const lower = headers.map((h) => String(h || "").trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx >= 0) return { index: idx, name: headers[idx] };
  }
  return null;
}

/** Find column where header contains any alias (for "Total followers" etc.) */
function findColumnContains(
  headers: string[],
  aliases: string[]
): { index: number; name: string } | null {
  const lower = headers.map((h) => String(h || "").trim().toLowerCase());
  for (let i = 0; i < lower.length; i++) {
    const h = lower[i];
    for (const alias of aliases) {
      if (h.includes(alias)) return { index: i, name: headers[i] };
    }
  }
  return null;
}

/**
 * Parse date from LinkedIn export. Handles:
 * - ISO YYYY-MM-DD
 * - US format mm/dd/yyyy (e.g. 05/22/2024 = May 22, 2024)
 * - Excel serial numbers (days since 1900-01-01)
 */
function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    // mm/dd/yyyy or m/d/yyyy (US format - LinkedIn exports)
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof val === "number" && val > 0) {
    // Excel serial date (days since 1900-01-01)
    if (val >= 1 && val <= 1000000) {
      const d = new Date((val - 25569) * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

/**
 * Parse date and optional time. Returns date (YYYY-MM-DD) and dateTime for display.
 * Handles Excel serial with decimal (time as fraction of day).
 */
function parseDateTime(val: unknown): { date: string; dateTime: string } | null {
  if (!val) return null;
  let dateStr: string | null = null;
  let dateTimeStr: string | null = null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().slice(0, 10);
      dateTimeStr = d.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return { date: dateStr, dateTime: dateTimeStr };
    }
    dateStr = parseDate(trimmed);
    if (dateStr) return { date: dateStr, dateTime: dateStr };
  }
  if (typeof val === "number" && val >= 1 && val <= 1000000) {
    const d = new Date((val - 25569) * 86400000);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().slice(0, 10);
      dateTimeStr = d.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return { date: dateStr, dateTime: dateTimeStr };
    }
  }
  dateStr = parseDate(val);
  if (dateStr) {
    const [y, m, d] = dateStr.split("-");
    dateTimeStr =
      y && m && d
        ? `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
        : dateStr;
    return { date: dateStr, dateTime: dateTimeStr };
  }
  return null;
}

function parseNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number" && !isNaN(val)) return Math.max(0, val);
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

const SHEET_NAMES_ENGAGEMENT = ["ENGAGEMENT", "DISCOVERY"];
const SHEET_NAMES_TOP_POSTS = ["TOP POSTS", "TOP_POSTS"];
const SHEET_NAMES_COMMENTS = ["COMMENTS", "TOP COMMENTS", "TOP_COMMENTS"];
const SHEET_NAMES_FOLLOWERS = ["FOLLOWERS", "FOLLOWER"];

/** Parse ENGAGEMENT/DISCOVERY for daily impressions (date -> impressions, sum if multiple per date) */
function parseRowsForDailyImpressions(rows: unknown[][]): DailyImpressionsRow[] {
  if (!rows?.length) return [];
  const headers = rows[0].map((c) => String(c ?? "").trim());
  const dateCol = findColumn(headers, DATE_COL_ALIASES) ?? findColumnContains(headers, ["date"]);
  const impressionsCol = findColumn(headers, IMPRESSIONS_COL_ALIASES) ?? findColumnContains(headers, ["impression", "reach", "view"]);

  if (!dateCol || !impressionsCol) return [];

  const byDate = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row?.[dateCol.index]);
    if (!date) continue;
    const impressions = parseNumber(row?.[impressionsCol.index]);
    byDate.set(date, (byDate.get(date) ?? 0) + impressions);
  }
  return Array.from(byDate.entries())
    .map(([date, impressions]) => ({ date, impressions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Find header row (TOP POSTS has "Maximum of 50 posts..." in row 0, headers in row 2) */
function findHeaderRow(rows: unknown[][]): { rowIndex: number; headers: string[] } | null {
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const headers = rows[r].map((c) => String(c ?? "").trim());
    const hasImpressions = headers.some((h) =>
      h.toLowerCase().includes("impression")
    );
    const hasDate = headers.some((h) =>
      /post publish date|date|published/i.test(h)
    );
    if (hasImpressions && hasDate) {
      return { rowIndex: r, headers };
    }
  }
  return null;
}

/** Extract activity ID from LinkedIn post URL (urn:li:activity:123) */
function extractActivityId(url: unknown): string | null {
  const s = String(url ?? "").trim();
  const match = s.match(/urn:li:activity:(\d+)/i) || s.match(/activity[:\/](\d+)/i);
  return match ? match[1] : null;
}

function isCommentFromSheet(sheetName: string): boolean {
  const n = sheetName.trim().toUpperCase().replace(/\s+/g, " ");
  return SHEET_NAMES_COMMENTS.some((p) =>
    n.includes(p.replace(/\s+/g, " ").toUpperCase())
  );
}

function isCommentFromType(val: unknown): boolean {
  const s = String(val ?? "").trim().toLowerCase();
  return s.includes("comment") || s === "comment";
}

function isRepostFromType(val: unknown): boolean {
  const s = String(val ?? "").trim().toLowerCase();
  return (
    s.includes("repost") ||
    s.includes("re-post") ||
    s.includes("reshare") ||
    s.includes("share") ||
    s === "share"
  );
}

/** Heuristic: LinkedIn reposts often start with "Reposted", "Reposted by", etc. */
function isRepostFromContent(content: string): boolean {
  const t = content.trim().toLowerCase();
  if (!t) return false;
  const repostPatterns = [
    /^reposted\b/i,
    /^reposted\s+by\b/i,
    /^reposted\s+this\b/i,
    /^shared\s+(a\s+)?(post|article|video)\b/i,
    /^repost\s+of\b/i,
    /^re-sharing\b/i,
    /^reshared\b/i,
  ];
  return repostPatterns.some((p) => p.test(t));
}

/** Heuristic: short content (couple sentences) or only hashtags → likely repost */
function isLikelyRepostFromContent(content: string): boolean {
  const t = content.trim();
  if (!t || t.length < 5 || isUrlLike(t)) return false;
  // Only hashtags: e.g. "#leadership #innovation #growth"
  if (/^(\s*#[\w-]+\s*)+$/.test(t)) return true;
  // Couple of sentences: 2 or fewer, and short (≤150 chars)
  const sentences = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return sentences.length <= 2 && t.length <= 150;
}

function parseRowsForPosts(
  rows: unknown[][],
  sheetName: string
): LinkedInPostRow[] {
  if (!rows?.length) return [];
  const headerInfo = findHeaderRow(rows);
  const headers = headerInfo?.headers ?? rows[0].map((c) => String(c ?? "").trim());
  const dataStartRow = headerInfo ? headerInfo.rowIndex + 1 : 1;

  const impressionsCol = findColumnContains(headers, ["impression"]) ?? findColumn(headers, IMPRESSIONS_COL_ALIASES);
  const engagementsCol = findColumnContains(headers, ["engagement"]) ?? findColumn(headers, ENGAGEMENTS_COL_ALIASES);
  if (!impressionsCol) return [];

  const impressionsIdx = impressionsCol.index;
  const dateCol = findColumnContains(headers, ["post publish date", "publish date", "date"]) ?? findColumn(headers, DATE_COL_ALIASES);
  const postUrlCol = findColumnContains(headers, ["post url", "url"]) ?? findColumn(headers, POST_COL_ALIASES);
  const contentCol = findColumnForPostContent(headers, impressionsIdx);

  const dateIdx = Math.max(
    0,
    dateCol && Math.abs(dateCol.index - impressionsIdx) <= 3
      ? dateCol.index
      : impressionsIdx - 1
  );
  const urlIdx = Math.max(
    0,
    postUrlCol && Math.abs(postUrlCol.index - impressionsIdx) <= 3
      ? postUrlCol.index
      : impressionsIdx - 2
  );
  const contentIdx = contentCol?.index ?? urlIdx;

  const result: LinkedInPostRow[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const dateVal = row?.[dateIdx];
    const parsed = parseDateTime(dateVal);
    if (!parsed) continue;
    const { date, dateTime } = parsed;

    const impressions = parseNumber(row?.[impressionsIdx]);
    if (impressions < 0) continue;

    const engagements = engagementsCol
      ? parseNumber(row?.[engagementsCol.index])
      : undefined;

    const urlVal = String(row?.[urlIdx] ?? "").trim();
    const contentVal = String(row?.[contentIdx] ?? "").trim();
    const activityId = extractActivityId(urlVal);
    const postId = activityId ?? simpleHash((contentVal || urlVal) + date);
    const postContent = getPostDisplayName(contentVal, urlVal);
    let postUrl = isUrlLike(urlVal) ? urlVal : undefined;
    if (!postUrl && (contentVal || postContent)) {
      const extracted = extractUrlFromText(contentVal || postContent);
      if (extracted) postUrl = extracted;
    }

    result.push({
      postId,
      date,
      dateTime,
      impressions,
      engagements: engagements ?? undefined,
      postContent: postContent || (activityId ? `Post ${activityId}` : `Post ${date}`),
      postUrl,
    });
  }
  return result;
}

/** Find header row for FOLLOWERS (has "Total followers..." in row 0, headers in row 2) */
function findFollowersHeaderRow(rows: unknown[][]): { rowIndex: number; headers: string[] } | null {
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const headers = rows[r].map((c) => String(c ?? "").trim());
    const hasDate = headers.some((h) => /^date$/i.test(h) || h.toLowerCase().includes("date"));
    const hasFollowers = headers.some((h) =>
      /new followers|followers|follower count/i.test(h)
    );
    if (hasDate && hasFollowers) {
      return { rowIndex: r, headers };
    }
  }
  return null;
}

function parseRowsForFollowers(rows: unknown[][]): Map<string, number> {
  const result = new Map<string, number>();
  if (!rows?.length) return result;

  const headerInfo = findFollowersHeaderRow(rows);
  const headers = headerInfo?.headers ?? rows[0].map((c) => String(c ?? "").trim());
  const dataStartRow = headerInfo ? headerInfo.rowIndex + 1 : 1;

  const dateCol = findColumn(headers, DATE_COL_ALIASES) ?? findColumnContains(headers, ["date"]);
  const followersCol = findColumnContains(headers, ["new followers", "followers", "follower"]) ?? findColumn(headers, FOLLOWERS_COL_ALIASES);

  if (!dateCol || !followersCol) return result;

  const rowsWithData: { date: string; newFollowers: number }[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row?.[dateCol.index]);
    if (!date) continue;
    const newFollowers = Math.max(0, parseNumber(row?.[followersCol.index]));
    rowsWithData.push({ date, newFollowers });
  }

  rowsWithData.sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  for (const { date, newFollowers } of rowsWithData) {
    cumulative += newFollowers;
    result.set(date, cumulative);
  }

  const headerRow = rows[0] ?? [];
  const totalMatch = [headerRow[0], headerRow[1], headerRow[2]]
    .map((c) => String(c ?? ""))
    .join(" ")
    .match(/Total followers on (\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const totalVal = parseNumber(headerRow[2] ?? headerRow[1]);
  if (totalMatch && totalVal > 0 && rowsWithData.length > 0) {
    const [, m, d, y] = totalMatch;
    const endDate = `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
    const sumAtEnd = result.get(endDate) ?? cumulative;
    const baseline = Math.max(0, totalVal - sumAtEnd);
    for (const [date, val] of result) {
      result.set(date, baseline + val);
    }
  }
  return result;
}

function sheetNameMatches(name: string, patterns: string[]): boolean {
  const n = name.trim().toUpperCase().replace(/\s+/g, " ");
  return patterns.some((p) => n.includes(p.replace(/\s+/g, " ").toUpperCase()));
}

/**
 * Parse LinkedIn Creator Analytics export XLSX with multiple sheets.
 * - ENGAGEMENT: daily impressions for the chart
 * - TOP POSTS: post-level data for markers and hover tooltips
 * - FOLLOWERS: follower counts
 */
export function parseLinkedInWorkbook(sheets: { name: string; rows: unknown[][] }[]): ParsedLinkedInWorkbook {
  let dailyImpressions: DailyImpressionsRow[] = [];
  let posts: LinkedInPostRow[] = [];
  const followersByDate = new Map<string, number>();

  for (const { name, rows } of sheets) {
    if (sheetNameMatches(name, SHEET_NAMES_ENGAGEMENT)) {
      const parsed = parseRowsForDailyImpressions(rows);
      if (parsed.length) dailyImpressions = parsed;
    } else if (
      sheetNameMatches(name, SHEET_NAMES_TOP_POSTS) ||
      sheetNameMatches(name, SHEET_NAMES_COMMENTS)
    ) {
      const parsed = parseRowsForPosts(rows, name);
      if (parsed.length) posts = mergeLinkedInPosts(posts, parsed);
    } else if (sheetNameMatches(name, SHEET_NAMES_FOLLOWERS)) {
      const followers = parseRowsForFollowers(rows);
      for (const [date, count] of followers) {
        const existing = followersByDate.get(date);
        if (existing === undefined || count > existing) {
          followersByDate.set(date, count);
        }
      }
    }
  }

  if (dailyImpressions.length === 0) {
    throw new Error(
      "Could not find daily engagement data. Expected a sheet named ENGAGEMENT or DISCOVERY with Date and Impressions columns."
    );
  }

  return { dailyImpressions, posts, followersByDate };
}

/** Build posts-by-date map from TOP POSTS for hover tooltips */
function postsByDateMap(
  posts: LinkedInPostRow[]
): Map<string, Array<{ content: string; impressions: number; contentType?: LinkedInContentType }>> {
  const map = new Map<string, Array<{ content: string; impressions: number; contentType?: LinkedInContentType }>>();
  for (const p of posts) {
    const existing = map.get(p.date) ?? [];
    existing.push({
      content: p.postContent ?? "—",
      impressions: p.impressions,
      contentType: p.contentType,
    });
    map.set(p.date, existing);
  }
  return map;
}

/**
 * Build daily metrics from ENGAGEMENT (impressions) + TOP POSTS (markers, hover tooltips).
 */
export function buildDailyMetrics(
  dailyImpressions: DailyImpressionsRow[],
  posts: LinkedInPostRow[],
  followersByDate?: Map<string, number> | Array<{ date: string; count: number }>
): DailyMetrics[] {
  const followersMap =
    followersByDate instanceof Map
      ? followersByDate
      : Array.isArray(followersByDate)
        ? new Map(followersByDate.map(({ date, count }) => [date, count]))
        : undefined;
  const postsMap = postsByDateMap(posts);
  const allDates = Array.from(
    new Set([
      ...dailyImpressions.map((d) => d.date),
      ...posts.map((p) => p.date),
    ])
  ).sort();
  let lastFollowers = 0;
  return allDates.map((date) => {
    const impressionsRow = dailyImpressions.find((d) => d.date === date);
    const impressions = impressionsRow?.impressions ?? 0;
    const datePosts = postsMap.get(date);
    const postPublished = (datePosts?.length ?? 0) > 0;
    const followers =
      followersMap?.get(date) ??
      (followersMap ? undefined : lastFollowers);
    if (typeof followers === "number") lastFollowers = followers;
    return {
      date,
      impressions,
      followers: followers ?? 0,
      postPublished,
      postsOnDate: datePosts?.map((p) => ({
        content: p.content.length > 80 ? p.content.slice(0, 80) + "…" : p.content,
        impressions: p.impressions,
        contentType: p.contentType,
      })),
    };
  });
}

/**
 * Merge new post-level data with existing. De-duplicates by (postId, date):
 * keeps the row with higher impressions (LinkedIn updates metrics over time).
 */
export function mergeLinkedInPosts(
  existing: LinkedInPostRow[],
  incoming: LinkedInPostRow[]
): LinkedInPostRow[] {
  const byKey = new Map<string, LinkedInPostRow>();
  for (const p of existing) {
    byKey.set(`${p.postId}:${p.date}`, p);
  }
  for (const p of incoming) {
    const key = `${p.postId}:${p.date}`;
    const prev = byKey.get(key);
    if (!prev || p.impressions >= prev.impressions) {
      byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

/** Merge daily impressions: take max per date (newer exports have updated numbers) */
export function mergeDailyImpressions(
  existing: DailyImpressionsRow[],
  incoming: DailyImpressionsRow[]
): DailyImpressionsRow[] {
  const byDate = new Map<string, number>();
  for (const { date, impressions } of existing) {
    const prev = byDate.get(date);
    if (prev === undefined || impressions > prev) byDate.set(date, impressions);
  }
  for (const { date, impressions } of incoming) {
    const prev = byDate.get(date);
    if (prev === undefined || impressions > prev) byDate.set(date, impressions);
  }
  return Array.from(byDate.entries())
    .map(([date, impressions]) => ({ date, impressions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build PlatformMetrics for LinkedIn from ENGAGEMENT (daily) + TOP POSTS (markers, tooltips).
 * If dailyImpressions is empty, falls back to summing posts per date (legacy/migration).
 */
export function toPlatformMetrics(
  dailyImpressions: DailyImpressionsRow[],
  posts: LinkedInPostRow[],
  followersByDate?: Map<string, number> | Array<{ date: string; count: number }>
): PlatformMetrics {
  let daily = dailyImpressions;
  if (daily.length === 0 && posts.length > 0) {
    const byDate = new Map<string, number>();
    for (const p of posts) {
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.impressions);
    }
    daily = Array.from(byDate.entries())
      .map(([date, impressions]) => ({ date, impressions }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const dailyData = buildDailyMetrics(daily, posts, followersByDate);
  return {
    platform: "linkedin",
    displayName: "LinkedIn",
    dailyData,
  };
}

/** Merge follower data: take max count per date. */
export function mergeFollowers(
  existing: Array<{ date: string; count: number }>,
  incoming: Map<string, number>
): Array<{ date: string; count: number }> {
  const byDate = new Map<string, number>();

  for (const { date, count } of existing) {
    const prev = byDate.get(date);
    if (prev === undefined || count > prev) byDate.set(date, count);
  }
  for (const [date, count] of incoming) {
    const prev = byDate.get(date);
    if (prev === undefined || count > prev) byDate.set(date, count);
  }
  return Array.from(byDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
