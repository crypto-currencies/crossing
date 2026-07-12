"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, ChevronDown, ChevronUp, Lock, Shield, Settings2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readConsent,
  writeConsent,
  acceptAll,
  acceptNecessaryOnly,
  hasValidConsent,
  type ConsentRecord,
} from "@/lib/consent";

// ─── Category definitions ─────────────────────────────────────────────────────

const REQUIRED_CATEGORIES = [
  {
    id: "authentication",
    icon: Lock,
    label: "Authentication",
    description: "Keep you signed in across page loads. These are essential — without them you'd be signed out on every navigation.",
  },
  {
    id: "security",
    icon: Shield,
    label: "Security",
    description: "Protect your account by detecting suspicious activity and storing session information server-side.",
  },
  {
    id: "session",
    icon: Settings2,
    label: "Session Management",
    description: "Remember your active session so you don't have to re-authenticate on every request.",
  },
] as const;

const OPTIONAL_CATEGORIES = [
  {
    id: "analytics" as const,
    icon: BarChart2,
    label: "Analytics",
    description: "Help us understand how the site is used so we can improve it. No personal data is shared with third parties.",
  },
  {
    id: "performance" as const,
    icon: BarChart2,
    label: "Performance",
    description: "Measure page load times and error rates to keep crossing.dev fast and stable.",
  },
  {
    id: "preferences" as const,
    icon: Settings2,
    label: "Preferences",
    description: "Remember choices you make — like your sidebar state or display preferences — across sessions.",
  },
] as const;

type OptId = (typeof OPTIONAL_CATEGORIES)[number]["id"];

// ─── Small toggle ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple-500)] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: checked ? "var(--purple-500)" : "var(--border-default)", cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span
        className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ─── CookieBanner ─────────────────────────────────────────────────────────────

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [custom, setCustom] = useState<Record<OptId, boolean>>({
    analytics: false,
    performance: false,
    preferences: true,
  });

  useEffect(() => {
    // Deferred to a microtask so the state updates below happen in a separate
    // task from the effect's own invocation (avoids synchronous setState
    // during the commit phase) while still running before the next paint.
    queueMicrotask(() => {
      if (hasValidConsent()) return;
      // Pre-fill custom from any prior (outdated) consent
      const prior = readConsent();
      if (prior) {
        setCustom({
          analytics: prior.analytics,
          performance: prior.performance,
          preferences: prior.preferences,
        });
      }
      setVisible(true);
    });
  }, []);

  function dismiss(record: ConsentRecord) {
    void record; // record written by caller
    setVisible(false);
  }

  function handleAcceptAll() { dismiss(acceptAll()); }
  function handleNecessaryOnly() { dismiss(acceptNecessaryOnly()); }
  function handleSaveCustom() {
    dismiss(writeConsent({ analytics: custom.analytics, performance: custom.performance, preferences: custom.preferences }));
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cookie-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-0"
          style={{ zIndex: 55 }}
        >
          <div
            className="mx-auto max-w-4xl rounded-xl p-5 shadow-lg"
            style={{
              background: "var(--surface-overlay)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Header row */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className="shrink-0 rounded-lg p-2"
                style={{ background: "color-mix(in srgb, var(--purple-500) 12%, transparent)", border: "1px solid var(--accent-border)" }}
              >
                <Cookie className="h-4 w-4" style={{ color: "var(--purple-400)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="t-body font-semibold" style={{ color: "var(--text-primary)" }}>
                  We use cookies
                </p>
                <p className="t-body-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  crossing.dev uses essential cookies to keep you signed in and protect your account. We also use optional cookies to save your preferences and, in the future, measure how the site is used.{" "}
                  <Link href="/privacy" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: "var(--purple-400)" }}>
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </div>

            {/* Customise panel */}
            <AnimatePresence>
              {customizing && (
                <motion.div
                  key="custom-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-lg p-4 mb-4 space-y-4"
                    style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
                  >
                    {/* Required */}
                    <div>
                      <p className="t-label mb-2" style={{ color: "var(--text-tertiary)" }}>Always active</p>
                      <div className="space-y-3">
                        {REQUIRED_CATEGORIES.map(({ id, icon: Icon, label, description }) => (
                          <div key={id} className="flex items-start gap-3">
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                            <div className="flex-1 min-w-0">
                              <p className="t-body-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                              <p className="t-caption mt-0.5" style={{ color: "var(--text-tertiary)" }}>{description}</p>
                            </div>
                            <div className="shrink-0">
                              <Toggle checked disabled onChange={() => {}} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                    {/* Optional */}
                    <div>
                      <p className="t-label mb-2" style={{ color: "var(--text-tertiary)" }}>Optional</p>
                      <div className="space-y-3">
                        {OPTIONAL_CATEGORIES.map(({ id, icon: Icon, label, description }) => (
                          <div key={id} className="flex items-start gap-3">
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                            <div className="flex-1 min-w-0">
                              <p className="t-body-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                              <p className="t-caption mt-0.5" style={{ color: "var(--text-tertiary)" }}>{description}</p>
                            </div>
                            <div className="shrink-0">
                              <Toggle
                                checked={custom[id]}
                                onChange={(v) => setCustom((prev) => ({ ...prev, [id]: v }))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                onClick={() => setCustomizing((p) => !p)}
                className="flex items-center gap-1.5 t-body-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)", background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                {customizing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Customize
              </button>

              <Button variant="ghost" size="sm" onClick={handleNecessaryOnly}>
                Necessary only
              </Button>

              {customizing ? (
                <Button variant="primary" size="sm" onClick={handleSaveCustom}>
                  Save preferences
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleAcceptAll}>
                  Accept all
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
