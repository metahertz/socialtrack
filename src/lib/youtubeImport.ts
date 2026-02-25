import type { PlatformMetrics, DailyMetrics } from "@/types/social";
import JSZip from "jszip";

/** Daily row from Chart data (daily viewers) */
export interface YouTubeDailyRow {
  date: string;
  views: number;
  subscribersGained: number;
  subscribersTotal?: number;
}

/** Per-video row from Table data: subscribers per video. Views are LIFETIME total — never use for chart/tooltip. */
export interface YouTubeVideoRow {
  videoTitle: string;
  videoId: string;
  publishedDate: string;
  viewsTotal: number;
  subscribersGained: number;
}

/** Per-day per-video from Chart data (daily views per video) — use for postsOnDate tooltips */
export interface YouTubeChartVideoRow {
  date: string;
  videoTitle: string;
  videoId: string;
  views: number;
  subscribersGained: number;
}

/** Stored format */
export interface StoredYouTubeData {
  platform: "youtube";
  dailyData: YouTubeDailyRow[];
  videos: YouTubeVideoRow[];
  /** Per-day per-video from Chart (for tooltips); never use Table.views for this */
  chartVideos: YouTubeChartVideoRow[];
  channelName?: string;
  lastImportedAt: string;
}

const DATE_COL_ALIASES = ["day", "date", "dimension", "publishing date"];
const VIEWS_COL_ALIASES = ["views", "view"];
const SUBS_COL_ALIASES = [
  "subscribers gained",
  "subscribers",
  "subscriber",
  "estimated monetized playbacks",
];
const SUBS_TOTAL_ALIASES = ["subscribers", "subscriber count"];
const VIDEO_TITLE_COL_ALIASES = ["video title", "title", "video"];
const VIDEO_ID_COL_ALIASES = ["content", "video id", "id"];

function findColumn(
  headers: string[],
  aliases: string[],
  exclude?: string[]
): { index: number } | null {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  const excludeLower = (exclude ?? []).map((e) => e.toLowerCase());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => {
      if (excludeLower.some((e) => h.includes(e))) return false;
      return h === alias || (h.startsWith(alias + " ") || h === alias);
    });
    if (idx >= 0) return { index: idx };
  }
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => {
      if (excludeLower.some((e) => h.includes(e))) return false;
      return h.includes(alias) || alias.includes(h);
    });
    if (idx >= 0) return { index: idx };
  }
  return null;
}

const MONTH_ABBREV: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, m, d, y] = slashMatch;
      return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
    }
    const mmmMatch = trimmed.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
    if (mmmMatch) {
      const [, mon, d, y] = mmmMatch;
      const m = MONTH_ABBREV[mon!.toLowerCase().slice(0, 3)];
      if (m) return `${y}-${m}-${d!.padStart(2, "0")}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof val === "number" && val > 0) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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

/** Parse integer only (for subscribers). */
function parseInteger(val: unknown): number {
  return Math.round(parseNumber(val));
}

/** Find header row (YouTube exports may have intro rows) */
function findHeaderRow(rows: unknown[][]): { rowIndex: number; headers: string[] } | null {
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const headers = rows[r].map((c) => String(c ?? "").trim());
    const hasDate = headers.some((h) => /day|date|dimension/i.test(h));
    const hasViews = headers.some((h) => /view/i.test(h));
    if (hasDate && hasViews) return { rowIndex: r, headers };
  }
  return null;
}

/** Parse CSV text to rows (handles quoted fields) */
function parseCSVToRows(csvText: string): unknown[][] {
  const rows: unknown[][] = [];
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let cell = "";
        i++;
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            cell += line[i];
            i++;
          }
        }
        row.push(cell);
      } else {
        const comma = line.indexOf(",", i);
        const end = comma >= 0 ? comma : line.length;
        row.push(line.slice(i, end).trim());
        i = comma >= 0 ? end + 1 : line.length;
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Find a file in ZIP by name (case-insensitive, ignores path and .csv) */
async function findZipFile(
  zip: JSZip,
  names: string[]
): Promise<{ name: string; content: string } | null> {
  const lowerNames = names.map((n) => n.toLowerCase().replace(/\.csv$/i, "").trim());
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const base = path.split("/").pop() ?? path;
    const baseLower = base.toLowerCase().replace(/\.csv$/i, "").trim();
    if (lowerNames.some((w) => baseLower === w)) {
      const content = await entry.async("string");
      return { name: base, content };
    }
  }
  return null;
}

/** Chart parse result: daily aggregate + optional per-day per-video */
interface ChartParseResult {
  dailyData: YouTubeDailyRow[];
  chartVideos: YouTubeChartVideoRow[];
}

/**
 * Parse Chart data CSV.
 * Format: one row per day per video. Views = cumulative total for that video on that day.
 * - Per-video: use views directly as cumulative.
 * - Daily totals: take delta per video (daily change), then sum across videos.
 */
function parseChartData(csvText: string): ChartParseResult {
  const rows = parseCSVToRows(csvText);
  if (!rows?.length) return { dailyData: [], chartVideos: [] };

  const headerInfo = findHeaderRow(rows);
  const headers = headerInfo?.headers ?? rows[0].map((c) => String(c ?? "").trim());
  const dataStartRow = headerInfo ? headerInfo.rowIndex + 1 : 1;

  const dateCol = findColumn(headers, DATE_COL_ALIASES);
  const viewsCol = findColumn(headers, VIEWS_COL_ALIASES);
  const subsGainedCol = findColumn(headers, SUBS_COL_ALIASES);
  const subsTotalCol = findColumn(headers, SUBS_TOTAL_ALIASES);
  const videoTitleCol = findColumn(headers, VIDEO_TITLE_COL_ALIASES);
  const videoIdCol = findColumn(headers, VIDEO_ID_COL_ALIASES);

  if (!dateCol || !viewsCol) return { dailyData: [], chartVideos: [] };

  const chartVideos: YouTubeChartVideoRow[] = [];
  const byVideo = new Map<string, { date: string; views: number; subs: number; subsTotal?: number }[]>();

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row?.[dateCol.index]);
    if (!date) continue;
    const views = parseNumber(row?.[viewsCol.index]);
    const subs = subsGainedCol ? parseNumber(row?.[subsGainedCol.index]) : 0;
    const subsTotal = subsTotalCol ? parseNumber(row?.[subsTotalCol.index]) : 0;

    const videoTitle = videoTitleCol ? String(row?.[videoTitleCol.index] ?? "").trim() : "";
    const videoId = videoIdCol ? String(row?.[videoIdCol.index] ?? "").trim() : "";

    if ((videoTitleCol || videoIdCol) && (videoTitle || videoId)) {
      const id = videoId || videoTitle || "Untitled";
      const list = byVideo.get(id) ?? [];
      list.push({ date, views, subs, subsTotal: subsTotal || undefined });
      byVideo.set(id, list);
      chartVideos.push({
        date,
        videoTitle: videoTitle || videoId || "Untitled",
        videoId,
        views,
        subscribersGained: subs,
      });
    }
  }

  for (const list of byVideo.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const dailyByDate = new Map<string, { views: number; subs: number; subsTotal?: number }>();
  for (const list of byVideo.values()) {
    let prevViews = 0;
    for (const { date, views, subs, subsTotal } of list) {
      const dailyViews = Math.max(0, views - prevViews);
      prevViews = views;
      const prev = dailyByDate.get(date);
      if (prev) {
        prev.views += dailyViews;
        prev.subs += subs;
        if (subsTotal != null && subsTotal > 0) prev.subsTotal = subsTotal;
      } else {
        dailyByDate.set(date, {
          views: dailyViews,
          subs,
          subsTotal: subsTotal || undefined,
        });
      }
    }
  }

  const dailyData: YouTubeDailyRow[] = Array.from(dailyByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({
      date,
      views: d.views,
      subscribersGained: d.subs,
      subscribersTotal: d.subsTotal,
    }));

  return { dailyData, chartVideos };
}

/** Parse Totals or Table CSV: Content, Video title, Video publish time, Views, Subscribers. Skip "Total" row. */
function parseTotalsOrTableData(csvText: string): YouTubeVideoRow[] {
  const rows = parseCSVToRows(csvText);
  if (!rows?.length) return [];
  const headers = rows[0].map((c) => String(c ?? "").trim());
  const titleCol = findColumn(headers, VIDEO_TITLE_COL_ALIASES);
  const idCol = findColumn(headers, VIDEO_ID_COL_ALIASES);
  const publishedCol = findColumn(headers, [
    "video publish time",
    "video publish",
    "published",
    "publish date",
    "date",
  ]);
  const viewsCol = findColumn(headers, ["views", "view"], ["duration", "average"]);
  const subsCol = findColumn(headers, ["subscribers", "subscribers gained"], ["watch", "time"]);

  if (!titleCol && !idCol) return [];
  if (!publishedCol) return [];
  if (!viewsCol) return [];

  const result: YouTubeVideoRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const titleVal = titleCol ? String(row?.[titleCol.index] ?? "").trim() : "";
    const idVal = idCol ? String(row?.[idCol.index] ?? "").trim() : "";
    if (
      titleVal.toLowerCase() === "total" ||
      idVal.toLowerCase() === "total" ||
      (!titleVal && !idVal)
    )
      continue;
    const date = parseDate(row?.[publishedCol.index]);
    if (!date) continue;
    const title = titleVal || idVal || "Untitled";
    const id = idVal || "";
    const viewsTotal = parseNumber(row?.[viewsCol.index]);
    const subs = subsCol ? parseInteger(row?.[subsCol.index]) : 0;
    result.push({
      videoTitle: title,
      videoId: id,
      publishedDate: date,
      viewsTotal,
      subscribersGained: subs,
    });
  }
  return result.sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));
}

/** Result of parsing a YouTube ZIP export */
export interface ParsedYouTubeZip {
  dailyData: YouTubeDailyRow[];
  videos: YouTubeVideoRow[];
  chartVideos: YouTubeChartVideoRow[];
}

/**
 * Parse YouTube Analytics ZIP export.
 * Chart data: Date, Content (video ID), Video title, Views (daily) — one row per day per video.
 * Totals/Table: Content, Video title, Video publish time, Views (total), Subscribers — skip "Total" row.
 */
export async function parseYouTubeZip(zipBuffer: ArrayBuffer): Promise<ParsedYouTubeZip> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const chartFile = await findZipFile(zip, ["Chart data.csv", "Chart data"]);
  const totalsFile = await findZipFile(zip, ["Totals.csv", "Totals"]);
  const tableFile = await findZipFile(zip, ["Table data.csv", "Table data"]);

  const { dailyData, chartVideos } = chartFile
    ? parseChartData(chartFile.content)
    : { dailyData: [], chartVideos: [] };

  const totalsVideos = totalsFile ? parseTotalsOrTableData(totalsFile.content) : [];
  const tableVideos = tableFile ? parseTotalsOrTableData(tableFile.content) : [];
  const videos = mergeYouTubeVideos(totalsVideos, tableVideos);

  return { dailyData, videos, chartVideos };
}

/**
 * Parse YouTube Analytics export (CSV or XLSX rows).
 * Expects columns: Day/Date, Views, Subscribers gained (or similar).
 */
export function parseYouTubeExport(rows: unknown[][]): YouTubeDailyRow[] {
  if (!rows?.length) return [];
  const headerInfo = findHeaderRow(rows);
  const headers = headerInfo?.headers ?? rows[0].map((c) => String(c ?? "").trim());
  const dataStartRow = headerInfo ? headerInfo.rowIndex + 1 : 1;

  const dateCol = findColumn(headers, DATE_COL_ALIASES);
  const viewsCol = findColumn(headers, VIEWS_COL_ALIASES);
  const subsGainedCol = findColumn(headers, SUBS_COL_ALIASES);
  const subsTotalCol = findColumn(headers, SUBS_TOTAL_ALIASES);

  if (!dateCol || !viewsCol) return [];

  const result: YouTubeDailyRow[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row?.[dateCol.index]);
    if (!date) continue;
    const views = parseNumber(row?.[viewsCol.index]);
    const subscribersGained = subsGainedCol ? parseNumber(row?.[subsGainedCol.index]) : 0;
    const subscribersTotal = subsTotalCol ? parseNumber(row?.[subsTotalCol.index]) : 0;
    result.push({
      date,
      views,
      subscribersGained,
      subscribersTotal: subscribersTotal || undefined,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build postsOnDate from videos: only on publish day. Tooltip shows video on the day it was published.
 */
function videosToPostsOnPublishDay(
  videos: YouTubeVideoRow[]
): Map<string, import("@/types/social").PostOnDate[]> {
  const byDate = new Map<string, import("@/types/social").PostOnDate[]>();
  for (const v of videos) {
    const existing = byDate.get(v.publishedDate) ?? [];
    existing.push({
      content: v.videoTitle,
      impressions: v.viewsTotal,
    });
    byDate.set(v.publishedDate, existing);
  }
  return byDate;
}

/** Convert to daily metrics. Subscribers from Totals/Table (point-in-time) override Chart when available. */
function toDailyMetrics(
  rows: YouTubeDailyRow[],
  chartVideos: YouTubeChartVideoRow[] = [],
  totalSubscribersFromTotals = 0,
  videos: YouTubeVideoRow[] = []
): DailyMetrics[] {
  const postsByDate = videos.length > 0 ? videosToPostsOnPublishDay(videos) : new Map();
  const hasTotal = rows.some((r) => typeof r.subscribersTotal === "number");
  const useTotalsSubs = totalSubscribersFromTotals > 0;
  if (useTotalsSubs) {
    return rows.map((r) => ({
      date: r.date,
      impressions: r.views,
      followers: totalSubscribersFromTotals,
      postPublished: (postsByDate.get(r.date)?.length ?? 0) > 0,
      postsOnDate: postsByDate.get(r.date),
    }));
  }
  if (hasTotal) {
    let lastTotal = 0;
    return rows.map((r) => {
      const followers = r.subscribersTotal ?? lastTotal;
      if (followers > 0) lastTotal = followers;
      return {
        date: r.date,
        impressions: r.views,
        followers,
        postPublished: (postsByDate.get(r.date)?.length ?? 0) > 0,
        postsOnDate: postsByDate.get(r.date),
      };
    });
  }
  let cumulativeSubs = 0;
  return rows.map((r) => {
    cumulativeSubs += r.subscribersGained;
    return {
      date: r.date,
      impressions: r.views,
      followers: cumulativeSubs,
      postPublished: (postsByDate.get(r.date)?.length ?? 0) > 0,
      postsOnDate: postsByDate.get(r.date),
    };
  });
}

/** Merge YouTube daily data: take max views/subs per date */
export function mergeYouTubeDaily(
  existing: YouTubeDailyRow[],
  incoming: YouTubeDailyRow[]
): YouTubeDailyRow[] {
  const byDate = new Map<string, YouTubeDailyRow>();
  for (const r of existing) {
    byDate.set(r.date, r);
  }
  for (const r of incoming) {
    const prev = byDate.get(r.date);
    if (!prev || r.views >= prev.views) {
      byDate.set(r.date, r);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge videos: keep by videoId, incoming overwrites */
export function mergeYouTubeVideos(
  existing: YouTubeVideoRow[],
  incoming: YouTubeVideoRow[]
): YouTubeVideoRow[] {
  const byId = new Map<string, YouTubeVideoRow>();
  for (const v of existing) {
    byId.set(v.videoId || v.videoTitle, v);
  }
  for (const v of incoming) {
    byId.set(v.videoId || v.videoTitle, v);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.publishedDate.localeCompare(b.publishedDate)
  );
}

/** Merge chart videos: by date+videoId, incoming overwrites */
export function mergeYouTubeChartVideos(
  existing: YouTubeChartVideoRow[],
  incoming: YouTubeChartVideoRow[]
): YouTubeChartVideoRow[] {
  const byKey = new Map<string, YouTubeChartVideoRow>();
  for (const v of existing) {
    byKey.set(`${v.date}:${v.videoId || v.videoTitle}`, v);
  }
  for (const v of incoming) {
    byKey.set(`${v.date}:${v.videoId || v.videoTitle}`, v);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.videoTitle.localeCompare(b.videoTitle)
  );
}

export function toPlatformMetrics(
  dailyData: YouTubeDailyRow[],
  channelName = "VimandTonic",
  videos: YouTubeVideoRow[] = [],
  chartVideos: YouTubeChartVideoRow[] = []
): PlatformMetrics {
  const totalSubs = videos.reduce((s, v) => s + v.subscribersGained, 0);
  const daily = toDailyMetrics(dailyData, chartVideos, totalSubs, videos);
  return {
    platform: "youtube",
    displayName: `YouTube (${channelName})`,
    dailyData: daily,
  };
}
