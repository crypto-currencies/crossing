import type { Metadata } from "next";
import Link from "next/link";
import { Copyright, ArrowRight, AlertTriangle, FileText, RotateCcw, ShieldX, Info } from "lucide-react";
import { LegalSideNav } from "@/components/legal/legal-side-nav";
import type { LegalSection } from "@/components/legal/legal-side-nav";

export const metadata: Metadata = {
  title: "DMCA & Copyright Policy — crossing.dev",
  description: "How crossing.dev handles copyright claims and DMCA takedown notices.",
};

const SECTIONS: LegalSection[] = [
  { id: "overview",      label: "Overview"           },
  { id: "reporting",     label: "Reporting Infringement" },
  { id: "notice",        label: "Notice Requirements" },
  { id: "process",       label: "Our Process"        },
  { id: "counter",       label: "Counter-Notice"     },
  { id: "repeat",        label: "Repeat Infringers"  },
  { id: "misuse",        label: "Misuse of DMCA"     },
  { id: "other-ip",      label: "Other IP Claims"    },
  { id: "contact",       label: "Contact"            },
];

export default function DmcaPage() {
  return (
    <div className="w-full">
      <div className="page-shell" style={{ maxWidth: 1040 }}>

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="mb-[48px]">
          <div className="flex items-center gap-[8px] mb-[16px]">
            <div
              className="flex size-8 items-center justify-center rounded-[var(--radius-lg)]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Copyright className="size-4 text-[var(--purple-strong)]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Legal
            </span>
          </div>
          <h1 className="t-display-md text-[var(--text)] mb-[12px]">DMCA &amp; Copyright Policy</h1>
          <p className="t-body text-[var(--text-soft)] max-w-[560px]">
            crossing.dev respects intellectual property rights and complies with the Digital
            Millennium Copyright Act (DMCA). This policy explains how to report infringement,
            how we handle takedown requests, and how users may dispute incorrect takedowns.
          </p>
          <div className="flex items-center gap-[16px] mt-[16px]">
            <span className="t-caption text-[var(--muted)]">Effective: June 9, 2026</span>
            <span className="text-[var(--border)]">·</span>
            <span className="t-caption text-[var(--muted)]">Last updated: June 9, 2026</span>
          </div>
        </div>

        {/* ── Two-column layout ──────────────────────────────────────────────── */}
        <div className="flex gap-[56px] items-start">
          <LegalSideNav sections={SECTIONS} />

          <div className="flex-1 min-w-0 flex flex-col gap-[40px]">

            {/* 01 */}
            <LegalSection id="overview" index={1} title="Overview">
              <p>
                crossing.dev is a user-generated profile platform. We store and serve content
                uploaded by our users, including images, media files, links, and profile text.
                As a service provider hosting user content, crossing.dev qualifies for the safe
                harbor protections under Section 512 of the Digital Millennium Copyright Act,
                17 U.S.C. § 512 (&ldquo;DMCA&rdquo;).
              </p>
              <p>
                To maintain our safe harbor status, we operate a designated agent system for
                receiving and processing copyright takedown notices, and we have a policy of
                terminating the accounts of repeat infringers in appropriate circumstances.
              </p>
              <p>
                If you believe content on crossing.dev infringes your copyright, this policy
                explains how to submit a formal notice and what will happen next.
              </p>
            </LegalSection>

            {/* 02 */}
            <LegalSection id="reporting" index={2} title="Reporting Copyright Infringement">
              <TldrBox>
                If someone uploaded your copyrighted work to their profile without your
                permission, email us a DMCA notice at dmca@crossing.dev. Include all the
                required elements below — incomplete notices cannot be actioned.
              </TldrBox>
              <p>
                To submit a valid DMCA takedown notice, you must be the copyright owner or
                an authorized representative of the copyright owner. Notices may be submitted
                by email to our designated copyright agent:
              </p>
              <div
                className="rounded-[var(--radius-lg)] px-[16px] py-[14px]"
                style={{
                  background: "color-mix(in srgb, var(--purple) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--purple) 22%, transparent)",
                }}
              >
                <p className="t-label text-[var(--text)] mb-[2px]">Designated DMCA Agent</p>
                <p className="t-body-sm text-[var(--text-soft)] mb-[8px]">crossing.dev Copyright Team</p>
                <a
                  href="mailto:dmca@crossing.dev"
                  className="font-mono text-[13px] text-[var(--purple)] hover:text-[var(--purple-strong)] transition-colors"
                >
                  dmca@crossing.dev
                </a>
              </div>
              <p>
                We process DMCA notices submitted by email only. Notices sent via other
                channels (social media, in-app reports) will not be processed as formal
                DMCA takedown requests.
              </p>
            </LegalSection>

            {/* 03 */}
            <LegalSection id="notice" index={3} title="Required Notice Elements">
              <p>
                To be valid under 17 U.S.C. § 512(c)(3), a DMCA takedown notice must include
                all of the following elements. Notices that omit required elements may be
                rejected or returned for completion before action is taken:
              </p>
              <NoticeItem index={1} label="Identification of the copyrighted work">
                Describe the copyrighted work that you claim has been infringed. If you are
                claiming multiple works in a single notice, you may provide a representative
                list.
              </NoticeItem>
              <NoticeItem index={2} label="Identification of the infringing material">
                Identify the specific material on crossing.dev that you claim is infringing,
                with sufficient detail to locate it — including the full URL of the profile
                page and a description of which specific element (avatar, banner, background,
                collection item, etc.) contains the infringing content.
              </NoticeItem>
              <NoticeItem index={3} label="Your contact information">
                Provide your full legal name, mailing address, telephone number, and email
                address so that we can contact you regarding your notice.
              </NoticeItem>
              <NoticeItem index={4} label="Good-faith belief statement">
                A statement that you have a good-faith belief that the use of the material
                in the manner complained of is not authorized by the copyright owner, its
                agent, or the law.
              </NoticeItem>
              <NoticeItem index={5} label="Accuracy and authority statement">
                A statement, made under penalty of perjury, that: (a) the information in the
                notice is accurate, and (b) you are the copyright owner or are authorized to
                act on behalf of the copyright owner.
              </NoticeItem>
              <NoticeItem index={6} label="Physical or electronic signature">
                Your physical or electronic signature. Typing your full legal name in the
                notice constitutes an electronic signature for this purpose.
              </NoticeItem>
            </LegalSection>

            {/* 04 */}
            <LegalSection id="process" index={4} title="Our Process">
              <p>
                When we receive a complete and valid DMCA takedown notice, we will:
              </p>
              <LegalList items={[
                "Review the notice to confirm it contains all required elements.",
                "Promptly disable access to or remove the identified content.",
                "Notify the user whose content was removed that a DMCA notice was received and that their content has been taken down. We do not typically share the contents of the notice with the user without the notifier's consent, but we will inform them that a formal copyright claim was made.",
                "Provide the user with information about how to submit a counter-notice if they believe the takedown was made in error.",
              ]} />
              <p>
                We aim to action valid notices within 3–5 business days of receipt. Complex
                or disputed notices may take longer. We will communicate with you if we need
                additional information to process your notice.
              </p>
              <p>
                We will not forward your personal contact information to the accused user
                unless required to do so in connection with a counter-notice process or
                legal proceeding.
              </p>
            </LegalSection>

            {/* 05 */}
            <LegalSection id="counter" index={5} title="Counter-Notice">
              <TldrBox>
                If your content was removed because of a DMCA notice and you believe the
                takedown was wrong — for example, you have the rights to the content or it
                qualifies as fair use — you may file a counter-notice.
              </TldrBox>
              <p>
                If your content was removed in response to a DMCA notice and you believe
                the takedown was made in error or that you have the right to use the
                material, you may submit a counter-notice under 17 U.S.C. § 512(g).
                A valid counter-notice must include:
              </p>
              <LegalList items={[
                "Identification of the material that was removed and the URL where it previously appeared.",
                "A statement under penalty of perjury that you have a good-faith belief that the material was removed as a result of mistake or misidentification.",
                "Your full legal name, mailing address, and telephone number.",
                "A statement that you consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located (or the Northern District of California if your address is outside the United States), and that you will accept service of process from the party who filed the original notice.",
                "Your physical or electronic signature.",
              ]} />
              <p>
                Counter-notices must be submitted by email to{" "}
                <a href="mailto:dmca@crossing.dev" className="legal-link">dmca@crossing.dev</a>
                {" "}with the subject line &ldquo;DMCA Counter-Notice.&rdquo;
              </p>
              <p>
                If we receive a valid counter-notice, we will: (a) notify the original
                complainant that we have received a counter-notice; (b) wait 10–14 business
                days; and (c) restore the removed content unless the complainant notifies us
                that they have filed a legal action to restrain the activity. We are not
                required to restore content if we determine the counter-notice is invalid
                or made in bad faith.
              </p>
            </LegalSection>

            {/* 06 */}
            <LegalSection id="repeat" index={6} title="Repeat Infringer Policy">
              <p>
                In accordance with 17 U.S.C. § 512(i), crossing.dev maintains a policy of
                terminating the accounts of users who are determined, in our reasonable
                judgment, to be repeat infringers.
              </p>
              <p>
                A &ldquo;repeat infringer&rdquo; is a user who has had multiple valid DMCA
                takedowns actioned against their content and has not demonstrated good faith
                in remedying their conduct. We evaluate each case individually, considering
                factors such as the number of notices received, the similarity of the
                infringing content, and whether the user responded to prior takedowns by
                removing or replacing the content voluntarily.
              </p>
              <p>
                Users whose accounts are terminated under this policy may not create new
                accounts to circumvent the termination.
              </p>
            </LegalSection>

            {/* 07 */}
            <LegalSection id="misuse" index={7} title="Misuse of the DMCA Process">
              <p>
                The DMCA takedown process is a legal mechanism, and misusing it has
                legal consequences. Under 17 U.S.C. § 512(f), a person who knowingly
                materially misrepresents that material is infringing, or that material was
                removed by mistake, may be liable for damages — including attorneys&rsquo; fees
                — incurred by the other party.
              </p>
              <p>
                Do not submit a DMCA notice for content that you do not have a good-faith
                belief is infringing, or as a tactic to silence criticism, remove competitor
                content, or harass a user. Misuse of the DMCA process may also violate our{" "}
                <Link href="/terms" className="legal-link">Terms of Service</Link> and may
                result in your own account being terminated.
              </p>
            </LegalSection>

            {/* 08 */}
            <LegalSection id="other-ip" index={8} title="Other Intellectual Property Claims">
              <p>
                This policy applies specifically to copyright infringement under the DMCA.
                For other intellectual property concerns — including trademark infringement,
                trade dress violations, or impersonation of a brand or organization — please
                contact us at{" "}
                <a href="mailto:legal@crossing.dev" className="legal-link">legal@crossing.dev</a>{" "}
                with a description of your claim and the relevant profile URL.
              </p>
              <p>
                We handle trademark and impersonation claims separately from the DMCA process
                and will evaluate them under our{" "}
                <Link href="/terms#usernames" className="legal-link">Username &amp; Identity Policy</Link>{" "}
                and applicable law.
              </p>
              <p>
                For privacy-related complaints — including requests to remove content that
                reveals personal information about you without your consent — please email{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">security@crossing.dev</a>.
              </p>
            </LegalSection>

            {/* 09 */}
            <LegalSection id="contact" index={9} title="Contact">
              <p>
                All copyright-related communications should be directed to:
              </p>
              <div className="mt-[8px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[20px] flex flex-col gap-[12px]">
                <ContactRow label="DMCA notices &amp; counter-notices"          email="dmca@crossing.dev"     />
                <ContactRow label="Trademark &amp; other IP claims"             email="legal@crossing.dev"    />
                <ContactRow label="Security, privacy &amp; moderation reports"  email="security@crossing.dev" />
                <ContactRow label="Account support"                             email="support@crossing.dev"  />
              </div>
              <ContactNotice />
              <p className="t-body-sm text-[var(--muted)] mt-[8px]">
                &copy; {new Date().getFullYear()} crossing.dev — All rights reserved.
              </p>
            </LegalSection>

            {/* Cross-links */}
            <div className="flex flex-wrap gap-[14px] pt-[8px] border-t border-[var(--border)]">
              {[
                { href: "/terms",     label: "Terms of Service"     },
                { href: "/policies",  label: "Content Policy"       },
                { href: "/privacy",   label: "Privacy Policy"       },
                { href: "/community", label: "Community Guidelines"  },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-[5px] t-caption text-[var(--purple)] hover:text-[var(--purple-strong)] transition-colors"
                >
                  {label} <ArrowRight className="size-3" />
                </Link>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function LegalSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[88px]">
      <div className="flex items-baseline gap-[10px] mb-[14px]">
        <span className="font-mono text-[10px] text-[var(--muted)] flex-shrink-0 w-[20px]">
          {String(index).padStart(2, "0")}
        </span>
        <h2
          className="t-heading text-[var(--text)]"
          dangerouslySetInnerHTML={{ __html: title }}
        />
      </div>
      <div className="pl-[30px] flex flex-col gap-[12px] t-body-sm text-[var(--text-soft)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-[8px] mt-[4px]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-[10px]">
          <span className="mt-[6px] size-[4px] flex-shrink-0 rounded-full bg-[var(--purple)]/40" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NoticeItem({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-[14px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[12px]">
      <span className="font-mono text-[10px] font-bold text-[var(--purple)] flex-shrink-0 pt-[1px] w-[16px]">
        {index}.
      </span>
      <div className="flex flex-col gap-[2px]">
        <p className="t-label text-[var(--text)]">{label}</p>
        <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function TldrBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-[12px] rounded-[var(--radius-lg)] px-[16px] py-[12px]"
      style={{
        background: "color-mix(in srgb, var(--purple) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--purple) 22%, transparent)",
      }}
    >
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--purple)] flex-shrink-0 pt-[1px]">
        TL;DR
      </span>
      <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{children}</p>
    </div>
  );
}

function ContactRow({ label, email }: { label: string; email: string }) {
  return (
    <div className="flex items-center justify-between gap-[16px] flex-wrap">
      <span
        className="t-label text-[var(--text)]"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <a
        href={`mailto:${email}`}
        className="t-body-sm text-[var(--purple)] hover:text-[var(--purple-strong)] transition-colors font-mono"
      >
        {email}
      </a>
    </div>
  );
}

function ContactNotice() {
  return (
    <div
      className="flex gap-[10px] rounded-[var(--radius-lg)] px-[14px] py-[12px]"
      style={{
        background: "color-mix(in srgb, var(--warning) 5%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 16%, transparent)",
      }}
    >
      <Info className="size-[13px] flex-shrink-0 mt-[2px]" style={{ color: "var(--warning)" }} />
      <div className="flex flex-col gap-[6px] t-body-sm text-[var(--text-soft)] leading-relaxed">
        <p>
          <strong className="text-[var(--text)]">All contact addresses redirect to the same inbox</strong>
          {" "}— <code className="font-mono text-[11px] bg-[rgba(255,255,255,0.06)] px-[5px] py-[1px] rounded">admins@crossing.dev</code>.
          General moderation and security reports go to{" "}
          <a href="mailto:security@crossing.dev" className="legal-link font-mono">security@crossing.dev</a>.
        </p>
        <p>
          <strong className="text-[var(--text)]">
            <code className="font-mono text-[11px] bg-[rgba(255,255,255,0.06)] px-[5px] py-[1px] rounded">admins@crossing.dev</code>{" "}
            is the only address that will ever send you email.
          </strong>{" "}
          We will only ever initiate contact for: updates to our Terms of Service or policies,
          critical security alerts about your account, and platform announcements if you have
          opted in to receive them. If you receive email claiming to be from crossing.dev from
          any other sender address, do not follow any links — treat it as fraudulent.
        </p>
        <p>
          <strong className="text-[var(--text)]">Always include what your inquiry is about in
          the subject line</strong> — for example: <em>&ldquo;DMCA takedown — [URL]&rdquo;</em>,{" "}
          <em>&ldquo;Account appeal — [username]&rdquo;</em>, or{" "}
          <em>&ldquo;Security report — [brief description]&rdquo;</em>. Emails without a clear
          subject may not receive a timely response. 
        </p>
      </div>
    </div>
  );
}
