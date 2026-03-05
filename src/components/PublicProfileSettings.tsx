"use client";

import { useState, useEffect, useCallback } from "react";

interface PublicProfileSettings {
  enabled: boolean;
  slug: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  dataDateBounds: { min: string; max: string } | null;
  /** When true, show content expanded (no collapse) - for dedicated share page */
  expanded?: boolean;
}

export function PublicProfileSettings({ dataDateBounds, expanded: alwaysExpanded }: Props) {
  const [settings, setSettings] = useState<PublicProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(!!alwaysExpanded);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/settings", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.settings) {
        setSettings(json.settings);
      } else {
        setSettings({
          enabled: false,
          slug: "",
          dateFrom: "",
          dateTo: "",
        });
        if (!res.ok) setError(json.error ?? "Could not load settings");
      }
    } catch {
      setSettings({
        enabled: false,
        slug: "",
        dateFrom: "",
        dateTo: "",
      });
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save");
        return;
      }
      setSettings(json.settings);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleCopyLink = useCallback(() => {
    if (!settings?.enabled || !settings?.slug) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${settings.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [settings?.enabled, settings?.slug]);

  const defaultFrom = dataDateBounds?.min ?? "";
  const defaultTo = dataDateBounds?.max ?? "";

  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-chart-dark-grid/50 bg-chart-dark/40 px-4 py-6 text-center text-chart-green/70">
        Loading…
      </div>
    );
  }

  const settingsSafe = settings ?? {
    enabled: false,
    slug: "",
    dateFrom: "",
    dateTo: "",
  };

  const showContent = alwaysExpanded || expanded;

  return (
    <div className="mb-6 rounded-xl border border-chart-dark-grid/50 bg-chart-dark/40">
      {!alwaysExpanded && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-chart-green hover:bg-chart-dark-card/50"
        >
          <span className="font-medium">Public profile</span>
          <span className="text-chart-green/60">
            {expanded ? "▼" : "▶"} {settingsSafe.enabled ? "Enabled" : "Disabled"}
          </span>
        </button>
      )}
      {showContent && (
        <div className={`px-4 py-4 ${!alwaysExpanded ? "border-t border-chart-dark-grid/50" : ""}`}>
          {error && (
            <p className="mb-3 text-sm text-amber-400">{error}</p>
          )}
          <label className="flex items-center gap-2 text-sm text-chart-green/90">
            <input
              type="checkbox"
              checked={settingsSafe.enabled}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, enabled: e.target.checked } : settingsSafe))
              }
              className="rounded border-chart-dark-grid"
            />
            Make my profile publicly viewable (read-only)
          </label>

          {settingsSafe.enabled && (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-sm text-chart-green/90">
                  Public URL slug
                  <input
                    type="text"
                    value={settingsSafe.slug}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") } : { ...settingsSafe, slug: e.target.value }
                      )
                    }
                    placeholder="my-profile"
                    className="w-40 rounded border border-chart-dark-grid bg-chart-dark-card px-2 py-1.5 text-chart-green focus:border-chart-green"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-chart-green/90">
                  Date range (from)
                  <input
                    type="date"
                    value={settingsSafe.dateFrom || defaultFrom}
                    min={defaultFrom}
                    max={settingsSafe.dateTo || defaultTo || defaultTo}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, dateFrom: e.target.value } : { ...settingsSafe, dateFrom: e.target.value }))
                    }
                    className="rounded border border-chart-dark-grid bg-chart-dark-card px-2 py-1.5 text-chart-green"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-chart-green/90">
                  Date range (to)
                  <input
                    type="date"
                    value={settingsSafe.dateTo || defaultTo}
                    min={settingsSafe.dateFrom || defaultFrom}
                    max={defaultTo}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, dateTo: e.target.value } : { ...settingsSafe, dateTo: e.target.value }))
                    }
                    className="rounded border border-chart-dark-grid bg-chart-dark-card px-2 py-1.5 text-chart-green"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-chart-green/60">
                Only data within this date range will be visible on your public
                profile.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-lg bg-chart-green px-4 py-2 text-sm font-medium text-chart-dark hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                {settingsSafe.enabled && settingsSafe.slug && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="rounded-lg border border-chart-dark-grid px-4 py-2 text-sm text-chart-green/90 hover:bg-chart-dark-card"
                  >
                    {copied ? "Copied!" : "Copy public link"}
                  </button>
                )}
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
