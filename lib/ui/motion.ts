import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

export const sheetUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 32 } },
  exit: { opacity: 0, y: 24, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

export const stagger = (childDelay = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: childDelay, delayChildren: 0.04 } },
});

export const pressTap = { scale: 0.97 };
export const pressHover = { scale: 1.01 };
