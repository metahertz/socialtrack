"use client";

import { useState, useCallback, useEffect } from "react";
import {
  parseYouTubeZip,
  toPlatformMetrics,
} from "@/lib/youtubeImport";
import {
  loadYouTubeData,
  mergeAndSaveYouTube,
  clearYouTubeData,
} from "@/lib/youtubeStorage";
import type { PlatformMetrics } from "@/types/social";

const CHANNEL_NAME = "VimandTonic";

export interface PendingYouTubeImport {
  filename: string;
  dailyData: import("@/lib/youtubeImport").YouTubeDailyRow[];
  videos: import("@/lib/youtubeImport").YouTubeVideoRow[];
  chartVideos: import("@/lib/youtubeImport").YouTubeChartVideoRow[];
}

export function useYouTubeData() {
  const [stored, setStored] = useState<import("@/lib/youtubeImport").StoredYouTubeData | null>(null);
  const [youtubeMetrics, setYoutubeMetrics] = useState<PlatformMetrics | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [pendingImport, setPendingImport] = useState<PendingYouTubeImport | null>(null);

  const refreshFromStorage = useCallback(async () => {
    setIsLoadingStorage(true);
    try {
      const data = await loadYouTubeData();
      setStored(data);
      if (data?.dailyData?.length) {
        setYoutubeMetrics(
          toPlatformMetrics(
            data.dailyData,
            data.channelName ?? CHANNEL_NAME,
            data.videos ?? [],
            data.chartVideos ?? []
          )
        );
      } else {
        setYoutubeMetrics(null);
      }
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPendingImport(null);
      setIsLoading(true);
      try {
        if (!file.name.toLowerCase().endsWith(".zip")) {
          setError("Please upload a .zip file containing Chart data.csv and Table data.csv.");
          return;
        }
        const buf = await file.arrayBuffer();
        const { dailyData, videos, chartVideos } = await parseYouTubeZip(buf);
        if (dailyData.length === 0) {
          setError(
            "No valid Chart data.csv found. Expected Day, Video title, Views (one row per day per video)."
          );
          return;
        }

        setPendingImport({
          filename: file.name,
          dailyData,
          videos,
          chartVideos,
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to parse YouTube export"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const approveImport = useCallback(async () => {
    if (!pendingImport) return;
    setIsLoading(true);
    try {
      const merged = await mergeAndSaveYouTube(
        stored,
        {
          dailyData: pendingImport.dailyData,
          videos: pendingImport.videos,
          chartVideos: pendingImport.chartVideos,
        },
        CHANNEL_NAME
      );
      setStored(merged);
      setYoutubeMetrics(
        toPlatformMetrics(
          merged.dailyData,
          merged.channelName ?? CHANNEL_NAME,
          merged.videos ?? [],
          merged.chartVideos ?? []
        )
      );
      setPendingImport(null);
    } finally {
      setIsLoading(false);
    }
  }, [pendingImport, stored]);

  const rejectImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  const clear = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearYouTubeData();
      setStored(null);
      setYoutubeMetrics(null);
      setError(null);
      setPendingImport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    youtubeMetrics,
    stored,
    error,
    isLoading,
    isLoadingStorage,
    pendingImport,
    handleFile,
    approveImport,
    rejectImport,
    clear,
    refreshFromStorage,
  };
}
