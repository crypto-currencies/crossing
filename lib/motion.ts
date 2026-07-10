import type { Variants, Transition } from "framer-motion";
export type { Variants };

// Motion tokens — consistent animation vocabulary
// Use these rather than inline values to keep the platform coherent

export const duration = {
  instant: 0.06,
  fast: 0.10,
  normal: 0.16,
  slow: 0.24,
  slower: 0.32,
  slowest: 0.48,
} as const;

export const ease = {
  // Standard curves
  linear: [0, 0, 1, 1],
  out: [0, 0, 0.2, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.4, 0, 0.2, 1],
  // Product-specific curves
  snap: [0.175, 0.885, 0.32, 1.15],      // slight overshoot, feels decisive
  smooth: [0.25, 0.1, 0.25, 1.0],        // silky scroll-feel
  reveal: [0.16, 1, 0.3, 1],             // quick start, long ease-out
  spring: { type: "spring", stiffness: 380, damping: 28 },
  springLight: { type: "spring", stiffness: 260, damping: 24 },
  springBounce: { type: "spring", stiffness: 500, damping: 22, mass: 0.8 },
} as const;

// Named transitions for reuse
export const transition = {
  fast: { duration: duration.fast, ease: ease.out } satisfies Transition,
  normal: { duration: duration.normal, ease: ease.out } satisfies Transition,
  slow: { duration: duration.slow, ease: ease.out } satisfies Transition,
  reveal: { duration: duration.slow, ease: ease.reveal } satisfies Transition,
  spring: ease.spring satisfies Transition,
  springLight: ease.springLight satisfies Transition,
} as const;

// Reusable variant sets
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.normal },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: transition.reveal },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -5 },
  visible: { opacity: 1, y: 0, transition: transition.reveal },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { ...ease.spring } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: transition.reveal },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0, transition: transition.reveal },
};

// Page transition (used in layout shell)
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 3 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -2,
    transition: { duration: duration.fast, ease: ease.in },
  },
};

// Stagger container — children animate in sequence
export const stagger = (staggerChildren = 0.04, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
});

// Modal variants
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.fast },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...ease.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: transition.fast,
  },
};

// Dropdown/popover
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.fast, ease: ease.out },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: duration.instant, ease: ease.in },
  },
};

// Hover/press micro-interactions
export const hoverScale = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.98 },
  transition: { duration: duration.fast, ease: ease.out },
};

export const hoverLift = {
  whileHover: { y: -2, transition: transition.fast },
  whileTap: { y: 0, scale: 0.98, transition: transition.fast },
};
