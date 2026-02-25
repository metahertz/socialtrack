import {
  type StoredYouTubeData,
  type YouTubeDailyRow,
  type YouTubeVideoRow,
  type YouTubeChartVideoRow,
  mergeYouTubeDaily,
  mergeYouTubeVideos,
  mergeYouTubeChartVideos,
} from "./youtubeImport";

const STORAGE_KEY = "socialtrack_youtube_data";

export function loadYouTubeData(): StoredYouTubeData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredYouTubeData & {
      videos?: YouTubeVideoRow[];
      chartVideos?: YouTubeChartVideoRow[];
    };
    if (parsed?.platform === "youtube" && Array.isArray(parsed.dailyData)) {
      return {
        ...parsed,
        videos: parsed.videos ?? [],
        chartVideos: parsed.chartVideos ?? [],
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveYouTubeData(data: StoredYouTubeData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function mergeAndSaveYouTube(
  existing: StoredYouTubeData | null,
  incoming: {
    dailyData: YouTubeDailyRow[];
    videos: YouTubeVideoRow[];
    chartVideos: YouTubeChartVideoRow[];
  },
  channelName = "VimandTonic"
): StoredYouTubeData {
  const prevDaily = existing?.dailyData ?? [];
  const prevVideos = existing?.videos ?? [];
  const prevChartVideos = existing?.chartVideos ?? [];
  const mergedDaily = mergeYouTubeDaily(prevDaily, incoming.dailyData);
  const mergedVideos = mergeYouTubeVideos(prevVideos, incoming.videos);
  const mergedChartVideos = mergeYouTubeChartVideos(
    prevChartVideos,
    incoming.chartVideos
  );
  const result: StoredYouTubeData = {
    platform: "youtube",
    dailyData: mergedDaily,
    videos: mergedVideos,
    chartVideos: mergedChartVideos,
    channelName,
    lastImportedAt: new Date().toISOString(),
  };
  saveYouTubeData(result);
  return result;
}

export function clearYouTubeData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
