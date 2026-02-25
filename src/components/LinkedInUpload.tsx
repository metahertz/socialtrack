"use client";

import { useRef } from "react";

interface LinkedInUploadProps {
  onFile: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  storedPostCount: number | null;
  lastImportedAt: string | null;
  onClear: () => void;
}

export function LinkedInUpload({
  onFile,
  isLoading,
  error,
  storedPostCount,
  lastImportedAt,
  onClear,
}: LinkedInUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
      e.target.value = "";
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-chart-green">
        LinkedIn data
      </h3>
      <p className="mb-3 text-xs text-chart-green/70">
        Upload your Creator Analytics bulk export (Content_*.xlsx). ENGAGEMENT provides daily
        impressions for the chart; TOP POSTS adds post markers and hover totals.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="rounded-lg bg-chart-green px-4 py-2 text-sm font-medium text-chart-dark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Importing…" : "Upload export"}
        </button>
        {storedPostCount != null && storedPostCount > 0 && (
          <>
            <span className="text-sm text-chart-green/80">
              {storedPostCount} post{storedPostCount !== 1 ? "s" : ""} stored
              {lastImportedAt && (
                <> · Last import {formatDate(lastImportedAt)}</>
              )}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-chart-green/60 hover:text-chart-green"
            >
              Clear data
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
