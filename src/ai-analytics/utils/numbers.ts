export function toNumber(v: unknown, fallback: number | null = null): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function safeDivide(a: number | null, b: number | null): number | null {
  if (!Number.isFinite(a ?? NaN) || !Number.isFinite(b ?? NaN) || b === 0) {
    return null;
  }
  return (a as number) / (b as number);
}

export function percentChange(
  current: number | null,
  previous: number | null
): number | null {
  if (
    !Number.isFinite(current ?? NaN) ||
    !Number.isFinite(previous ?? NaN) ||
    previous === 0
  ) {
    return null;
  }

  return ((current as number) - (previous as number)) / (previous as number) * 100;
}

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function formatUsd(value: number | null): string {
  if (!Number.isFinite(value ?? NaN)) return "N/A";

  return `$${(value as number).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBillions(value: number | null): string {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  return `${((value as number) / 1_000_000_000).toFixed(2)}B`;
}

export function formatMillions(value: number | null): string {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  return `${((value as number) / 1_000_000).toFixed(2)}M`;
}

export function formatTrillions(value: number | null): string {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  return `${((value as number) / 1_000_000_000_000).toFixed(2)}T`;
}

export function formatPct(value: number | null): string {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  const n = value as number;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}