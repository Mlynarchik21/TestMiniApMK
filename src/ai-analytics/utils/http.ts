export type JsonValue = any;

export async function fetchJson<T = JsonValue>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${url} ${text}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "text/html, text/plain, */*",
        "user-agent": "Mozilla/5.0",
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${url} ${text}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function safeFetchJson<T = JsonValue>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, init, timeoutMs);
  } catch {
    return null;
  }
}

export async function safeFetchText(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<string | null> {
  try {
    return await fetchText(url, init, timeoutMs);
  } catch {
    return null;
  }
}