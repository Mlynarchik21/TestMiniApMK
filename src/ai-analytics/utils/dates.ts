export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(date: Date | string | number | null | undefined): string | null {
  if (!date) return null;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

export function isToday(date: string | null): boolean {
  if (!date) return false;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();

  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export function isTomorrow(date: string | null): boolean {
  if (!date) return false;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);

  return (
    d.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    d.getUTCMonth() === tomorrow.getUTCMonth() &&
    d.getUTCDate() === tomorrow.getUTCDate()
  );
}

export function isWithinDays(date: string | null, days: number): boolean {
  if (!date) return false;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const diff = d.getTime() - now.getTime();

  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export function groupEventsByTime<T extends { when: string }>(items: T[]) {
  const today: T[] = [];
  const tomorrow: T[] = [];
  const thisWeek: T[] = [];

  for (const item of items) {
    const iso = toIso(item.when);

    if (!iso) continue;

    if (isToday(iso)) {
      today.push(item);
    } else if (isTomorrow(iso)) {
      tomorrow.push(item);
    } else if (isWithinDays(iso, 7)) {
      thisWeek.push(item);
    }
  }

  return {
    today,
    tomorrow,
    thisWeek,
  };
}

export function sortByDateAsc<T extends { when?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = a.when ? new Date(a.when).getTime() : Infinity;
    const db = b.when ? new Date(b.when).getTime() : Infinity;
    return da - db;
  });
}

export function hoursAgo(date: string | null): number | null {
  if (!date) return null;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const now = Date.now();
  const diff = now - d.getTime();

  return diff / (1000 * 60 * 60);
}