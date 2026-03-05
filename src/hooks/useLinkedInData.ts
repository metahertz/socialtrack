"use client";

import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  parseLinkedInWorkbook,
  toPlatformMetrics,
  type LinkedInPostRow,
} from "@/lib/linkedinImport";
import {
  loadLinkedInData,
  mergeAndSave,
  clearLinkedInData,
  updatePostContentType,
} from "@/lib/linkedinStorage";
import type { PlatformMetrics } from "@/types/social";

export interface PendingImport {
  filename: string;
  dailyImpressions: import("@/lib/linkedinImport").DailyImpressionsRow[];
  posts: LinkedInPostRow[];
  followersByDate: Map<string, number>;
}

export function useLinkedInData() {
  const [stored, setStored] = useState<import("@/lib/linkedinImport").StoredLinkedInData | null>(null);
  const [linkedInMetrics, setLinkedInMetrics] = useState<PlatformMetrics | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const refreshFromStorage = useCallback(async () => {
    setIsLoadingStorage(true);
    try {
      const data = await loadLinkedInData();
      setStored(data);
      if (data?.dailyImpressions?.length || data?.posts?.length) {
        setLinkedInMetrics(
          toPlatformMetrics(data.dailyImpressions, data.posts, data.followersByDate)
        );
      } else {
        setLinkedInMetrics(null);
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
        const buf = await file.arrayBuffer();
        const workbook = XLSX.read(buf, { type: "array" });
        const sheets = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: "",
          }) as unknown[][];
          return { name, rows };
        });

        const { dailyImpressions, posts, followersByDate } = parseLinkedInWorkbook(sheets);

        setPendingImport({
          filename: file.name,
          dailyImpressions,
          posts,
          followersByDate,
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to parse LinkedIn export"
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
      const merged = await mergeAndSave(stored, {
        dailyImpressions: pendingImport.dailyImpressions,
        posts: pendingImport.posts,
        followersByDate: pendingImport.followersByDate,
      });
      setStored(merged);
      setLinkedInMetrics(
        toPlatformMetrics(merged.dailyImpressions, merged.posts, merged.followersByDate)
      );
      setPendingImport(null);
    } finally {
      setIsLoading(false);
    }
  }, [pendingImport, stored]);

  const rejectImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  const confirmRepost = useCallback(
    async (postId: string) => {
      const ok = await updatePostContentType(postId, "repost");
      if (ok) await refreshFromStorage();
      return ok;
    },
    [refreshFromStorage]
  );

  const clear = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearLinkedInData();
      setStored(null);
      setLinkedInMetrics(null);
      setError(null);
      setPendingImport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    linkedInMetrics,
    stored,
    error,
    isLoading,
    isLoadingStorage,
    pendingImport,
    handleFile,
    approveImport,
    rejectImport,
    confirmRepost,
    clear,
    refreshFromStorage,
  };
}
