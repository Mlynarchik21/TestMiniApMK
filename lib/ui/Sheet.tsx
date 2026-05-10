"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { X } from "./icons";
import { sheetUp } from "./motion";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  /** When true, sheet is full-height. */
  full?: boolean;
};

export function Sheet({ open, onOpenChange, title, description, children, full = false }: Props) {
  const { T } = useTheme();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  zIndex: 100,
                }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                role="dialog"
                variants={sheetUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{
                  position: "fixed",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 101,
                  background: T.surface,
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderTop: `1px solid ${T.border}`,
                  maxHeight: full ? "100dvh" : "92dvh",
                  overflow: "auto",
                  paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 16px)",
                }}
              >
                {/* Drag handle */}
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 99, background: T.borderHard }} />
                </div>

                {(title || description) && (
                  <div style={{ padding: "8px 20px 12px" }}>
                    {title && (
                      <Dialog.Title
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: T.textMain,
                          letterSpacing: "-0.02em",
                          margin: 0,
                        }}
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                )}

                <Dialog.Close asChild>
                  <button
                    aria-label="Закрыть"
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      width: 36,
                      height: 36,
                      borderRadius: 99,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: T.textSoft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>

                <div style={{ padding: "8px 20px 24px" }}>{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
