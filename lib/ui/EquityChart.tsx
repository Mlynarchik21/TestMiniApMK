"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useTheme } from "@/lib/useTheme";

export type EquityPoint = { time: string | number; value: number };

type Props = {
  data: EquityPoint[];
  height?: number;
  color?: string;
  style?: CSSProperties;
};

/**
 * Wrapper around lightweight-charts. Lazily imports the lib only on the client.
 */
export function EquityChart({ data, height = 220, color, style }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { T, theme } = useTheme();

  useEffect(() => {
    let chart: any;
    let series: any;
    let cleanupResize: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      if (!containerRef.current) return;
      const lib = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const lineColor = color ?? T.brand;

      chart = lib.createChart(containerRef.current, {
        height,
        autoSize: true,
        layout: {
          background: { color: "transparent" } as any,
          textColor: T.textMuted,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        grid: {
          vertLines: { color: T.borderSoft },
          horzLines: { color: T.borderSoft },
        },
        rightPriceScale: { borderColor: T.border, textColor: T.textMuted },
        timeScale: { borderColor: T.border, timeVisible: false },
        crosshair: { mode: 1, vertLine: { color: T.borderHard }, horzLine: { color: T.borderHard } },
      });

      series = chart.addSeries(lib.AreaSeries, {
        lineColor,
        topColor: `${lineColor}55`,
        bottomColor: `${lineColor}00`,
        lineWidth: 2,
      });
      series.setData(data);
      chart.timeScale().fitContent();

      const onResize = () => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
      };
      window.addEventListener("resize", onResize);
      cleanupResize = () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      cancelled = true;
      cleanupResize?.();
      try { chart?.remove?.(); } catch {}
    };
  }, [data, height, color, T.brand, T.borderSoft, T.border, T.borderHard, T.textMuted, theme]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        borderRadius: 14,
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
