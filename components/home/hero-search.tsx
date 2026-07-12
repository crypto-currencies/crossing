"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      role="search"
      aria-label="Search Crossing.dev"
      className="relative mx-auto w-full max-w-[560px]"
    >
      <Search
        className="pointer-events-none absolute left-[18px] top-1/2 size-[16px] -translate-y-1/2 text-[var(--muted)]"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search tools, software, communities…"
        aria-label="Search"
        className={
          "h-[52px] w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] " +
          "bg-[var(--panel)] pl-[48px] pr-[110px] text-[14px] text-[var(--text)] " +
          "placeholder:text-[var(--muted)] shadow-[var(--shadow-md)] " +
          "transition-colors duration-150 hover:border-[rgba(255,255,255,0.14)] " +
          "focus:outline-none focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)]"
        }
      />
      <button
        type="submit"
        className={
          "button absolute right-[6px] top-1/2 h-[40px] -translate-y-1/2 rounded-[10px] " +
          "!text-white bg-[#6d28d9] border border-[rgba(109,40,217,0.40)] px-[18px] text-[13px] font-medium " +
          "hover:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        }
      >
        Search
      </button>
    </motion.form>
  );
}
