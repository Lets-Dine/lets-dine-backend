const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pulls a requested `from` forward so history older than the plan's retention
 * window is never returned. No retention means the full history is kept.
 */
export function clampToRetention(from: Date | undefined, retentionDays: number | undefined, now: Date): Date | undefined {
  if (retentionDays === undefined) return from;
  const earliest = new Date(now.getTime() - retentionDays * DAY_MS);
  return from && from > earliest ? from : earliest;
}
