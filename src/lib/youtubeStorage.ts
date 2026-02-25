import {
  type StoredYouTubeData,
  type YouTubeDailyRow,
  type YouTubeVideoRow,
  type YouTubeChartVideoRow,
  mergeYouTubeDaily,
  mergeYouTubeVideos,
  mergeYouTubeChartVideos,
} from "./youtubeImport";

/** Load from API (MongoDB) when authenticated */
export async function loadYouTubeData(): Promise<StoredYouTubeData | null> {
  try {
    const res = await fetch("/api/youtube", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = json.data;
    if (parsed?.platform === "youtube" && Array.isArray(parsed.dailyData)) {
      return {
        ...parsed,
        videos: parsed.videos ?? [],
        chartVideos: parsed.chartVideos ?? [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Save to API (MongoDB) when authenticated */
export async function saveYouTubeData(data: StoredYouTubeData): Promise<boolean> {
  try {
    const res = await fetch("/api/youtube", {
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

export async function mergeAndSaveYouTube(
  existing: StoredYouTubeData | null,
  incoming: {
    dailyData: YouTubeDailyRow[];
    videos: YouTubeVideoRow[];
    chartVideos: YouTubeChartVideoRow[];
  },
  channelName = "VimandTonic"
): Promise<StoredYouTubeData> {
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
  await saveYouTubeData(result);
  return result;
}

/** Clear from API (MongoDB) when authenticated */
export async function clearYouTubeData(): Promise<boolean> {
  try {
    const res = await fetch("/api/youtube", {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
