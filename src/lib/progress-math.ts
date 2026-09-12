function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Progress = distance closed toward target, for both increasing and
 *  decreasing goals. E.g. weight loss (current 80 -> target 70) at value 75
 *  is 50%, not a raw value comparison (which would over-report). */
export function computeProgress(
  currentValue: number,
  targetValue: number,
  latestValue: number,
): number {
  if (targetValue === currentValue) {
    return latestValue === targetValue ? 100 : 0;
  }
  const total = Math.abs(targetValue - currentValue);
  const done = Math.abs(latestValue - currentValue);
  if (done >= total) return 100;
  return clamp((done / total) * 100);
}

export function formatDailyDate(date: Date): string {
  return date.toISOString().split("T")[0];
}