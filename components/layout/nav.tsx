"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ROUTES } from "@/lib/routes";
import { NAV_GROUPS } from "./nav-data";

export function Nav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openGroup) return;

    function closeFromOutside(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenGroup(null);
    }

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [openGroup]);

  return (
    <header className="site-header">
      <nav ref={navRef} className="site-nav" aria-label="Main navigation">
        <Logo />

        <ul className="site-nav-links">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroup === group.label;
            return (
              <li
                key={group.label}
                className="site-nav-group"
                onMouseEnter={() => setOpenGroup(group.label)}
                onMouseLeave={() => setOpenGroup(null)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpenGroup(null);
                }}
              >
                <button
                  type="button"
                  className="site-nav-trigger"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  onFocus={() => setOpenGroup(group.label)}
                >
                  {group.label}
                  <ChevronDown size={15} aria-hidden />
                </button>

                {isOpen && (
                  <div className="site-nav-popover">
                    <div className="site-nav-dropdown" role="menu" aria-label={group.label}>
                      {group.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                        >
                          <span>{link.label}</span>
                          {link.description && <small>{link.description}</small>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="site-nav-actions">
          <Link className="site-nav-search" href={ROUTES.discovery.search} aria-label="Search Crossing">
            <Search size={18} />
          </Link>
          <Link className="site-nav-login" href={ROUTES.auth.login}>Log in</Link>
          <Link className="site-nav-join" href={ROUTES.auth.register}>Join</Link>
        </div>

        <button
          type="button"
          className="site-nav-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="site-mobile-menu">
          {NAV_GROUPS.map((group) => (
            <div className="site-mobile-group" key={group.label}>
              <p>{group.label}</p>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="site-mobile-actions">
            <Link href={ROUTES.auth.login} onClick={() => setMobileOpen(false)}>Log in</Link>
            <Link href={ROUTES.auth.register} onClick={() => setMobileOpen(false)}>Join</Link>
          </div>
        </div>
      )}
    </header>
  );
}
