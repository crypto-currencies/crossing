"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { modalContent, modalOverlay } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <motion.div
        variants={modalOverlay}
        initial="hidden"
        animate="visible"
        className="absolute inset-0 bg-black-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        variants={modalContent}
        initial="hidden"
        animate="visible"
        className={cn(
          "relative w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 shadow-xl",
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </div>,
    document.body
  );
}
