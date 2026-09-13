"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  fetchWearableMetrics,
  providerLabel,
  syncWearableMetrics,
  type WearableMetric,
  type WearableProvider,
  type WearableSyncResult,
} from "@/lib/wearable";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PROVIDERS: WearableProvider[] = ["apple_health", "google_fit"];

const JSON_HINT = `Send a JSON export with rows like:
{
  "metrics": [
    {
      "date": "2026-09-12",
      "steps": 8421,
      "restingHeartRate": 58,
      "hrvMs": 52,
      "sleepDurationMinutes": 420,
      "sleepScore": 82
    }
  ]
}`;

function shortDate(value: string): string {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}

interface StatsSummary {
  averageSteps: number | null;
  averageRestingHeartRate: number | null;
  averageHrvMs: number | null;
  averageSleepHours: number | null;
  totalSleeps: number;
  lastDate: string | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function summarize(metrics: WearableMetric[]): StatsSummary {
  const steps = metrics.map((m) => m.steps).filter((v): v is number => v != null);
  const rest = metrics
    .map((m) => m.restingHeartRate)
    .filter((v): v is number => v != null);
  const hrv = metrics.map((m) => m.hrvMs).filter((v): v is number => v != null);
  const sleeps = metrics
    .map((m) => m.sleepDurationMinutes)
    .filter((v): v is number => v != null);

  const dates = metrics.map((m) => m.date).sort();
  return {
    averageSteps: average(steps),
    averageRestingHeartRate: average(rest),
    averageHrvMs: average(hrv),
    averageSleepHours:
      sleeps.length > 0
        ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length / 60) * 10) /
          10
        : null,
    totalSleeps: sleeps.length,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

function MetricChip({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {value ?? "—"}
      </p>
    </div>
  );
}

export function WearableCard() {
  const [metrics, setMetrics] = useState<WearableMetric[]>([]);
  const [provider, setProvider] = useState<WearableProvider>("apple_health");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WearableSyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWearableMetrics()
      .then((list) => {
        if (cancelled) return;
        setMetrics(list);
        if (list.length > 0) {
          setProvider(list[0].provider);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load health data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => summarize(metrics), [metrics]);

  const stepsData = useMemo(
    () =>
      metrics
        .filter((m) => m.steps != null)
        .slice(0, 14)
        .reverse()
        .map((m) => ({ date: shortDate(m.date), steps: m.steps as number })),
    [metrics],
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setRawText(text);
    } catch {
      setError("Could not read that file.");
    }
  };

  const handleSync = async () => {
    if (!rawText.trim()) {
      setError("Choose a JSON export or paste one first.");
      return;
    }
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const parsed: unknown = JSON.parse(rawText);
      const syncResult = await syncWearableMetrics(provider, parsed);
      const updated = await fetchWearableMetrics();
      setMetrics(updated);
      setResult(syncResult);
      setRawText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sync failed — check your JSON.",
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Wearable &amp; Health Data</h2>
        {summary.lastDate && (
          <span className="text-xs text-muted-foreground">
            Latest sync: <span className="font-medium text-foreground">{summary.lastDate}</span>
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProvider(p)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              provider === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {providerLabel(p)}
          </button>
        ))}
        {summary.totalSleeps > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Sleep syncs into your Recovery readiness
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
            id="wearable-file-input"
          />
          <label
            htmlFor="wearable-file-input"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Choose JSON export
          </label>
          <Button
            size="sm"
            onClick={() => {
              void handleSync();
            }}
            disabled={syncing || !rawText.trim()}
          >
            {syncing ? "Syncing…" : "Import &amp; sync"}
          </Button>
          {rawText.trim() && (
            <Badge variant="secondary">
              {rawText.trim().length.toLocaleString()} chars ready
            </Badge>
          )}
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={2}
          placeholder={JSON_HINT}
          className="w-full resize-y rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {error && <p className="text-xs text-danger">{error}</p>}
        {result && (
          <p className="text-xs text-success">
            Imported {result.imported} row{result.imported === 1 ? "" : "s"}
            {result.checkInsDerived > 0 &&
              ` · derived ${result.checkInsDerived} recover${result.checkInsDerived === 1 ? "y" : "ies"} check-in${result.checkInsDerived === 1 ? "" : "s"}`}
            {result.errors.length > 0 &&
              ` · ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped`}
            .
          </p>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading health data…</p>
      ) : metrics.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No health data yet. Import an {providerLabel(provider)} export above —
          sleep and recovery fields automatically fill your Recovery readiness.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricChip
              label="Avg steps"
              value={summary.averageSteps?.toLocaleString() ?? null}
            />
            <MetricChip
              label="Resting HR"
              value={
                summary.averageRestingHeartRate != null
                  ? `${summary.averageRestingHeartRate} bpm`
                  : null
              }
            />
            <MetricChip
              label="Avg HRV"
              value={
                summary.averageHrvMs != null
                  ? `${summary.averageHrvMs} ms`
                  : null
              }
            />
            <MetricChip
              label="Avg sleep"
              value={
                summary.averageSleepHours != null
                  ? `${summary.averageSleepHours} h`
                  : null
              }
            />
          </div>

          {stepsData.length >= 2 && (
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stepsData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-muted)" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      borderColor: "var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--color-muted-foreground)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="steps"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}