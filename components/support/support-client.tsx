"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import {
  Plus, ChevronLeft, Clock, CheckCircle2, XCircle,
  AlertCircle, MessageSquare, Inbox, Send, RefreshCw,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketMessage {
  id:        string;
  body:      string;
  isAdmin:   boolean;
  senderId:  string;
  createdAt: string;
}

interface Ticket {
  id:          string;
  category:    string;
  status:      string;
  priority:    string;
  subject:     string;
  createdAt:   string;
  updatedAt:   string;
  resolvedAt:  string | null;
  messages:    TicketMessage[];
  _count?:     { messages: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string; desc: string }[] = [
  { value: "account",      label: "Account issue",               desc: "Login, password, email, or billing" },
  { value: "profile",      label: "Profile / customization",     desc: "Display issues, themes, badges"     },
  { value: "upload",       label: "Upload / media issue",        desc: "Images, GIFs, or video problems"    },
  { value: "integrations", label: "Integrations",                desc: "Discord, Spotify, GitHub, etc."     },
  { value: "appeal",       label: "Report appeal",               desc: "Contest a moderation action"        },
  { value: "bug",          label: "Bug report",                  desc: "Something is broken or unexpected"  },
  { value: "other",        label: "Other",                       desc: "Anything not listed above"          },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:           { label: "Open",           color: "var(--accent-text)", icon: Clock         },
  under_review:   { label: "Under review",   color: "var(--warning)",     icon: AlertCircle   },
  awaiting_user:  { label: "Awaiting reply", color: "var(--purple)",      icon: MessageSquare },
  resolved:       { label: "Resolved",       color: "var(--success)",     icon: CheckCircle2  },
  dismissed:      { label: "Dismissed",      color: "var(--muted)",       icon: XCircle       },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.open;
  const Icon = m.icon;
  return (
    <span className="flex items-center gap-[4px] px-[7px] py-[2px] rounded-full t-caption font-semibold"
      style={{ color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}28` }}>
      <Icon className="size-[10px]" />
      {m.label}
    </span>
  );
}

// ─── New ticket form ──────────────────────────────────────────────────────────

function NewTicketForm({ onCreated }: { onCreated: (t: Ticket) => void }) {
  const [category, setCategory]     = useState("");
  const [subject, setSubject]       = useState("");
  const [description, setDescription] = useState("");
  const [submitting, startSubmit]   = useTransition();
  const [error, setError]           = useState<string | null>(null);

  const submit = useCallback(() => {
    if (!category || !subject.trim() || !description.trim()) return;
    setError(null);
    startSubmit(async () => {
      try {
        const res  = await fetch("/api/tickets", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, subject: subject.trim(), description: description.trim() }),
        });
        const json = await res.json() as { ticket?: Ticket; error?: string };
        if (!res.ok) {
          const msg = json.error === "too_many_open_tickets"
            ? "You have too many open tickets. Resolve some before creating new ones."
            : json.error === "subject_too_short" ? "Subject must be at least 5 characters."
            : json.error === "description_too_short" ? "Description must be at least 10 characters."
            : json.error ?? "Failed to create ticket.";
          setError(msg); return;
        }
        if (json.ticket) onCreated(json.ticket);
      } catch { setError("Network error — please try again."); }
    });
  }, [category, description, onCreated, subject]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <p className="t-label text-[var(--text)] mb-[8px]">Category</p>
        <div className="flex flex-col gap-[6px]">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)}
              className={cn(
                "flex items-start gap-[10px] w-full rounded-[var(--radius-lg)] border px-[12px] py-[10px] text-left transition-colors",
                category === c.value
                  ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              )}>
              <span className={cn("mt-[3px] size-3.5 rounded-full border-2 flex-shrink-0 transition-colors",
                category === c.value ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]")} />
              <span className="flex flex-col gap-[1px]">
                <span className="t-body-sm font-medium leading-snug">{c.label}</span>
                <span className="t-caption text-[var(--muted)] leading-snug">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}
        placeholder="Brief description of your issue" maxLength={120} />

      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your issue in detail — include any relevant usernames, error messages, or steps to reproduce."
        rows={5} maxLength={2000} />

      {error && <p className="t-caption text-[var(--danger)]">{error}</p>}

      <div className="flex justify-end">
        <Button variant="primary" size="md"
          disabled={!category || subject.trim().length < 5 || description.trim().length < 10 || submitting}
          onClick={submit} loading={submitting}>
          Submit ticket
        </Button>
      </div>
    </div>
  );
}

// ─── Ticket detail ────────────────────────────────────────────────────────────

function TicketDetail({ ticket, onBack, onUpdated }: {
  ticket:    Ticket;
  onBack:    () => void;
  onUpdated: (t: Ticket) => void;
}) {
  const [full, setFull]         = useState<Ticket | null>(null);
  const [reply, setReply]       = useState("");
  const [sending, startSend]    = useTransition();
  const [error, setError]       = useState<string | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/tickets/${ticket.id}`)
      .then((r) => r.json())
      .then((j: { ticket?: Ticket }) => { if (j.ticket) setFull(j.ticket); })
      .catch(() => {});
  }, [ticket.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [full?.messages.length]);

  const isOpen = !["resolved","dismissed"].includes(full?.status ?? ticket.status);
  const displayTicket = full ?? ticket;

  const sendReply = useCallback(() => {
    if (!reply.trim()) return;
    setError(null);
    startSend(async () => {
      try {
        const res  = await fetch(`/api/tickets/${ticket.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: reply.trim() }),
        });
        const json = await res.json() as { message?: TicketMessage; error?: string };
        if (!res.ok) {
          setError(json.error === "ticket_closed" ? "This ticket is closed and cannot receive new replies." : json.error ?? "Failed to send.");
          return;
        }
        const newMsg = json.message;
        if (newMsg) {
          setFull((prev) => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
          onUpdated({ ...displayTicket, updatedAt: new Date().toISOString() });
          setReply("");
        }
      } catch { setError("Network error — please try again."); }
    });
  }, [displayTicket, onUpdated, reply, ticket.id]);

  return (
    <div className="flex flex-col gap-[16px]">
      <button type="button" onClick={onBack}
        className="flex items-center gap-[6px] t-caption text-[var(--muted)] hover:text-[var(--text)] transition-colors w-fit">
        <ChevronLeft className="size-3.5" /> Back to tickets
      </button>

      {/* Header */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[14px]">
        <div className="flex items-start justify-between gap-[8px] flex-wrap">
          <div>
            <p className="t-body-sm font-semibold text-[var(--text)]">{displayTicket.subject}</p>
            <p className="t-caption text-[var(--muted)] mt-[2px]">
              #{displayTicket.id.slice(-8).toUpperCase()} · {displayTicket.category} · opened {relativeTime(displayTicket.createdAt)}
            </p>
          </div>
          <StatusBadge status={displayTicket.status} />
        </div>
      </div>

      {/* Message thread */}
      <div className="flex flex-col gap-[8px]">
        {(full?.messages ?? []).map((msg) => (
          <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[80%] rounded-[var(--radius-lg)] px-[14px] py-[10px]",
              msg.isAdmin
                ? "bg-[var(--panel)] border border-[var(--border)]"
                : "bg-[var(--accent-dim)] border border-[var(--accent-border)]")}>
              <p className="t-caption font-semibold mb-[4px]" style={{ color: msg.isAdmin ? "var(--accent-text)" : "var(--text)" }}>
                {msg.isAdmin ? "Support Team" : "You"}
              </p>
              <p className="t-body-sm text-[var(--text-soft)] whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              <p className="t-caption text-[var(--muted)] mt-[4px]">{relativeTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {isOpen ? (
        <div className="flex flex-col gap-[8px]">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="Add a reply…" rows={3} maxLength={2000} />
          {error && <p className="t-caption text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end">
            <Button variant="primary" size="md" disabled={!reply.trim() || sending}
              loading={sending} onClick={sendReply}>
              <Send className="size-3.5" /> Send reply
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-[8px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[14px] py-[12px]">
          <CheckCircle2 className="size-4 flex-shrink-0" style={{ color: "var(--success)" }} />
          <p className="t-body-sm text-[var(--text-soft)]">
            This ticket is <strong className="text-[var(--text)]">{displayTicket.status}</strong>.
            Open a new ticket if you need further help.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Ticket list item ─────────────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const lastMsg = ticket.messages?.[0];
  const awaiting = ticket.status === "awaiting_user";
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className={cn("rounded-[var(--radius-lg)] border bg-[var(--panel)] p-[14px] transition-colors hover:border-[var(--border-strong)]",
        awaiting ? "border-[var(--accent-border)]" : "border-[var(--border)]")}>
        <div className="flex items-start justify-between gap-[8px]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[6px] flex-wrap">
              {awaiting && <span className="size-2 rounded-full bg-[var(--purple)] flex-shrink-0" />}
              <p className="t-body-sm font-semibold text-[var(--text)] truncate">{ticket.subject}</p>
            </div>
            <p className="t-caption text-[var(--muted)] mt-[2px]">
              #{ticket.id.slice(-8).toUpperCase()} · {ticket.category} · {relativeTime(ticket.updatedAt)}
            </p>
            {lastMsg && (
              <p className="t-caption text-[var(--muted)] mt-[4px] truncate">
                {lastMsg.isAdmin ? "Support: " : "You: "}{lastMsg.body}
              </p>
            )}
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </button>
  );
}

// ─── Main SupportClient ───────────────────────────────────────────────────────

export function SupportClient() {
  const [view, setView]           = useState<"list" | "new" | "detail">("list");
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [selected, setSelected]   = useState<Ticket | null>(null);
  const [loading, startLoad]      = useTransition();

  const loadTickets = useCallback(() => {
    startLoad(async () => {
      const res  = await fetch("/api/tickets").catch(() => null);
      const json = res ? await res.json().catch(() => ({})) as { tickets?: Ticket[] } : {};
      setTickets(json.tickets ?? []);
    });
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const openTickets = tickets.filter((t) => !["resolved","dismissed"].includes(t.status));
  const awaitingReply = tickets.filter((t) => t.status === "awaiting_user");

  if (view === "new") {
    return (
      <div className="section-stack max-w-[640px]">
        <div className="flex items-center gap-[8px]">
          <button type="button" onClick={() => setView("list")}
            className="flex items-center gap-[6px] t-caption text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft className="size-3.5" /> Back
          </button>
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text)]">New support ticket</h1>
          <p className="t-body-sm text-[var(--text-soft)] mt-[4px]">Describe your issue and our team will get back to you.</p>
        </div>
        <NewTicketForm onCreated={(t) => { setTickets((p) => [t, ...p]); setSelected(t); setView("detail"); }} />
      </div>
    );
  }

  if (view === "detail" && selected) {
    return (
      <div className="section-stack max-w-[640px]">
        <TicketDetail ticket={selected} onBack={() => setView("list")}
          onUpdated={(t) => { setSelected(t); setTickets((p) => p.map((x) => x.id === t.id ? t : x)); }} />
      </div>
    );
  }

  return (
    <div className="section-stack">
      {/* Header */}
      <div className="flex items-start justify-between gap-[12px] flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text)]">Support</h1>
          <p className="t-body-sm text-[var(--text-soft)] mt-[4px]">
            View your tickets or create a new one for account, profile, or technical issues.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setView("new")}>
          <Plus className="size-3.5" /> New ticket
        </Button>
      </div>

      {/* Stats strip */}
      {tickets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--card-gap)]">
          {[
            { label: "Open tickets",    value: openTickets.length,    color: "var(--accent-text)" },
            { label: "Awaiting reply",  value: awaitingReply.length,  color: "var(--purple)"      },
            { label: "Total tickets",   value: tickets.length,        color: "var(--muted)"       },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[14px]">
              <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color }}>{value}</p>
              <p className="t-caption mt-[4px]">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ticket list */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <p className="t-caption text-[var(--muted)]">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</p>
          <button type="button" onClick={loadTickets}
            className="flex items-center gap-[5px] t-caption text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
          </button>
        </div>

        {tickets.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-[48px] gap-[10px] text-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
            <Inbox className="size-8 text-[var(--muted)]" />
            <div>
              <p className="t-label text-[var(--text)]">No tickets yet</p>
              <p className="t-caption mt-[3px]">Create a ticket and our team will respond within 24–48 hours.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setView("new")}>
              <Plus className="size-3.5" /> Create first ticket
            </Button>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onClick={() => { setSelected(t); setView("detail"); }} />
          ))
        )}
      </div>
    </div>
  );
}
