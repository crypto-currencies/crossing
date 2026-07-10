"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, stagger, type Variants } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  variants?: Variants;
  delay?: number;
  once?: boolean;
  className?: string;
}

export function Reveal({
  children,
  variants = fadeUp,
  delay = 0,
  once = true,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={delay ? { delay } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger container — children with reveal variants animate in sequence
interface StaggerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  once?: boolean;
  className?: string;
}

export function StaggerReveal({
  children,
  staggerDelay = 0.06,
  initialDelay = 0,
  once = true,
  className,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      variants={stagger(staggerDelay, initialDelay)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Single stagger item — use inside StaggerReveal
export function StaggerItem({
  children,
  className,
  variants = fadeUp,
}: {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  );
}
