"use client";

import { useRef } from "react";

interface YouTubeUploadProps {
  onFile: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  storedDayCount: number | null;
  storedDateRange: string | null;
  onClear: () => void;
}

export function YouTubeUpload({
  onFile,
  isLoading,
  error,
  storedDayCount,
  storedDateRange,
  onClear,
}: YouTubeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-chart-dark-grid bg-chart-dark-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-chart-green">
        YouTube (VimandTonic) data
      </h3>
      <p className="mb-3 text-xs text-chart-green/70">
        Upload a .zip export containing Chart data.csv (daily viewers) and Table data.csv
        (subscribers and impressions per video).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
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
        {storedDayCount != null && storedDayCount > 0 && (
          <>
            <span className="text-sm text-chart-green/80">
              {storedDayCount} day{storedDayCount !== 1 ? "s" : ""} stored
              {storedDateRange && (
                <> · {storedDateRange}</>
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
