// app/bot/config/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type KeyRow = {
  id: string;
  exchange: "BINANCE" | "BYBIT" | "OKX";
  label: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  return `${code}${msg}`;
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
  purple: "#9b8cff",
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

function hasWord(label: string | null | undefined, word: string) {
  return new RegExp(word, "i").test(label || "");
}

function getApiBadgeColor(key: KeyRow) {
  if (key.exchange === "BYBIT") return UI.blue;
  if (key.exchange === "BINGX") return UI.yellow;
  return UI.textSoft;
}

function isDemoKey(key: KeyRow) {
  return hasWord(key.label, "demo");
}

function getDisplayLabel(key: KeyRow) {
  const raw = (key.label || "").trim();
  if (!raw) return "Без названия";
  return raw.replace(/\[demo\]\s*/i, "").replace(/\[testnet\]\s*/i, "").trim() || raw;
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

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9 2h6v2h2.5A2.5 2.5 0 0 1 20 6.5v9A3.5 3.5 0 0 1 16.5 19h-9A3.5 3.5 0 0 1 4 15.5v-9A2.5 2.5 0 0 1 6.5 4H9V2Zm-1 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 8 9Zm8 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 16 9Zm-8.5 5h9a2.5 2.5 0 0 1-9 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M9 3h6l1 2h3a1 1 0 1 1 0 2h-1l-.8 11a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7H5a1 1 0 1 1 0-2h3l1-2Zm1.2 4a1 1 0 0 0-1 1l.4 8a1 1 0 1 0 2-.1l-.4-8a1 1 0 0 0-1-.9Zm4.6 0a1 1 0 0 0-1 .9l-.4 8a1 1 0 0 0 2 .1l.4-8a1 1 0 0 0-1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function BotConfigPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 15px)"
  );

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"" | "clear" | "forceClose" | "deleteKey">("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [resp, setResp] = useState<AnyResp | null>(null);

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [config, setConfig] = useState<any>(null);

  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);

  async function loadPage(showLoader = true) {
    if (showLoader) setPageLoading(true);
    setErr("");
    setMsg("");

    try {
      const [keysRes, botRes] = await Promise.all([
        api("/api/keys", { method: "GET" }),
        api("/api/bot", { method: "GET" }),
      ]);

      if (keysRes.json.ok) {
        setKeys((((keysRes.json as any).keys ?? []) as KeyRow[]) || []);
      } else {
        setErr(humanizeError(keysRes.json));
      }

      if (botRes.json.ok) {
        const nextConfig = (botRes.json as any).config ?? null;
        setConfig(nextConfig);
        setSelectedKeyId(nextConfig?.keyId ?? "");
      } else {
        setErr((prev) => prev || humanizeError(botRes.json));
      }

      setResp(botRes.json.ok ? botRes.json : keysRes.json);
    } catch (e: any) {
      setErr(e?.message ?? "fetch error");
    } finally {
      if (showLoader) setPageLoading(false);
    }
  }

  async function saveActiveApi() {
    if (!selectedKeyId) {
      setErr("Сначала выбери API");
      return;
    }

    const selectedKey = keys.find((k) => k.id === selectedKeyId);
    if (!selectedKey) {
      setErr("Выбранный API не найден");
      return;
    }

    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const r = await api("/api/bot", {
        method: "PATCH",
        body: JSON.stringify({
          exchange: selectedKey.exchange,
          keyId: selectedKey.id,
        }),
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setMsg("Активный API для бота сохранён");
      await loadPage(false);
    } catch (e: any) {
      setErr(e?.message ?? "fetch error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    const target = keys.find((k) => k.id === id);
    const label = target ? `${target.exchange} · ${getDisplayLabel(target)}` : "этот API";

    const confirmed = window.confirm(
      `Удалить ${label}? Это действие нельзя отменить.`
    );
    if (!confirmed) return;

    setBusyAction("deleteKey");
    setErr("");
    setMsg("");

    try {
      const r = await api(`/api/keys/${id}`, { method: "DELETE" });
      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      if (selectedKeyId === id) {
        setSelectedKeyId("");
      }
      if (expandedKeyId === id) {
        setExpandedKeyId(null);
      }

      setMsg("API удалён");
      await loadPage(false);
    } catch (e: any) {
      setErr(e?.message ?? "fetch error");
    } finally {
      setBusyAction("");
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm(
      "Очистить всю историю бота? История сделок будет удалена."
    );
    if (!confirmed) return;

    setBusyAction("clear");
    setErr("");
    setMsg("");

    try {
      const r = await api("/api/bot/clear-history", {
        method: "POST",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setMsg("История очищена");
    } catch (e: any) {
      setErr(e?.message ?? "fetch error");
    } finally {
      setBusyAction("");
    }
  }

  async function forceCloseAndClear() {
    const confirmed = window.confirm(
      "Закрыть все сделки по рынку и удалить историю? Это жёсткое действие."
    );
    if (!confirmed) return;

    const secondConfirm = window.confirm(
      "Подтверди ещё раз: все открытые позиции будут закрыты, история очищена."
    );
    if (!secondConfirm) return;

    setBusyAction("forceClose");
    setErr("");
    setMsg("");

    try {
      const r = await api("/api/bot/force-close", {
        method: "POST",
      });

      setResp(r.json);

      if (!r.json.ok) {
        setErr(humanizeError(r.json));
        return;
      }

      setMsg("Все сделки закрыты и история очищена");
    } catch (e: any) {
      setErr(e?.message ?? "fetch error");
    } finally {
      setBusyAction("");
    }
  }

  function handleBack() {
    router.replace("/bot");
  }

  useEffect(() => {
    loadPage(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeKey = useMemo(
    () => keys.find((k) => k.id === (config?.keyId ?? selectedKeyId)) ?? null,
    [keys, config, selectedKeyId]
  );

  const keysByBotExchange = useMemo(() => {
    const exchange = config?.exchange ?? activeKey?.exchange ?? "BYBIT";
    return keys.filter((k) => k.exchange === exchange);
  }, [keys, config, activeKey]);

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

            <div style={styles.pageTitle}>Настройка бота</div>

            <div style={styles.topBarRightSpace} />
          </section>

          <section style={{ ...styles.heroCard, ...reveal(1, mounted) }}>
            <div style={styles.heroRow}>
              <div>
                <div style={styles.heroEyebrow}>BOT CONFIG</div>
                <div style={styles.heroTitle}>Рабочий API</div>
              </div>

              <div style={styles.heroIconWrap}>
                <BotIcon />
              </div>
            </div>

            <div style={styles.heroSub}>
              Здесь выбирается API, через который работает бот. История,
              статистика и открытые ордера должны подтягиваться под активный API.
            </div>

            <div style={styles.activeApiBlock}>
              <div style={styles.activeApiLabel}>Активный API</div>
              <div style={styles.activeApiValue}>
                {activeKey
                  ? `${activeKey.exchange} · ${getDisplayLabel(activeKey)}`
                  : "Не выбран"}
              </div>
            </div>
          </section>

          <section style={{ ...styles.formCard, ...reveal(2, mounted) }}>
            <div style={styles.sectionTitle}>Выбор API для бота</div>

            <label style={styles.fieldWrap}>
              <span style={styles.fieldLabel}>API ключ</span>
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                style={styles.input}
                disabled={pageLoading || saving}
              >
                <option value="">Выбери API</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.exchange} · {getDisplayLabel(k)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={saveActiveApi}
              disabled={!selectedKeyId || pageLoading || saving}
              style={{
                ...styles.primaryButton,
                opacity: !selectedKeyId || pageLoading || saving ? 0.7 : 1,
                cursor:
                  !selectedKeyId || pageLoading || saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving ? "Сохраняю..." : "Сохранить активный API"}
            </button>
          </section>

          <section style={{ ...styles.formCard, ...reveal(3, mounted) }}>
            <div style={styles.sectionTitle}>Мои API</div>

            {!keys.length ? (
              <div style={styles.emptyText}>Сначала добавь API на странице ключей.</div>
            ) : (
              <div style={styles.apiList}>
                {keys.map((key) => {
                  const isActive = config?.keyId === key.id;
                  const isExpanded = expandedKeyId === key.id;
                  const badgeColor = getApiBadgeColor(key);

                  return (
                    <div key={key.id} style={styles.apiCard}>
                      <button
                        type="button"
                        style={styles.apiCardHead}
                        onClick={() =>
                          setExpandedKeyId(isExpanded ? null : key.id)
                        }
                      >
                        <div style={styles.apiCardHeadLeft}>
                          <div style={styles.apiMainLine}>
                            <span style={styles.apiExchange}>{key.exchange}</span>

                            {isDemoKey(key) ? (
                              <span
                                style={{
                                  ...styles.demoBadgeInline,
                                  color: UI.blue,
                                  border: "1px solid rgba(142,178,255,0.26)",
                                  background: "rgba(41,121,255,0.12)",
                                }}
                              >
                                DEMO
                              </span>
                            ) : null}
                          </div>

                          <div style={styles.apiLabelText}>
                            {getDisplayLabel(key)}
                          </div>
                        </div>

                        <div
                          style={{
                            ...styles.statusPill,
                            color: isActive ? UI.green : UI.textMuted,
                            border: isActive
                              ? "1px solid rgba(100,217,123,0.22)"
                              : `1px solid ${UI.border}`,
                            background: isActive
                              ? "rgba(100,217,123,0.08)"
                              : "rgba(255,255,255,0.03)",
                          }}
                        >
                          <span
                            style={{
                              ...styles.statusDot,
                              background: isActive ? UI.green : UI.textFaint,
                            }}
                          />
                          <span>{isActive ? "Активный" : "Не активный"}</span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div style={styles.apiExpanded}>
                          <div style={styles.apiDetailGrid}>
                            <div style={styles.apiDetailItem}>
                              <span style={styles.apiDetailLabel}>Биржа</span>
                              <span style={{ ...styles.apiDetailValue, color: badgeColor }}>
                                {key.exchange}
                              </span>
                            </div>

                            <div style={styles.apiDetailItem}>
                              <span style={styles.apiDetailLabel}>Label</span>
                              <span style={styles.apiDetailValue}>
                                {getDisplayLabel(key)}
                              </span>
                            </div>

                            <div style={styles.apiDetailItem}>
                              <span style={styles.apiDetailLabel}>Статус</span>
                              <span
                                style={{
                                  ...styles.apiDetailValue,
                                  color: isActive ? UI.green : UI.textMuted,
                                }}
                              >
                                {isActive ? "Работает у бота" : "Не выбран"}
                              </span>
                            </div>

                            <div style={styles.apiDetailItem}>
                              <span style={styles.apiDetailLabel}>ID</span>
                              <span style={styles.apiDetailValue}>
                                {key.id}
                              </span>
                            </div>
                          </div>

                          <div style={styles.apiActionRow}>
                            <button
                              type="button"
                              onClick={() => deleteKey(key.id)}
                              disabled={busyAction === "deleteKey"}
                              style={styles.deleteButton}
                            >
                              <span style={styles.deleteIconWrap}>
                                <TrashIcon />
                              </span>
                              <span>
                                {busyAction === "deleteKey"
                                  ? "Удаляю..."
                                  : "Удалить ключ"}
                              </span>
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

          <section style={{ ...styles.dangerCard, ...reveal(4, mounted) }}>
            <div style={styles.sectionTitle}>Сервисные действия</div>

            <div style={styles.dangerSub}>
              Используй эти действия только когда точно понимаешь последствия.
            </div>

            <div style={styles.dangerActions}>
              <button
                type="button"
                onClick={clearHistory}
                disabled={busyAction === "clear" || busyAction === "forceClose"}
                style={styles.warningButton}
              >
                {busyAction === "clear" ? "Очищаю..." : "Очистить всю историю"}
              </button>

              <button
                type="button"
                onClick={forceCloseAndClear}
                disabled={busyAction === "clear" || busyAction === "forceClose"}
                style={styles.forceButton}
              >
                {busyAction === "forceClose"
                  ? "Выполняю..."
                  : "Закрыть все сделки по рынку и удалить историю"}
              </button>
            </div>
          </section>

          {msg ? (
            <section style={{ ...styles.successCard, ...reveal(5, mounted) }}>
              {msg}
            </section>
          ) : null}

          {err ? (
            <section style={{ ...styles.errorCard, ...reveal(6, mounted) }}>
              <div style={styles.errorTitle}>Ошибка</div>
              <div style={styles.errorText}>{err}</div>
            </section>
          ) : null}

          {pageLoading ? (
            <section style={{ ...styles.loadingCard, ...reveal(7, mounted) }}>
              Загрузка настроек...
            </section>
          ) : null}
        </div>
      </main>
    </>
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

  heroCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 22,
    border: `1px solid ${UI.border}`,
    background:
      "linear-gradient(180deg, rgba(41,121,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
  } satisfies CSSProperties,

  heroRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,

  heroEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: UI.blue,
    marginBottom: 8,
  } satisfies CSSProperties,

  heroTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: UI.textMain,
  } satisfies CSSProperties,

  heroSub: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 1.5,
    color: UI.textMuted,
  } satisfies CSSProperties,

  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(41,121,255,0.10)",
    color: UI.blue,
    flexShrink: 0,
  } satisfies CSSProperties,

  activeApiBlock: {
    marginTop: 14,
    borderRadius: 16,
    border: `1px solid ${UI.border}`,
    background: "rgba(255,255,255,0.03)",
    padding: "12px 14px",
  } satisfies CSSProperties,

  activeApiLabel: {
    fontSize: 11,
    color: UI.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    marginBottom: 6,
  } satisfies CSSProperties,

  activeApiValue: {
    fontSize: 16,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.3,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  formCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 22,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
    marginBottom: 18,
  } satisfies CSSProperties,

  dangerCard: {
    border: "1px solid rgba(255,106,106,0.18)",
    borderRadius: 22,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,106,106,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    marginBottom: 18,
  } satisfies CSSProperties,

  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: UI.textMain,
    marginBottom: 10,
  } satisfies CSSProperties,

  fieldWrap: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
  } satisfies CSSProperties,

  fieldLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontWeight: 600,
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

  primaryButton: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: "none",
    background: UI.brand,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    boxShadow: "0 10px 24px rgba(41, 121, 255, 0.18)",
  } satisfies CSSProperties,

  inlineHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: UI.textMuted,
    padding: "2px 2px 0",
  } satisfies CSSProperties,

  apiList: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  apiCard: {
    border: `1px solid ${UI.border}`,
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)",
    overflow: "hidden",
  } satisfies CSSProperties,

  apiCardHead: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: UI.textMain,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  } satisfies CSSProperties,

  apiCardHeadLeft: {
    minWidth: 0,
    display: "grid",
    gap: 6,
  } satisfies CSSProperties,

  apiMainLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  apiExchange: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: UI.textMain,
  } satisfies CSSProperties,

  demoBadgeInline: {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
  } satisfies CSSProperties,

  apiLabelText: {
    fontSize: 15,
    fontWeight: 700,
    color: UI.textSoft,
    lineHeight: 1.35,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
    flexShrink: 0,
  } satisfies CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  } satisfies CSSProperties,

  apiExpanded: {
    padding: "0 14px 14px",
    display: "grid",
    gap: 12,
  } satisfies CSSProperties,

  apiDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  } satisfies CSSProperties,

  apiDetailItem: {
    border: `1px solid ${UI.borderSoft}`,
    borderRadius: 12,
    padding: "10px 11px",
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  } satisfies CSSProperties,

  apiDetailLabel: {
    display: "block",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: UI.textFaint,
    fontWeight: 700,
    marginBottom: 5,
  } satisfies CSSProperties,

  apiDetailValue: {
    fontSize: 11,
    fontWeight: 800,
    color: UI.textMain,
    lineHeight: 1.35,
    wordBreak: "break-word",
  } satisfies CSSProperties,

  apiActionRow: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  deleteButton: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.26)",
    background: "rgba(255,106,106,0.08)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  } satisfies CSSProperties,

  deleteIconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: UI.red,
  } satisfies CSSProperties,

  dangerSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: UI.textMuted,
    marginBottom: 12,
  } satisfies CSSProperties,

  dangerActions: {
    display: "grid",
    gap: 10,
  } satisfies CSSProperties,

  warningButton: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: `1px solid ${UI.borderHard}`,
    background: "rgba(255,255,255,0.03)",
    color: UI.textMain,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  forceButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid rgba(255,106,106,0.26)",
    background: "rgba(255,106,106,0.10)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 14px",
  } satisfies CSSProperties,

  successCard: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(100,217,123,0.22)",
    background: "rgba(100,217,123,0.06)",
    fontSize: 13,
    color: UI.green,
    fontWeight: 700,
    textAlign: "center",
  } satisfies CSSProperties,

  errorCard: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,106,106,0.22)",
    background: "rgba(255,106,106,0.06)",
  } satisfies CSSProperties,

  errorTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: UI.textMain,
    marginBottom: 8,
  } satisfies CSSProperties,

  errorText: {
    fontSize: 12,
    lineHeight: 1.6,
    color: UI.textSoft,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,

  loadingCard: {
    marginTop: 4,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    color: UI.textMuted,
  } satisfies CSSProperties,

  emptyText: {
    fontSize: 12,
    color: UI.textMuted,
    lineHeight: 1.55,
  } satisfies CSSProperties,
};