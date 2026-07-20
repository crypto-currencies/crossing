"use client";

import { motion, type MotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, stagger } from "@/lib/motion";

interface RevealProps extends MotionProps {
  children: ReactNode;
  className?: string;
}

export function Reveal({ children, className, ...props }: RevealProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10% 0px" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerRevealProps {
  children: ReactNode;
  className?: string;
  staggerChildren?: number;
}

export function StaggerReveal({ children, className, staggerChildren = 0.08 }: StaggerRevealProps) {
  return (
    <motion.div
      variants={stagger(staggerChildren)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10% 0px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
