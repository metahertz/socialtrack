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
} from "@/lib/linkedinStorage";
import type { PlatformMetrics } from "@/types/social";

export interface PendingImport {
  filename: string;
  dailyImpressions: import("@/lib/linkedinImport").DailyImpressionsRow[];
  posts: LinkedInPostRow[];
  followersByDate: Map<string, number>;
  dateRange?: { start: string; end: string };
}

function extractDateRangeFromFilename(filename: string): {
  start?: string;
  end?: string;
} | undefined {
  const match = filename.match(
    /(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/
  );
  if (match) {
    return { start: match[1], end: match[2] };
  }
  return undefined;
}

export function useLinkedInData() {
  const [stored, setStored] = useState(loadLinkedInData());
  const [linkedInMetrics, setLinkedInMetrics] = useState<PlatformMetrics | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const refreshFromStorage = useCallback(() => {
    const data = loadLinkedInData();
    setStored(data);
    if (data?.dailyImpressions?.length || data?.posts?.length) {
      setLinkedInMetrics(
        toPlatformMetrics(data.dailyImpressions, data.posts, data.followersByDate)
      );
    } else {
      setLinkedInMetrics(null);
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
        const range = extractDateRangeFromFilename(file.name);
        const dateRange =
          range?.start && range?.end ? { start: range.start, end: range.end } : undefined;

        setPendingImport({
          filename: file.name,
          dailyImpressions,
          posts,
          followersByDate,
          dateRange,
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

  const approveImport = useCallback(() => {
    if (!pendingImport) return;
    const merged = mergeAndSave(
      stored,
      {
        dailyImpressions: pendingImport.dailyImpressions,
        posts: pendingImport.posts,
        followersByDate: pendingImport.followersByDate,
      },
      pendingImport.dateRange
    );
    setStored(merged);
    setLinkedInMetrics(
      toPlatformMetrics(merged.dailyImpressions, merged.posts, merged.followersByDate)
    );
    setPendingImport(null);
  }, [pendingImport, stored]);

  const rejectImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  const clear = useCallback(() => {
    clearLinkedInData();
    setStored(null);
    setLinkedInMetrics(null);
    setError(null);
    setPendingImport(null);
  }, []);

  return {
    linkedInMetrics,
    stored,
    error,
    isLoading,
    pendingImport,
    handleFile,
    approveImport,
    rejectImport,
    clear,
    refreshFromStorage,
  };
}
