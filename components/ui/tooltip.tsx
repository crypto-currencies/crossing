"use client";

import { useState, useRef, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

const sideTransform = {
  top: { hidden: { y: 4 }, visible: { y: 0 } },
  bottom: { hidden: { y: -4 }, visible: { y: 0 } },
  left: { hidden: { x: 4 }, visible: { x: 0 } },
  right: { hidden: { x: -4 }, visible: { x: 0 } },
};

const sidePosition = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 300,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  // Clear pending timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            id={id}
            role="tooltip"
            initial={{ opacity: 0, ...sideTransform[side].hidden }}
            animate={{ opacity: 1, ...sideTransform[side].visible }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute z-[var(--z-tooltip)] pointer-events-none",
              "bg-[var(--panel-2)] text-[var(--text)] text-[11px] font-medium",
              "px-2 py-1 rounded-[var(--radius-md)] whitespace-nowrap",
              "border border-[var(--border)] shadow-[var(--shadow-card)]",
              sidePosition[side],
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
