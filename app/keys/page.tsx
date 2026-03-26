"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Exchange } from "@prisma/client";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type ExchangeOption = "NONE" | "BYBIT" | "BINGX";
type SyncPreset = "1D" | "7D" | "30D" | "90D" | "CUSTOM";

type KeyRow = {
  id: string;
  exchange: Exchange;
  label: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BalanceRow = {
  asset: string;
  free: string;
  locked: string;
};

type KeyMetaState = {
  loading: boolean;
  loaded: boolean;
  ok: boolean;
  error: string;
  updatedAt: number | null;
  balances: BalanceRow[];
  raw: any;
};

type SyncErrorItem = {
  symbol: string;
  message: string;
  updatedAt: string;
};

type KeySyncState = {
  preset: SyncPreset;
  from: string;
  to: string;
  loading: boolean;
  error: string;
  result: {
    synced?: number;
    skipped?: number;
    errors?: number;
    totalFetched?: number;
    from?: string;
    to?: string;
    errorItems?: SyncErrorItem[];
  } | null;
};

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

async function api(
  path: string,
  init?: RequestInit
): Promise<{ status: number; json: AnyResp }> {
  const token = getToken();

  const res = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let json: AnyResp = {
    ok: false,
    error: "BAD_RESPONSE",
    message: "Invalid JSON response",
  };

  try {
    json = (await res.json()) as AnyResp;
  } catch {}

  return { status: res.status, json };
}

function humanizeError(r: AnyResp): string {
  if (!r || (r as any).ok) return "";
  const code = (r as any).error || "ERROR";
  const msg = (r as any).message ? `: ${(r as any).message}` : "";
  const bybitCode =
    (r as any).bybitCode != null ? ` (bybitCode=${String((r as any).bybitCode)})` : "";
  return `${code}${msg}${bybitCode}`;
}

const UI = {
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.09)",
  borderHard: "rgba(255,255,255,0.16)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.96)",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.42)",
  green: "#64d97b",
  red: "#ff6a6a",
  blue: "#8eb2ff",
  brand: "#2979ff",
  yellow: "#f3d709",
  cyan: "#6fdcff",
};

function reveal(index: number, mounted: boolean): CSSProperties {
  return mounted
    ? {
        opacity: 1,
        animationName: "fadeUp",
        animationDuration: "560ms",
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
        willChange: "transform, opacity",
      }
    : {
        opacity: 0,
        transform: "translate3d(0, 14px, 0)",
      };
}

function safeDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateTime(ts: number | string | null | undefined) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts) : safeDate(ts);
  if (!d) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value: unknown, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function hasWord(label: string | null | undefined, word: string) {
  return new RegExp(word, "i").test(label || "");
}

function isBybitDemoKey(
  key: Pick<KeyRow, "exchange" | "label"> | null | undefined
) {
  if (!key) return false;
  return key.exchange === "BYBIT" && hasWord(key.label, "demo");
}

function getNetworkName(key: Pick<KeyRow, "exchange" | "label">): "DEMO" | "MAINNET" {
  return isBybitDemoKey(key) ? "DEMO" : "MAINNET";
}

function cleanDisplayLabel(label: string | null | undefined) {
  const raw = String(label || "").trim();
  if (!raw) return "Без названия";
  return raw
    .replace(/\[DEMO\]/gi, "")
    .replace(/\bDEMO\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildStoredLabel(
  rawLabel: string,
  exchange: ExchangeOption,
  opts: { isDemo: boolean }
): string | null {
  const clean = rawLabel.trim();

  if (exchange === "BYBIT" && opts.isDemo) {
    if (!clean) return "[DEMO]";
    if (/demo/i.test(clean)) return clean;
    return `[DEMO] ${clean}`;
  }

  return clean || null;
}

function getExchangeUiLabel(value: Exchange | ExchangeOption) {
  if (value === "NONE") return "Нет";
  if (value === "BINGX") return "BingX";
  if (value === "BYBIT") return "Bybit";
  return String(value);
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M6.7 9.3a1 1 0 0 1 1.4 0L12 13.17l3.9-3.87a1 1 0 1 1 1.4 1.42l-4.6 4.55a1 1 0 0 1-1.4 0L6.7 10.72a1 1 0 0 1 0-1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

function toLocalDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function defaultSyncState(): KeySyncState {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);

  return {
    preset: "7D",
    from: toLocalDateTimeInputValue(from),
    to: toLocalDateTimeInputValue(now),
    loading: false,
    error: "",
    result: null,
  };
}

export default function KeysPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  const [resp, setResp] = useState<AnyResp | null>(null);
  const [err, setErr] = useState("");

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [metaByKey, setMetaByKey] = useState<Record<string, KeyMetaState>>({});
  const [syncByKey, setSyncByKey] = useState<Record<string, KeySyncState>>({});
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);

  const [exchange, setExchange] = useState<ExchangeOption>("BYBIT");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isDemo, setIsDemo] = useState(false);

  const canSave = exchange === "BYBIT" && !!apiKey.trim() && !!apiSecret.trim() && !loading;

  function getSyncState(keyId: string): KeySyncState {
    return syncByKey[keyId] ?? defaultSyncState();
  }

  function patchSyncState(keyId: string, patch: Partial<KeySyncState>) {
    setSyncByKey((prev) => ({
      ...prev,
      [keyId]: {
        ...(prev[keyId] ?? defaultSyncState()),
        ...patch,
      },
    }));
  }

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/keys", { method: "GET" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      const rows = ((r.json as any).keys ?? []) as KeyRow[];
      setKeys(rows);
    } finally {
      setLoading(false);
    }
  }

  async function addKey() {
    if (exchange === "NONE" || exchange === "BINGX") {
      setErr("Сейчас подключение доступно только для Bybit.");
      return;
    }

    if (!apiKey.trim() || !apiSecret.trim()) {
      setErr("Заполни API key и API secret key.");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const storedLabel = buildStoredLabel(label, exchange, { isDemo });

      const r = await api("/api/keys", {
        method: "POST",
        body: JSON.stringify({
          exchange,
          label: storedLabel,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        }),
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setLabel("");
      setApiKey("");
      setApiSecret("");
      setIsDemo(false);

      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function delKey(id: string) {
    setLoading(true);
    setErr("");

    try {
      const r = await api(`/api/keys/${id}`, { method: "DELETE" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setMetaByKey((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setSyncByKey((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      if (expandedKeyId === id) {
        setExpandedKeyId(null);
      }

      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance(key: KeyRow) {
    const keyId = key.id;

    setMetaByKey((prev) => ({
      ...prev,
      [keyId]: {
        loading: true,
        loaded: prev[keyId]?.loaded ?? false,
        ok: prev[keyId]?.ok ?? false,
        error: "",
        updatedAt: prev[keyId]?.updatedAt ?? null,
        balances: prev[keyId]?.balances ?? [],
        raw: prev[keyId]?.raw ?? null,
      },
    }));

    try {
      const r = await api(`/api/balance?keyId=${encodeURIComponent(keyId)}`, {
        method: "GET",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setMetaByKey((prev) => ({
          ...prev,
          [keyId]: {
            loading: false,
            loaded: true,
            ok: false,
            error: humanizeError(r.json),
            updatedAt: Date.now(),
            balances: [],
            raw: null,
          },
        }));
        return;
      }

      setMetaByKey((prev) => ({
        ...prev,
        [keyId]: {
          loading: false,
          loaded: true,
          ok: true,
          error: "",
          updatedAt: Date.now(),
          balances: (((r.json as any).balances ?? []) as BalanceRow[]) || [],
          raw: (r.json as any).raw ?? null,
        },
      }));
    } catch (e: any) {
      setMetaByKey((prev) => ({
        ...prev,
        [keyId]: {
          loading: false,
          loaded: true,
          ok: false,
          error: e?.message ?? "Balance request failed",
          updatedAt: Date.now(),
          balances: [],
          raw: null,
        },
      }));
    }
  }

  async function syncHistory(key: KeyRow) {
    const state = getSyncState(key.id);

    patchSyncState(key.id, {
      loading: true,
      error: "",
      result: null,
    });

    try {
      const body =
        state.preset === "CUSTOM"
          ? {
              keyId: key.id,
              preset: "CUSTOM",
              from: new Date(state.from).toISOString(),
              to: new Date(state.to).toISOString(),
            }
          : {
              keyId: key.id,
              preset: state.preset,
            };

      const r = await api("/api/bot/sync-history", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setResp(r.json);

      if (!r.json.ok) {
        patchSyncState(key.id, {
          loading: false,
          error: humanizeError(r.json),
        });
        return;
      }

      patchSyncState(key.id, {
        loading: false,
        error: "",
        result: {
          synced: (r.json as any).synced ?? 0,
          skipped: (r.json as any).skipped ?? 0,
          errors: (r.json as any).errors ?? 0,
          totalFetched: (r.json as any).totalFetched ?? 0,
          from: (r.json as any).from,
          to: (r.json as any).to,
          errorItems: (r.json as any).errorItems ?? [],
        },
      });
    } catch (e: any) {
      patchSyncState(key.id, {
        loading: false,
        error: e?.message ?? "Sync failed",
      });
    }
  }

  function handleBack() {
    router.replace("/home");
  }

  useEffect(() => {
    reload();

    const tg = (window as any)?.Telegram?.WebApp;

    const updateLayout = () => {
      if (tg?.isFullscreen) {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 88px)");
      } else {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 15px)");
      }
    };

    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#000000");
      tg?.setBackgroundColor?.("#000000");

      updateLayout();

      if (tg?.onEvent) {
        tg.onEvent("fullscreen_changed", updateLayout);
      }
    } catch {}

    const id = requestAnimationFrame(() => setMounted(true));

    return () => {
      cancelAnimationFrame(id);
      try {
        if (tg?.offEvent) {
          tg.offEvent("fullscreen_changed", updateLayout);
        }
      } catch {}
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow-x: hidden;
        }

        select,
        input,
        button,
        textarea {
          font: inherit;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      <main style={{ ...styles.page, paddingTop: pagePaddingTop }}>
        <div style={styles.container}>
          <section style={{ ...styles.topBar, ...reveal(0, mounted) }}>
            <button
              type="button"
              aria-label="Назад"
              style={styles.backButton}
              onClick={handleBack}
            >
              <ArrowLeftIcon />
            </button>

            <div style={styles.pageTitle}>API Keys</div>

            <div style={styles.topBarRightSpace} />
          </section>

          <section style={{ ...styles.formBlock, ...reveal(1, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Добавить API</div>
            </div>

            <div style={styles.formGrid}>
              <Field label="Биржа">
                <div style={styles.selectWrap}>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value as ExchangeOption)}
                    style={styles.inputSelect}
                  >
                    <option value="NONE">Нет</option>
                    <option value="BYBIT">Bybit</option>
                    <option value="BINGX">BingX</option>
                  </select>
                  <span style={styles.selectIcon}>
                    <ChevronDownIcon />
                  </span>
                </div>
              </Field>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                  disabled={exchange !== "BYBIT"}
                  style={styles.checkbox}
                />
                <span style={styles.checkboxText}>Демо</span>
              </label>

              <Field label="Label">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Например: TestByBitapi"
                  style={styles.input}
                />
              </Field>

              <Field label="API key">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Вставь API key"
                  style={styles.input}
                  autoComplete="off"
                />
              </Field>

              <Field label="API secret key">
                <input
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Вставь API secret key"
                  style={styles.input}
                  type="password"
                  autoComplete="off"
                />
              </Field>

              {exchange !== "BYBIT" ? (
                <div style={styles.inlineHint}>
                  Сейчас подключение доступно только для Bybit. Пункты «Нет» и «BingX» оставлены
                  под будущее расширение.
                </div>
              ) : null}

              <button
                type="button"
                disabled={!canSave}
                onClick={addKey}
                style={{
                  ...styles.primaryButton,
                  opacity: canSave ? 1 : 0.7,
                  cursor: canSave ? "pointer" : "not-allowed",
                }}
              >
                {loading ? "..." : "Сохранить"}
              </button>
            </div>
          </section>

          <section style={{ ...styles.keysBlock, ...reveal(2, mounted) }}>
            <div style={styles.sectionHead}>
              <div style={styles.sectionMainTitle}>Мои API</div>
            </div>

            {!keys.length ? (
              <div style={styles.emptyText}>Пока нет сохраненных API ключей.</div>
            ) : (
              <div style={styles.keysList}>
                {keys.map((key) => {
                  const meta = metaByKey[key.id];
                  const syncState = getSyncState(key.id);
                  const open = expandedKeyId === key.id;

                  const statusText = meta?.loaded
                    ? meta.ok
                      ? "Активный"
                      : "Не активный"
                    : "Не проверен";

                  const balanceValue =
                    meta?.loaded && meta.ok
                      ? meta.balances.length
                        ? `${meta.balances.length} монет`
                        : "0"
                      : "—";

                  return (
                    <div key={key.id} style={styles.keyCard}>
                      <button
                        type="button"
                        style={styles.keyCardHead}
                        onClick={() => {
                          const nextOpen = !open;
                          setExpandedKeyId(nextOpen ? key.id : null);
                          if (nextOpen && !meta?.loaded && !meta?.loading) {
                            refreshBalance(key);
                          }
                        }}
                      >
                        <div style={styles.keyCardMain}>
                          <div style={styles.keyCardTopLine}>
                            <div style={styles.keyCardTitleGroup}>
                              <div style={styles.keyCardTitle}>
                                {getExchangeUiLabel(key.exchange)}
                              </div>

                              {getNetworkName(key) === "DEMO" ? (
                                <span style={styles.networkPill}>DEMO</span>
                              ) : null}
                            </div>

                            <div
                              style={{
                                ...styles.statusBadge,
                                color:
                                  statusText === "Активный"
                                    ? UI.green
                                    : statusText === "Не активный"
                                    ? UI.red
                                    : UI.textMuted,
                                borderColor:
                                  statusText === "Активный"
                                    ? "rgba(100,217,123,0.22)"
                                    : statusText === "Не активный"
                                    ? "rgba(255,106,106,0.22)"
                                    : "rgba(255,255,255,0.16)",
                                background:
                                  statusText === "Активный"
                                    ? "rgba(100,217,123,0.08)"
                                    : statusText === "Не активный"
                                    ? "rgba(255,106,106,0.08)"
                                    : "rgba(255,255,255,0.05)",
                              }}
                            >
                              <span
                                style={{
                                  ...styles.statusDot,
                                  background:
                                    statusText === "Активный"
                                      ? UI.green
                                      : statusText === "Не активный"
                                      ? UI.red
                                      : UI.textFaint,
                                }}
                              />
                              <span>{statusText}</span>
                            </div>
                          </div>

                          <div style={styles.keyCardLabel}>
                            {cleanDisplayLabel(key.label)}
                          </div>
                        </div>
                      </button>

                      {open ? (
                        <div style={styles.keyCardBody}>
                          <div style={styles.metaGrid}>
                            <MiniInfo
                              label="Баланс счета"
                              value={balanceValue}
                              color={UI.blue}
                            />
                            <MiniInfo
                              label="Последнее обновление"
                              value={formatDateTime(meta?.updatedAt ?? null)}
                              color={UI.textMain}
                            />
                            <MiniInfo
                              label="Статус ключа"
                              value={meta?.loaded ? (meta.ok ? "Рабочий" : "Не рабочий") : "Проверка..."}
                              color={meta?.loaded ? (meta.ok ? UI.green : UI.red) : UI.textMuted}
                            />
                            <MiniInfo
                              label="ID ключа"
                              value={key.id}
                              color={UI.textSoft}
                            />
                          </div>

                          <div style={styles.permissionBlock}>
                            <div style={styles.permissionTitle}>Разрешения</div>

                            <div style={styles.permissionGrid}>
                              <PermissionPill
                                label="Чтение баланса"
                                active={!!meta?.ok}
                              />
                              <PermissionPill
                                label="Торговля"
                                active={false}
                                unknown
                              />
                              <PermissionPill
                                label="Вывод средств"
                                active={false}
                                unknown
                              />
                            </div>

                            <div style={styles.permissionHint}>
                              Сейчас точно определяется только успешное чтение баланса.
                              Проверку торговых и withdrawal permissions добавим следующим этапом.
                            </div>
                          </div>

                          {meta?.error ? (
                            <div style={styles.errorInline}>{meta.error}</div>
                          ) : null}

                          {meta?.ok && meta.balances.length ? (
                            <div style={styles.balanceBlock}>
                              <div style={styles.balanceHead}>
                                <div style={styles.balanceTitle}>Баланс</div>
                                <div style={styles.balanceSub}>
                                  Активов: {meta.balances.length}
                                </div>
                              </div>

                              <div style={styles.balanceList}>
                                {meta.balances.slice(0, 12).map((row) => (
                                  <div key={row.asset} style={styles.balanceRow}>
                                    <div style={styles.balanceAsset}>{row.asset}</div>
                                    <div style={styles.balanceValues}>
                                      free {formatAmount(row.free)} · locked{" "}
                                      {formatAmount(row.locked)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {meta.balances.length > 12 ? (
                                <div style={styles.moreText}>
                                  Показано 12 из {meta.balances.length}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div style={styles.syncBlock}>
                            <div style={styles.syncTitle}>Синхронизация истории</div>

                            <div style={styles.syncGrid}>
                              <div style={styles.selectWrap}>
                                <select
                                  value={syncState.preset}
                                  onChange={(e) =>
                                    patchSyncState(key.id, {
                                      preset: e.target.value as SyncPreset,
                                      error: "",
                                      result: null,
                                    })
                                  }
                                  style={styles.inputSelect}
                                  disabled={syncState.loading}
                                >
                                  <option value="1D">Последние 24 часа</option>
                                  <option value="7D">Последние 7 дней</option>
                                  <option value="30D">Последние 30 дней</option>
                                  <option value="90D">Последние 90 дней</option>
                                  <option value="CUSTOM">Свой период</option>
                                </select>
                                <span style={styles.selectIcon}>
                                  <ChevronDownIcon />
                                </span>
                              </div>

                              {syncState.preset === "CUSTOM" ? (
                                <>
                                  <input
                                    type="datetime-local"
                                    value={syncState.from}
                                    onChange={(e) =>
                                      patchSyncState(key.id, {
                                        from: e.target.value,
                                        error: "",
                                        result: null,
                                      })
                                    }
                                    style={styles.input}
                                    disabled={syncState.loading}
                                  />
                                  <input
                                    type="datetime-local"
                                    value={syncState.to}
                                    onChange={(e) =>
                                      patchSyncState(key.id, {
                                        to: e.target.value,
                                        error: "",
                                        result: null,
                                      })
                                    }
                                    style={styles.input}
                                    disabled={syncState.loading}
                                  />
                                </>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => syncHistory(key)}
                                disabled={syncState.loading}
                                style={styles.syncButton}
                              >
                                {syncState.loading ? "Подтягиваю..." : "Подтянуть историю"}
                              </button>
                            </div>

                            {syncState.error ? (
                              <div style={styles.errorInline}>{syncState.error}</div>
                            ) : null}

                            {syncState.result ? (
                              <div style={styles.syncResultCard}>
                                <div style={styles.syncResultRow}>
                                  <span>Найдено на бирже</span>
                                  <strong>{syncState.result.totalFetched ?? 0}</strong>
                                </div>
                                <div style={styles.syncResultRow}>
                                  <span>Добавлено в БД</span>
                                  <strong>{syncState.result.synced ?? 0}</strong>
                                </div>
                                <div style={styles.syncResultRow}>
                                  <span>Пропущено</span>
                                  <strong>{syncState.result.skipped ?? 0}</strong>
                                </div>
                                <div style={styles.syncResultRow}>
                                  <span>Ошибки</span>
                                  <strong>{syncState.result.errors ?? 0}</strong>
                                </div>
                                <div style={styles.syncPeriodText}>
                                  {syncState.result.from || "—"} → {syncState.result.to || "—"}
                                </div>

                                {Array.isArray(syncState.result.errorItems) &&
                                syncState.result.errorItems.length > 0 ? (
                                  <div style={styles.syncErrorsWrap}>
                                    <div style={styles.syncErrorsTitle}>Первые ошибки:</div>
                                    {syncState.result.errorItems.map((item, i) => (
                                      <div
                                        key={`${item.symbol}-${item.updatedAt}-${i}`}
                                        style={styles.syncErrorCard}
                                      >
                                        <div style={styles.syncErrorSymbol}>{item.symbol}</div>
                                        <div style={styles.syncErrorMsg}>{item.message}</div>
                                        <div style={styles.syncErrorTime}>{item.updatedAt}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div style={styles.actionsRow}>
                            <button
                              type="button"
                              disabled={!!meta?.loading || syncState.loading}
                              onClick={() => refreshBalance(key)}
                              style={styles.ghostButton}
                            >
                              {meta?.loading ? "..." : "Обновить баланс"}
                            </button>

                            <button
                              type="button"
                              disabled={loading || syncState.loading}
                              onClick={() => delKey(key.id)}
                              style={styles.dangerButton}
                            >
                              Удалить ключ
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(3, mounted) }}>
              <div style={styles.sectionMainTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{props.label}</span>
      {props.children}
    </label>
  );
}

function MiniInfo(props: { label: string; value: string; color?: string }) {
  return (
    <div style={styles.miniInfoCard}>
      <div style={styles.miniInfoLabel}>{props.label}</div>
      <div style={{ ...styles.miniInfoValue, color: props.color || UI.textMain }}>
        {props.value}
      </div>
    </div>
  );
}

function PermissionPill(props: {
  label: string;
  active: boolean;
  unknown?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.permissionPill,
        color: props.unknown
          ? UI.textMuted
          : props.active
          ? UI.green
          : UI.red,
        borderColor: props.unknown
          ? "rgba(255,255,255,0.14)"
          : props.active
          ? "rgba(100,217,123,0.22)"
          : "rgba(255,106,106,0.22)",
        background: props.unknown
          ? "rgba(255,255,255,0.04)"
          : props.active
          ? "rgba(100,217,123,0.08)"
          : "rgba(255,106,106,0.08)",
      }}
    >
      <span
        style={{
          ...styles.permissionDot,
          background: props.unknown
            ? UI.textFaint
            : props.active
            ? UI.green
            : UI.red,
        }}
      />
      <span>{props.label}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: UI.text,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    overflowX: "hidden",
  } satisfies CSSProperties,

  container: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "0 16px",
    overflowX: "hidden",
  } satisfies CSSProperties,

  topBar: {
    marginTop: 8,
    marginBottom: 18,
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.04)",
    color: UI.textMain,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties,

  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: UI.textMain,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
  } satisfies CSSProperties,

  topBarRightSpace: {
    width: 44,
    height: 44,
  } satisfies CSSProperties,

  formBlock: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 22,
    border: `1px solid ${UI.border}`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
  } satisfies CSSProperties,

  keysBlock: {
    marginBottom: 20,
    paddingBottom: 4,
  } satisfies CSSProperties,

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,

  sectionMainTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: UI.textMain,
  } satisfies CSSProperties,

  formGrid: {
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  fieldWrap: {
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  fieldLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  selectWrap: {
    position: "relative",
    width: "100%",
  } satisfies CSSProperties,

  selectIcon: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: UI.textMuted,
    pointerEvents: "none",
  } satisfies CSSProperties,

  inputSelect: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    outline: "none",
    padding: "0 42px 0 14px",
    WebkitAppearance: "none",
    appearance: "none",
  } satisfies CSSProperties,

  input: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    outline: "none",
    padding: "0 14px",
    WebkitAppearance: "none",
    appearance: "none",
  } satisfies CSSProperties,

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 16,
    color: UI.textSoft,
    fontWeight: 700,
    padding: "2px 2px 0",
  } satisfies CSSProperties,

  checkbox: {
    width: 20,
    height: 20,
    accentColor: UI.brand,
  } satisfies CSSProperties,

  checkboxText: {
    fontSize: 16,
    fontWeight: 700,
    color: UI.textMain,
  } satisfies CSSProperties,

  inlineHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: UI.textMuted,
  } satisfies CSSProperties,

  primaryButton: {
    width: "100%",
    height: 46,
    borderRadius: 999,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  keysList: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  keyCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 20,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
    overflow: "hidden",
  } satisfies CSSProperties,

  keyCardHead: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: UI.textMain,
    padding: 14,
    display: "block",
    cursor: "pointer",
    textAlign: "left",
  } satisfies CSSProperties,

  keyCardMain: {
    minWidth: 0,
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  keyCardTopLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  } satisfies CSSProperties,

  keyCardTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  keyCardTitle: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: UI.textMain,
  } satisfies CSSProperties,

  keyCardLabel: {
    fontSize: 14,
    color: UI.textSoft,
    fontWeight: 700,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  networkPill: {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 9px",
    borderRadius: 999,
    border: `1px solid rgba(111,220,255,0.20)`,
    background: "rgba(111,220,255,0.10)",
    color: UI.cyan,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
  } satisfies CSSProperties,

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  } satisfies CSSProperties,

  keyCardBody: {
    padding: "0 14px 14px",
    borderTop: `1px solid ${UI.borderSoft}`,
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  } satisfies CSSProperties,

  miniInfoCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  } satisfies CSSProperties,

  miniInfoLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 6,
  } satisfies CSSProperties,

  miniInfoValue: {
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  permissionBlock: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
  } satisfies CSSProperties,

  permissionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
    marginBottom: 10,
  } satisfies CSSProperties,

  permissionGrid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  permissionPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 700,
  } satisfies CSSProperties,

  permissionDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  } satisfies CSSProperties,

  permissionHint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 1.5,
    color: UI.textMuted,
  } satisfies CSSProperties,

  errorInline: {
    fontSize: 12,
    color: UI.red,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  balanceBlock: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
  } satisfies CSSProperties,

  balanceHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  } satisfies CSSProperties,

  balanceTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  balanceSub: {
    fontSize: 11,
    color: UI.textMuted,
    fontWeight: 600,
  } satisfies CSSProperties,

  balanceList: {
    display: "grid",
    gap: 6,
  } satisfies CSSProperties,

  balanceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 12,
    border: `1px solid ${UI.borderSoft}`,
    background: "rgba(255,255,255,0.015)",
  } satisfies CSSProperties,

  balanceAsset: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  balanceValues: {
    fontSize: 12,
    fontWeight: 600,
    color: UI.textSoft,
    textAlign: "right",
  } satisfies CSSProperties,

  moreText: {
    marginTop: 8,
    fontSize: 11,
    color: UI.textMuted,
  } satisfies CSSProperties,

  syncBlock: {
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
  } satisfies CSSProperties,

  syncTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: UI.textMain,
    marginBottom: 10,
  } satisfies CSSProperties,

  syncGrid: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  syncButton: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  syncResultCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${UI.borderSoft}`,
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  syncResultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    color: UI.textSoft,
  } satisfies CSSProperties,

  syncPeriodText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 1.5,
    color: UI.textMuted,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  syncErrorsWrap: {
    marginTop: 10,
    display: "grid",
    gap: 8,
  } satisfies CSSProperties,

  syncErrorsTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: UI.textMain,
  } satisfies CSSProperties,

  syncErrorCard: {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,106,106,0.18)",
    background: "rgba(255,106,106,0.05)",
    display: "grid",
    gap: 4,
  } satisfies CSSProperties,

  syncErrorSymbol: {
    fontSize: 12,
    fontWeight: 800,
    color: UI.red,
  } satisfies CSSProperties,

  syncErrorMsg: {
    fontSize: 12,
    lineHeight: 1.45,
    color: UI.textSoft,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  syncErrorTime: {
    fontSize: 11,
    color: UI.textMuted,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  actionsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  } satisfies CSSProperties,

  ghostButton: {
    height: 42,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  dangerButton: {
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.24)",
    background: "rgba(255,106,106,0.06)",
    color: UI.red,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.55,
    padding: "4px 2px 0",
  } satisfies CSSProperties,

  errorCard: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.06)",
  } satisfies CSSProperties,

  errorText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
};