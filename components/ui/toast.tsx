"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast";
import type { Toast } from "@/types";

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
  default: Info,
};

const colors = {
  success: "border-[var(--success)] text-[var(--success)]",
  warning: "border-[var(--warning)] text-[var(--warning)]",
  danger: "border-[var(--danger)] text-[var(--danger)]",
  default: "border-[var(--border)] text-[var(--text-soft)]",
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = icons[toast.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-start gap-[12px] rounded-[var(--radius-lg)]",
        "border bg-[var(--panel)] shadow-[var(--shadow-panel)] p-[14px] w-[320px] max-w-[calc(100vw-32px)]",
        colors[toast.variant]
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className="size-4 mt-[1px] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="t-label text-[var(--text)]">{toast.title}</p>
        {toast.body && <p className="t-caption mt-[2px]">{toast.body}</p>}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-[24px] right-[24px] flex flex-col gap-[8px] items-end"
      style={{ zIndex: "var(--z-toast, 70)" }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
