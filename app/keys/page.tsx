"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exchange } from "@prisma/client";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

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

  let json: AnyResp = { ok: false, error: "BAD_RESPONSE", message: "Invalid JSON response" };
  try {
    json = (await res.json()) as AnyResp;
  } catch {}

  return { status: res.status, json };
}

function humanizeError(r: AnyResp): string {
  if (!r || (r as any).ok) return "";
  const code = (r as any).error || "ERROR";
  const msg = (r as any).message ? `: ${(r as any).message}` : "";
  const binanceCode =
    (r as any).binanceCode != null ? ` (binanceCode=${String((r as any).binanceCode)})` : "";
  const hint = (r as any).hint ? `\nПодсказка: ${String((r as any).hint)}` : "";
  return `${code}${msg}${binanceCode}${hint}`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function hasWord(label: string | null | undefined, word: string) {
  return new RegExp(word, "i").test(label || "");
}

function isBinanceTestnetKey(key: Pick<KeyRow, "exchange" | "label">): boolean {
  return key.exchange === ("BINANCE" as Exchange) && hasWord(key.label, "testnet");
}

function isBybitDemoKey(key: Pick<KeyRow, "exchange" | "label">): boolean {
  return key.exchange === ("BYBIT" as Exchange) && hasWord(key.label, "demo");
}

function getNetworkName(key: Pick<KeyRow, "exchange" | "label">): "TESTNET" | "DEMO" | "MAINNET" {
  if (isBinanceTestnetKey(key)) return "TESTNET";
  if (isBybitDemoKey(key)) return "DEMO";
  return "MAINNET";
}

function buildStoredLabel(
  rawLabel: string,
  exchange: Exchange,
  opts: { isTestnet: boolean; isDemo: boolean }
): string | null {
  const clean = rawLabel.trim();

  if (exchange === ("BINANCE" as Exchange) && opts.isTestnet) {
    if (!clean) return "[TESTNET]";
    if (/testnet/i.test(clean)) return clean;
    return `[TESTNET] ${clean}`;
  }

  if (exchange === ("BYBIT" as Exchange) && opts.isDemo) {
    if (!clean) return "[DEMO]";
    if (/demo/i.test(clean)) return clean;
    return `[DEMO] ${clean}`;
  }

  return clean || null;
}

export default function KeysPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AnyResp | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);

  const [balancesByKey, setBalancesByKey] = useState<Record<string, BalanceRow[]>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});
  const [balanceErrorByKey, setBalanceErrorByKey] = useState<Record<string, string>>({});
  const [balanceUpdatedAtByKey, setBalanceUpdatedAtByKey] = useState<Record<string, number>>({});

  const [exchange, setExchange] = useState<Exchange>("BINANCE" as Exchange);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [isTestnet, setIsTestnet] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const [tokenState, setTokenState] = useState<string>("");

  useEffect(() => {
    setTokenState(getToken());
    const t = setInterval(() => setTokenState(getToken()), 800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (exchange !== ("BINANCE" as Exchange)) {
      setIsTestnet(false);
    }
    if (exchange !== ("BYBIT" as Exchange)) {
      setIsDemo(false);
    }
  }, [exchange]);

  const tokenPreview = useMemo(() => {
    const t = tokenState;
    return t ? `${t.slice(0, 6)}…${t.slice(-6)} (len=${t.length})` : "нет токена";
  }, [tokenState]);

  async function reload() {
    setLoading(true);
    try {
      const r = await api("/api/keys", { method: "GET" });
      setResp(r.json);
      if (r.json.ok) setKeys((r.json as any).keys ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function addKey() {
    setLoading(true);
    try {
      const storedLabel = buildStoredLabel(label, exchange, { isTestnet, isDemo });

      const r = await api("/api/keys", {
        method: "POST",
        body: JSON.stringify({
          exchange,
          label: storedLabel,
          apiKey,
          apiSecret,
          passphrase: passphrase || null,
        }),
      });

      setResp(r.json);

      if (r.json.ok) {
        setLabel("");
        setApiKey("");
        setApiSecret("");
        setPassphrase("");
        setIsTestnet(false);
        setIsDemo(false);
        await reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function delKey(id: string) {
    setLoading(true);
    try {
      const r = await api(`/api/keys/${id}`, { method: "DELETE" });
      setResp(r.json);

      if (r.json.ok) {
        setBalancesByKey((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
        setBalanceErrorByKey((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
        setBalanceUpdatedAtByKey((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
      }

      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance(key: KeyRow) {
    const keyId = key.id;
    const testnet = isBinanceTestnetKey(key);

    setBalanceErrorByKey((m) => ({ ...m, [keyId]: "" }));
    setBalanceLoading((m) => ({ ...m, [keyId]: true }));

    try {
      const suffix = testnet ? "&testnet=1" : "";
      const r = await api(`/api/balance?keyId=${encodeURIComponent(keyId)}${suffix}`, {
        method: "GET",
      });

      setResp(r.json);

      if (r.json.ok) {
        const balances = ((r.json as any).balances ?? []) as BalanceRow[];
        setBalancesByKey((m) => ({ ...m, [keyId]: balances }));
        setBalanceUpdatedAtByKey((m) => ({ ...m, [keyId]: Date.now() }));
      } else {
        setBalanceErrorByKey((m) => ({ ...m, [keyId]: humanizeError(r.json) }));
      }
    } finally {
      setBalanceLoading((m) => ({ ...m, [keyId]: false }));
    }
  }

  async function refreshAll() {
    for (const k of keys) {
      await refreshBalance(k);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>API Keys</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button disabled={loading} onClick={reload} style={btnGhost()}>
              Обновить список
            </button>
            <button
              disabled={loading || keys.length === 0}
              onClick={refreshAll}
              style={btnGhost()}
              title="Обновляет баланс для всех ключей"
            >
              Обновить баланс
            </button>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
          </div>
        </div>

        <div style={{ opacity: 0.85, fontSize: 13 }}>
          <b>sessionToken:</b> {tokenPreview}
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Add key</div>

          <div style={{ display: "grid", gap: 8 }}>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as Exchange)}
              style={input()}
            >
              <option value="BINANCE">BINANCE</option>
              <option value="BYBIT">BYBIT</option>
              <option value="OKX">OKX</option>
            </select>

            {exchange === ("BINANCE" as Exchange) ? (
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={isTestnet}
                  onChange={(e) => setIsTestnet(e.target.checked)}
                />
                <span>Это Binance Testnet ключ</span>
              </label>
            ) : null}

            {exchange === ("BYBIT" as Exchange) ? (
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                />
                <span>Это Bybit Demo ключ</span>
              </label>
            ) : null}

            <input
              placeholder="label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={input()}
            />
            <input
              placeholder="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={input()}
              autoComplete="off"
            />
            <input
              placeholder="apiSecret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              style={input()}
              type="password"
              autoComplete="off"
            />
            <input
              placeholder="passphrase (OKX optional)"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              style={input()}
              type="password"
              autoComplete="off"
            />

            <button disabled={loading} onClick={addKey} style={btnPrimary(loading)}>
              {loading ? "..." : "Save"}
            </button>

            <div style={{ opacity: 0.65, fontSize: 12, lineHeight: 1.4 }}>
              Важно: секреты не отображаются после сохранения. Если ошибся — удали ключ и добавь
              заново.
            </div>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Your keys</div>

          <div style={{ display: "grid", gap: 10 }}>
            {keys.map((k) => {
              const b = balancesByKey[k.id] || [];
              const bl = !!balanceLoading[k.id];
              const err = (balanceErrorByKey[k.id] || "").trim();
              const updatedAt = balanceUpdatedAtByKey[k.id] ?? null;
              const network = getNetworkName(k);

              return (
                <div
                  key={k.id}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "grid" }}>
                      <div style={{ fontWeight: 900 }}>
                        {k.exchange}
                        {k.label ? ` · ${k.label}` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={networkBadge(network)}>{network}</span>
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{k.id}</div>
                      <div style={{ opacity: 0.65, fontSize: 12 }}>
                        Последнее обновление баланса: <b>{formatTime(updatedAt)}</b>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <button
                        disabled={loading || bl}
                        onClick={() => refreshBalance(k)}
                        style={btnGhost()}
                        title="Запросить баланс по ключу"
                      >
                        {bl ? "..." : "Обновить баланс"}
                      </button>
                      <button disabled={loading} onClick={() => delKey(k.id)} style={btnDanger()}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>Баланс (Spot) · {network}</div>
                      {!!b.length && (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>Монет: {b.length}</div>
                      )}
                    </div>

                    {err ? (
                      <div style={errorBox()}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Ошибка</div>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                          {err}
                        </pre>
                      </div>
                    ) : !b.length ? (
                      <div style={{ opacity: 0.7, fontSize: 13 }}>
                        Нажми “Обновить баланс”. Если ключ рабочий — тут появятся монеты.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {b.slice(0, 20).map((x) => (
                          <div
                            key={x.asset}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.10)",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{x.asset}</div>
                            <div style={{ opacity: 0.9 }}>
                              free: {x.free} · locked: {x.locked}
                            </div>
                          </div>
                        ))}
                        {b.length > 20 && (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>
                            Показано 20 из {b.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!keys.length && <div style={{ opacity: 0.7 }}>No keys yet</div>}
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Last response</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {resp ? JSON.stringify(resp, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
  };
}

function errorBox(): React.CSSProperties {
  return {
    background: "rgba(255,0,0,0.08)",
    border: "1px solid rgba(255,0,0,0.25)",
    borderRadius: 12,
    padding: 10,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#000",
    color: "#fff",
    outline: "none",
  };
}

function checkboxWrap(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    opacity: 0.95,
  };
}

function networkBadge(network: "TESTNET" | "DEMO" | "MAINNET"): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      network === "TESTNET"
        ? "rgba(255,255,255,0.10)"
        : network === "DEMO"
          ? "rgba(0,153,255,0.14)"
          : "rgba(255,255,255,0.04)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.3,
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}