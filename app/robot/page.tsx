"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import {
  Bot,
  Play,
  Pause,
  Settings,
  Activity,
  TrendingUp,
  Wallet,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Target,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from "@/lib/ui/icons";
import { Card, CardTitle } from "@/lib/ui/Card";
import { Button } from "@/lib/ui/Button";
import { Stat } from "@/lib/ui/Stat";
import { ProgressBar } from "@/lib/ui/ProgressBar";
import { RiskBar } from "@/lib/ui/RiskBar";
import { Sparkline } from "@/lib/ui/Sparkline";
import { EquityChart, type EquityPoint } from "@/lib/ui/EquityChart";
import { Skeleton, SkeletonStack } from "@/lib/ui/Skeleton";
import { Reveal, RevealStack } from "@/lib/ui/Reveal";
import { PageShell } from "@/lib/ui/PageShell";
import { BottomNav } from "@/lib/ui/BottomNav";
import { haptics } from "@/lib/ui/haptics";
import { useTheme } from "@/lib/useTheme";

type AnyResp =
  | { ok: true; [k: string]: any }
  | { ok: false; error: string; message?: string; [k: string]: any };

type BotState = {
  active: boolean;
  status: string;
  openPositions: number;
  pnlToday: number;
  pnlAll: number;
  winRate: number | null;
  capitalInWork: number;
  longShare: number | null;
  recentPnls: number[];
  equity: EquityPoint[];
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: "LONG" | "SHORT";
    pnl: number;
    closedAt: string;
  }>;
};

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

async function api(path: string): Promise<AnyResp> {
  const token = getToken();
  try {
    const res = await fetch(path, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" };
  }
}

function formatUsd(v: number) {
  if (!Number.isFinite(v)) return "$0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
}

function formatPnl(v: number) {
  if (!Number.isFinite(v)) return "$0";
  return `${v >= 0 ? "+" : ""}${formatUsd(v)}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RobotPage() {
  const router = useRouter();
  const { T } = useTheme();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"start" | "stop" | "refresh" | null>(null);
  const [state, setState] = useState<BotState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [bot, stats] = await Promise.all([
        api("/api/bot"),
        api("/api/bot/stats?recentTake=20"),
      ]);

      const cfg = (bot.ok ? (bot as any).config : null) ?? null;
      const st = (bot.ok ? (bot as any).state : null) ?? null;
      const positions = bot.ok && Array.isArray((bot as any).positions) ? (bot as any).positions : [];
      const statsObj = stats.ok ? (stats as any).stats ?? {} : {};

      const status = String(st?.status ?? "IDLE").toUpperCase();
      const active = !!cfg?.enabled && status !== "STOPPED" && status !== "IDLE";

      const recent: Array<{ id: string; symbol: string; side: "LONG" | "SHORT"; pnl: number; closedAt: string }> =
        Array.isArray(statsObj.recentTrades) ? statsObj.recentTrades : [];

      const recentPnls = recent.slice(0, 14).reverse().map((t) => Number(t.pnl) || 0);

      let runningEquity = Number(statsObj.equityStart ?? 0);
      const equity: EquityPoint[] =
        Array.isArray(statsObj.equityCurve) && statsObj.equityCurve.length
          ? (statsObj.equityCurve as EquityPoint[])
          : recent
              .slice()
              .reverse()
              .map((t, i) => {
                runningEquity += Number(t.pnl) || 0;
                return { time: (Date.now() / 1000 - (recent.length - i) * 86400) | 0, value: runningEquity };
              });

      const longCount = positions.filter((p: any) => String(p.side).toUpperCase() === "LONG").length;
      const longShare = positions.length ? (longCount / positions.length) * 100 : null;

      setState({
        active,
        status,
        openPositions: Number(statsObj.openPositions ?? positions.length ?? 0),
        pnlToday: Number(statsObj.pnlToday ?? 0),
        pnlAll: Number(statsObj.pnlAll ?? 0),
        winRate: statsObj.winRate != null ? Number(statsObj.winRate) : null,
        capitalInWork: Number(statsObj.capitalInWork ?? 0),
        longShare,
        recentPnls,
        equity,
        recentTrades: recent.slice(0, 6),
      });
    } catch (e: any) {
      setErr(e?.message || "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startBot() {
    setBusy("start");
    haptics.impact("medium");
    try {
      const r = await api("/api/bot/start");
      if (r.ok) haptics.notify("success"); else haptics.notify("error");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function stopBot() {
    setBusy("stop");
    haptics.impact("heavy");
    try {
      const r = await api("/api/bot/stop");
      if (r.ok) haptics.notify("success"); else haptics.notify("error");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    haptics.selection();
    try {
      await load();
    } finally {
      setBusy(null);
    }
  }

  const winRatePct = state?.winRate != null ? state.winRate : null;
  const pnlSparkColor = useMemo(() => {
    if (!state?.recentPnls?.length) return T.brand;
    const sum = state.recentPnls.reduce((a, b) => a + b, 0);
    return sum >= 0 ? T.green : T.red;
  }, [state?.recentPnls, T.green, T.red, T.brand]);

  return (
    <>
      <PageShell>
        <RevealStack childDelay={0.05} style={{ display: "grid", gap: 14 }}>
          {/* Header */}
          <Reveal>
            <header
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 44px",
                alignItems: "center",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <button
                type="button"
                onClick={() => router.replace("/home")}
                aria-label="Назад"
                style={iconBtn(T)}
              >
                <ArrowLeft size={18} />
              </button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: T.textMain }}>
                  Робот
                </div>
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                  Автоматическая торговля
                </div>
              </div>
              <button
                type="button"
                onClick={refresh}
                aria-label="Обновить"
                disabled={busy === "refresh"}
                style={iconBtn(T)}
              >
                <RefreshCw
                  size={18}
                  style={{
                    animation: busy === "refresh" ? "miniSpin 900ms linear infinite" : undefined,
                  }}
                />
              </button>
            </header>
          </Reveal>

          {/* Status hero */}
          <Reveal>
            <Card padding={18} style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    background: state?.active ? `${T.green}1c` : T.card,
                    border: `1px solid ${state?.active ? `${T.green}55` : T.borderHard}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: state?.active ? T.green : T.textSoft,
                    flexShrink: 0,
                  }}
                >
                  <Bot size={28} strokeWidth={1.6} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: state?.active ? T.green : T.textFaint,
                        color: state?.active ? T.green : T.textFaint,
                        animation: state?.active ? "statusPulse 1.6s ease-in-out infinite" : undefined,
                      }}
                    />
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.textMain }}>
                      {loading ? "Загрузка…" : state?.active ? "В работе" : "Остановлен"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    {loading ? <Skeleton width={120} height={12} /> : `Статус: ${state?.status ?? "—"}`}
                  </div>
                </div>

                {state?.recentPnls && state.recentPnls.length > 1 && (
                  <Sparkline
                    data={state.recentPnls}
                    width={88}
                    height={36}
                    color={pnlSparkColor}
                    strokeWidth={1.6}
                  />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
                {state?.active ? (
                  <Button
                    variant="danger"
                    size="md"
                    leadingIcon={<Pause size={16} />}
                    onClick={stopBot}
                    loading={busy === "stop"}
                    disabled={loading}
                    haptic="heavy"
                  >
                    Остановить
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    tone={T.green}
                    size="md"
                    leadingIcon={<Play size={16} />}
                    onClick={startBot}
                    loading={busy === "start"}
                    disabled={loading}
                    haptic="medium"
                  >
                    Запустить
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  leadingIcon={<Settings size={16} />}
                  onClick={() => router.push("/bot/config")}
                >
                  Настроить
                </Button>
              </div>
            </Card>
          </Reveal>

          {/* Stats grid */}
          <Reveal>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} padding={14}>
                    <SkeletonStack count={2} />
                  </Card>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat
                  label="P&L сегодня"
                  value={formatPnl(state?.pnlToday ?? 0)}
                  tone={(state?.pnlToday ?? 0) > 0 ? "positive" : (state?.pnlToday ?? 0) < 0 ? "negative" : "neutral"}
                  icon={<TrendingUp size={11} strokeWidth={2} />}
                />
                <Stat
                  label="Открытые позиции"
                  value={state?.openPositions ?? 0}
                  icon={<Activity size={11} strokeWidth={2} />}
                />
                <Stat
                  label="В работе"
                  value={formatUsd(state?.capitalInWork ?? 0)}
                  icon={<Wallet size={11} strokeWidth={2} />}
                />
                <Stat
                  label="Win Rate"
                  value={winRatePct != null ? `${winRatePct.toFixed(0)}%` : "—"}
                  tone={winRatePct != null && winRatePct >= 50 ? "positive" : "neutral"}
                  icon={<Target size={11} strokeWidth={2} />}
                />
              </div>
            )}
          </Reveal>

          {/* Risk indicator (one of the only places gradients are used) */}
          {state && state.openPositions > 0 && state.longShare != null && (
            <Reveal>
              <Card padding={16}>
                <CardTitle>Распределение позиций</CardTitle>
                <RiskBar
                  leftPercent={state.longShare}
                  leftLabel="Long"
                  rightLabel="Short"
                  leftColor={T.green}
                  rightColor={T.red}
                />
              </Card>
            </Reveal>
          )}

          {/* Win-rate progress (gradient bar — allowed) */}
          {state && winRatePct != null && (
            <Reveal>
              <Card padding={16}>
                <CardTitle>Доля прибыльных сделок</CardTitle>
                <ProgressBar
                  value={winRatePct}
                  tone={winRatePct >= 60 ? "success" : winRatePct >= 45 ? "brand" : "danger"}
                  height={10}
                  label={`${winRatePct.toFixed(0)}% из последних сделок`}
                  rightLabel={`P&L всего: ${formatPnl(state.pnlAll)}`}
                />
              </Card>
            </Reveal>
          )}

          {/* Equity chart */}
          {state && state.equity.length > 1 && (
            <Reveal>
              <Card padding={16}>
                <CardTitle>Динамика капитала</CardTitle>
                <EquityChart data={state.equity} height={200} />
              </Card>
            </Reveal>
          )}

          {/* Recent trades */}
          <Reveal>
            <Card padding={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <CardTitle style={{ marginBottom: 0 }}>Последние сделки</CardTitle>
                <button
                  type="button"
                  onClick={() => router.push("/bot/account-history")}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.brand,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  Все <ChevronRight size={14} />
                </button>
              </div>

              {loading ? (
                <SkeletonStack count={4} />
              ) : !state?.recentTrades?.length ? (
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    padding: "24px 16px",
                    gap: 10,
                    color: T.textMuted,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  <Sparkles size={28} strokeWidth={1.4} style={{ color: T.textFaint }} />
                  Сделок пока нет — запустите робота, чтобы начать.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 4 }}>
                  {state.recentTrades.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        padding: "10px 4px",
                        borderTop: i === 0 ? "none" : `1px solid ${T.borderSoft}`,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.textMain }}>{t.symbol}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 99,
                              background: t.side === "LONG" ? `${T.green}18` : `${T.red}18`,
                              color: t.side === "LONG" ? T.green : T.red,
                            }}
                          >
                            {t.side}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                          {formatTime(t.closedAt)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: t.pnl > 0 ? T.green : t.pnl < 0 ? T.red : T.textMain,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatPnl(t.pnl)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Reveal>

          {/* Footer security note */}
          {!loading && (
            <Reveal>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: T.textFaint,
                  padding: "10px 4px",
                }}
              >
                <ShieldCheck size={12} strokeWidth={2} />
                Все ключи зашифрованы, сделки выполняются на стороне биржи.
              </div>
            </Reveal>
          )}

          {err && (
            <Reveal>
              <Card padding={14} style={{ borderColor: `${T.red}55` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.red, fontSize: 13 }}>
                  <AlertTriangle size={14} />
                  {err}
                </div>
              </Card>
            </Reveal>
          )}
        </RevealStack>
      </PageShell>

      <BottomNav />
    </>
  );
}

function iconBtn(T: ReturnType<typeof useTheme>["T"]): CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${T.borderHard}`,
    background: T.card,
    color: T.textMain,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  };
}
