"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, FileText, LoaderCircle, XCircle } from "lucide-react";
import type { Submission } from "@/types";
import { useAuthStore } from "@/store/auth";
import { ProductEmptyState } from "./product-primitives";

export function SubmissionHistory() {
  const session = useAuthStore((state) => state.session);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const [items, setItems] = useState<Submission[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;
    let cancelled = false;
    fetch("/api/me/submissions?pageSize=100", {
      cache: "no-store",
      ...(session?.token ? { headers: { authorization: `Bearer ${session.token}` } } : {}),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("history_unavailable");
        return (await response.json()) as { items?: Submission[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items ?? []);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoadingAuth, session?.token]);

  if (isLoadingAuth) return <div className="catalog-loading" role="status"><LoaderCircle size={20} aria-hidden /> Checking your account…</div>;
  if (!isAuthenticated) return <ProductEmptyState title="Log in to track submissions" body="Submission history belongs to your account." action={{ label: "Log in", href: "/login?redirect=/submissions" }} />;
  if (state === "loading") return <div className="catalog-loading" role="status"><LoaderCircle size={20} aria-hidden /> Loading submissions…</div>;
  if (state === "error") return <ProductEmptyState title="Submission history could not be loaded" body="Your account is still signed in. Try this page again shortly." action={{ label: "Submit a listing", href: "/submit" }} />;
  if (!items.length) return <ProductEmptyState title="No submissions yet" body="When the backend confirms a listing submission, its moderation status will appear here." action={{ label: "Suggest a listing", href: "/submit" }} icon={<FileText size={24} />} />;

  return (
    <div className="submission-history">
      {items.map((item) => {
        const StatusIcon = item.status === "APPROVED" ? CheckCircle2 : item.status === "REJECTED" ? XCircle : Clock3;
        return (
          <article key={item.id}>
            <div className={`submission-history-status status-${item.status.toLowerCase()}`}>
              <StatusIcon size={16} aria-hidden /> {item.status === "PENDING" ? "In review" : item.status === "APPROVED" ? "Approved" : "Not approved"}
            </div>
            <div>
              <p className="product-eyebrow">{item.category.name}</p>
              <h2>{item.name}</h2>
              <p>{item.tagline}</p>
              {item.moderatorNote ? <blockquote><strong>Moderator note</strong>{item.moderatorNote}</blockquote> : null}
            </div>
            <footer>
              <span>Submitted {new Date(item.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</span>
              {item.listingSlug ? <Link href={`/listing/${item.listingSlug}`}>View listing</Link> : null}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
