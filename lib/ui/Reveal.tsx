"use client";

import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { fadeUp, stagger } from "./motion";

type Props = {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
};

export function Reveal({ children, delay = 0, style }: Props) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ delay }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function RevealStack({
  children,
  childDelay = 0.05,
  style,
}: {
  children: ReactNode;
  childDelay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      variants={stagger(childDelay)}
      initial="hidden"
      animate="visible"
      style={style}
    >
      {children}
    </motion.div>
  );
}
