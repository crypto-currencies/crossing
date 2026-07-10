"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { modalOverlay, modalContent } from "@/lib/motion";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  hideClose?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-[calc(100vw-(var(--page-gutter)*2))]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  hideClose = false,
  className,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/80 backdrop-blur-[6px]"
            style={{ zIndex: "var(--z-modal)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            className="fixed inset-0 flex items-center justify-center p-[var(--page-gutter)]"
            style={{ zIndex: "var(--z-modal)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
          >
            <motion.div
              key="content"
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "panel w-full relative rounded-[var(--radius-panel)] flex flex-col",
                "border border-[var(--border-strong)] shadow-[var(--shadow-craft)]",
                "max-h-[min(90dvh,860px)]",
                sizeClasses[size],
                className
              )}
            >
              {/* Header */}
              {(title || !hideClose) && (
                <div className="flex flex-shrink-0 items-start justify-between gap-[16px] p-[var(--panel-padding)] pb-0">
                  <div className="flex-1 min-w-0">
                    {title && (
                      <h2
                        id="modal-title"
                        className="t-heading text-[var(--text)]"
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="t-body-sm text-[var(--text-soft)] mt-[5px]">
                        {description}
                      </p>
                    )}
                  </div>
                  {!hideClose && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={onClose}
                      aria-label="Close"
                      title="Close"
                      className="flex-shrink-0"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Body — scrollable when content overflows */}
              <div className="overflow-y-auto p-[var(--panel-padding)]">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Confirm dialog — simple yes/no modal
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  intent = "default",
  loading,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex items-center justify-end gap-[8px] mt-[20px]">
        <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={intent === "danger" ? "danger" : "primary"}
          size="md"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
