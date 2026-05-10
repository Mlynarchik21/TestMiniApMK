"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Fill area under line. */
  filled?: boolean;
  strokeWidth?: number;
  style?: CSSProperties;
};

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "#64d97b",
  filled = true,
  strokeWidth = 1.6,
  style,
}: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height, ...style }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const linePath = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), "");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style} aria-hidden>
      {filled && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={areaPath} fill={`url(#${id})`} />}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
