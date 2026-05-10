"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * App Router template runs once per route mount, which makes it the right
 * spot for entrance transitions. Keyed by pathname so each navigation re-mounts.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: "100dvh" }}
    >
      {children}
    </motion.div>
  );
}
