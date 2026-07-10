"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className ?? "w-full"}
    >
      {children}
    </motion.div>
  );
}
