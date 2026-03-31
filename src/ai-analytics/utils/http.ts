export type JsonValue = any;

const DEFAULT_JSON_TIMEOUT_MS = 8000;
const DEFAULT_TEXT_TIMEOUT_MS = 8000;

function buildErrorMessage(
  url: string,
  status: number,
  body: string
): string {
  const shortBody = body.length > 300 ? `${body.slice(0, 300)}...` : body;
  return `HTTP ${status} ${url} ${shortBody}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP_TIMEOUT ${timeoutMs}ms ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T = JsonValue>(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_JSON_TIMEOUT_MS
): Promise<T> {
  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        accept: "application/json, text/plain, */*",
        ...(init?.headers || {}),
      },
    },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(buildErrorMessage(url, res.status, text));
  }

  try {
    return (await res.json()) as T;
  } catch (error: any) {
    throw new Error(`INVALID_JSON ${url} ${String(error?.message || error)}`);
  }
}

export async function fetchText(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TEXT_TIMEOUT_MS
): Promise<string> {
  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        accept: "text/html, text/plain, */*",
        "user-agent": "Mozilla/5.0",
        ...(init?.headers || {}),
      },
    },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(buildErrorMessage(url, res.status, text));
  }

  return await res.text();
}

export async function safeFetchJson<T = JsonValue>(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_JSON_TIMEOUT_MS
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
  timeoutMs = DEFAULT_TEXT_TIMEOUT_MS
): Promise<string | null> {
  try {
    return await fetchText(url, init, timeoutMs);
  } catch {
    return null;
  }
}