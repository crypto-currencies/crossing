import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ArrowRight, Info } from "lucide-react";
import { LegalSideNav } from "@/components/legal/legal-side-nav";
import type { LegalSection } from "@/components/legal/legal-side-nav";

export const metadata: Metadata = {
  title: "Privacy Policy — crossing.dev",
  description: "How crossing.dev collects, uses, stores, and protects your information.",
};

const SECTIONS: LegalSection[] = [
  { id: "intro",        label: "Introduction"          },
  { id: "collect",      label: "What We Collect"       },
  { id: "use",          label: "How We Use Data"       },
  { id: "sharing",      label: "Data Sharing"          },
  { id: "connected",    label: "Connected Accounts"    },
  { id: "media",        label: "Media & File Storage"  },
  { id: "cookies",      label: "Cookies & Tracking"    },
  { id: "retention",    label: "Data Retention"        },
  { id: "rights",       label: "Your Rights"           },
  { id: "security",     label: "Security"              },
  { id: "children",     label: "Children"              },
  { id: "thirdparty",   label: "Third-Party Services"  },
  { id: "changes",      label: "Changes"               },
  { id: "contact",      label: "Contact"               },
];

export default function PrivacyPage() {
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
              <Lock className="size-4 text-[var(--purple-strong)]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Legal
            </span>
          </div>
          <h1 className="t-display-md text-[var(--text)] mb-[12px]">Privacy Policy</h1>
          <p className="t-body text-[var(--text-soft)] max-w-[560px]">
            This policy explains what information we collect, why we collect it, how we use it,
            and how you can control it. We believe in being direct about data.
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
            <LegalSection id="intro" index={1} title="Introduction">
              <p>
                crossing.dev (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates
                a customizable internet identity and profile platform. This Privacy Policy
                describes how we collect, use, store, and protect information when you use the
                Platform, including when you register an account, customize your profile, upload
                media, connect third-party accounts, or otherwise interact with our services.
              </p>
              <p>
                By using crossing.dev, you agree to the practices described in this policy. If you
                do not agree, please do not use the Platform.
              </p>
              <p>
                This policy applies to all users globally. Where we reference specific rights —
                such as those under GDPR or CCPA — those rights are available to all users
                regardless of location.
              </p>
            </LegalSection>

            {/* 02 */}
            <LegalSection id="collect" index={2} title="What We Collect">
              <p>
                We collect information in two ways: information you provide directly, and
                information generated automatically by your use of the Platform.
              </p>

              <DataCategory label="Account information">
                When you register, we collect your username, email address, display name, and
                password. Passwords are never stored in plain text — they are stored as
                cryptographic hashes using a memory-hard algorithm (scrypt). If you sign up via
                Google OAuth, we receive your name, email, and profile picture from Google
                instead of a password.
              </DataCategory>

              <DataCategory label="Profile content">
                Information you voluntarily add to your profile: bio, tagline, accent color,
                layout preferences, links, showcase entries, collection items, and any other
                material you choose to display publicly.
              </DataCategory>

              <DataCategory label="Uploaded media">
                Files you upload for your profile avatar, banner, page background, and music
                artwork. These files are stored in cloud object storage (see the Media &amp;
                File Storage section below for details). We record the storage URL of each
                uploaded file in our database to enable delivery and deletion.
              </DataCategory>

              <DataCategory label="Connected account data">
                When you link a third-party account (Discord, Twitch, Spotify, GitHub, Steam,
                and others), we receive limited publicly available profile data from that
                platform — typically your platform username, avatar URL, and a
                platform-specific account identifier. We do not receive or store passwords,
                private messages, or sensitive account data from third-party platforms.
              </DataCategory>

              <DataCategory label="Usage and technical data">
                Pages visited, features used, timestamps, IP address, browser type, device
                type, operating system, and referring URLs. This data is used to operate,
                secure, and improve the Platform.
              </DataCategory>

              <DataCategory label="Communications">
                If you contact our support team or report content, we retain those communications
                to respond to and resolve your request. Messages you send through any Platform
                messaging feature are stored to deliver the messaging service. We do not read
                private messages except when required for a moderation investigation, to
                respond to a support request, or as required by law.
              </DataCategory>
            </LegalSection>

            {/* 03 */}
            <LegalSection id="use" index={3} title="How We Use Your Information">
              <TldrBox>
                We use your data to run the service, keep it secure, and improve it. We do
                not sell your data or use it for advertising.
              </TldrBox>
              <p>We use the information we collect to:</p>
              <LegalList items={[
                "Provide, operate, and maintain the Platform and all of its features.",
                "Display your public profile — including media, links, and connected accounts — to visitors.",
                "Authenticate your identity, maintain session security, and protect your account.",
                "Send transactional communications: account verification emails, password reset links, and security alerts.",
                "Detect, investigate, and prevent fraud, abuse, spam, and violations of our Terms of Service and Content Policy.",
                "Respond to support requests, reports, and other communications you initiate.",
                "Analyse anonymized, aggregate usage data to understand how the Platform is used and to prioritize improvements.",
                "Comply with legal obligations and enforce our Terms.",
              ]} />
              <p>
                <strong className="text-[var(--text)]">We do not:</strong> sell your personal
                data to third parties, use your data to build advertising profiles, serve
                targeted advertising based on your activity, or share your data with data
                brokers.
              </p>
            </LegalSection>

            {/* 04 */}
            <LegalSection id="sharing" index={4} title="Data Sharing">
              <TldrBox>
                We do not sell your data. We share it only with infrastructure providers
                necessary to run the service, and when required by law.
              </TldrBox>
              <p>
                <strong className="text-[var(--text)]">We do not sell your personal data.</strong>{" "}
                We share your information only in the following limited circumstances:
              </p>
              <LegalList items={[
                "Infrastructure and service providers: We use third-party services for cloud hosting (Vercel), database hosting (Neon), object storage (Vercel Blob), and transactional email. These providers process data on our behalf under data processing agreements and are contractually prohibited from using your data for their own purposes.",
                "Legal compliance: We may disclose information when required to do so by a valid legal obligation — including a court order, subpoena, or binding request from a governmental authority. Where permitted by law, we will attempt to notify you before disclosing your information.",
                "Safety and harm prevention: We may share information with law enforcement or other parties where we believe in good faith that doing so is necessary to prevent imminent physical harm to a person, protect the safety of our users, or report CSAM as required by law.",
                "Business transfer: In the event of a merger, acquisition, bankruptcy, or asset sale, user information may be transferred to the acquiring entity. We will notify you via email or a prominent notice on the Platform before such a transfer occurs, and you will have an opportunity to delete your account if you do not consent.",
              ]} />
            </LegalSection>

            {/* 05 */}
            <LegalSection id="connected" index={5} title="Connected Accounts">
              <p>
                When you link a third-party account to your crossing.dev profile:
              </p>
              <LegalList items={[
                "We store the public data returned by that platform's API — typically your display name, username, avatar URL, and a platform-specific user ID.",
                "We do not retain OAuth access tokens beyond their immediate use, except where an ongoing, periodic verification process requires token storage. Any such tokens are encrypted at rest.",
                "Linked account data is displayed publicly on your profile by default. You may remove any linked account from your profile settings at any time.",
                "Removing a linked account from your crossing.dev profile deletes the stored platform data from our database but does not revoke the OAuth authorization you granted to that platform. You must revoke that access independently through the third party's own account settings.",
                "Each third-party platform's own privacy policy governs how they handle your data when you interact with their service.",
              ]} />
            </LegalSection>

            {/* 06 */}
            <LegalSection id="media" index={6} title="Media &amp; File Storage">
              <TldrBox>
                Files you upload — avatars, banners, backgrounds, and music artwork — are
                stored in Vercel Blob (cloud object storage). We keep track of where each
                file is stored so we can serve and delete it. Files are deleted when you
                remove them or delete your account.
              </TldrBox>
              <p>
                When you upload a media file (avatar, banner, background, or music artwork),
                that file is transmitted over TLS and stored in Vercel Blob, a cloud object
                storage service operated by Vercel, Inc. We record the storage URL
                (&ldquo;blob key&rdquo;) of each uploaded file in our database to enable
                us to serve the file to profile visitors and to locate it for deletion.
              </p>
              <LegalList items={[
                "Uploaded files are stored in cloud object storage and served via a CDN. This means your uploaded media may be cached in multiple geographic locations to improve delivery performance.",
                "File metadata (content type, size, upload timestamp) is retained alongside the blob key in our database.",
                "When you replace or delete a media item from your profile, we delete the associated file from Vercel Blob storage. Deletion from CDN cache may take a short time to propagate.",
                "When you delete your account, all associated uploaded media files are deleted from storage within 30 days.",
                "We do not analyze, scan for faces in, or use the content of your uploaded media for any purpose other than serving it to your profile visitors and conducting required moderation review.",
              ]} />
              <p>
                Vercel processes stored data in accordance with Vercel&rsquo;s own privacy
                policy and data processing agreement. By using the upload features, you
                acknowledge that your files are stored on Vercel&rsquo;s infrastructure.
              </p>
            </LegalSection>

            {/* 07 */}
            <LegalSection id="cookies" index={7} title="Cookies &amp; Tracking">
              <p>
                We use a minimal number of strictly necessary cookies and browser storage
                mechanisms to operate the Platform. We do not use advertising cookies,
                third-party tracking pixels, or behavioral analytics tools.
              </p>

              <CookieRow name="Session token" purpose="Authenticates your identity and keeps you logged in between requests. Required for platform use." />
              <CookieRow name="CSRF token" purpose="Protects form submissions and API requests from cross-site request forgery attacks." />
              <CookieRow name="Auth state (localStorage)" purpose="Stores your cached authentication state client-side for faster page loads. Not transmitted to third parties." />

              <p>
                We do not use Google Analytics, Meta Pixel, or any other third-party
                advertising, tracking, or analytics scripts that transmit your behavior to
                external parties. Any analytics we implement are self-hosted and do not
                share data with third-party analytics platforms.
              </p>
            </LegalSection>

            {/* 08 */}
            <LegalSection id="retention" index={8} title="Data Retention">
              <TldrBox>
                We keep your data for as long as your account is active. Delete your account
                and your data is gone within 30 days.
              </TldrBox>
              <p>
                We retain your data for as long as your account is active or as needed to
                provide the Platform. Specific retention periods:
              </p>
              <LegalList items={[
                "Account data (username, email, display name, profile settings): Retained for the lifetime of your account. Deleted within 30 days of account deletion.",
                "Uploaded media files (avatars, banners, backgrounds): Deleted from cloud storage when you replace or remove them, or within 30 days of account deletion.",
                "Connected account data: Deleted when you remove the linked account from your profile, or within 30 days of account deletion.",
                "Platform activity logs (page views, follows, reactions): Retained for up to 12 months for operational purposes, then deleted.",
                "Server logs and technical usage data: Retained for up to 90 days for security and infrastructure purposes, then deleted.",
                "Support and moderation communications: Retained for up to 2 years from the date of resolution for audit and safety purposes.",
                "Backups: Data may persist in encrypted backups for up to 90 days after deletion from active systems, after which it is permanently purged.",
              ]} />
              <p>
                When you delete your account, your public profile becomes inaccessible
                immediately. Personal data is purged from active databases within 30 days.
                We may retain minimal data longer if required by a legal hold or law
                enforcement request.
              </p>
            </LegalSection>

            {/* 09 */}
            <LegalSection id="rights" index={9} title="Your Rights">
              <TldrBox>
                You can access, correct, export, or delete your data at any time. Just
                email us.
              </TldrBox>
              <p>
                Regardless of where you are located, you have the following rights with
                respect to your personal data:
              </p>
              <LegalList items={[
                "Access: Request a copy of the personal data we hold about you.",
                "Correction: Request correction of any personal data that is inaccurate or incomplete.",
                "Deletion: Request deletion of your account and associated personal data. You can also do this directly from your account settings.",
                "Portability: Request an export of your profile data and connected account information in a machine-readable format (JSON).",
                "Restriction: Request that we restrict processing of your personal data in certain circumstances.",
                "Objection: Object to processing of your personal data for purposes not strictly necessary to provide the service.",
              ]} />
              <p>
                To exercise any of these rights, email{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">
                  security@crossing.dev
                </a>
                . We will acknowledge your request within 5 business days and respond
                substantively within 30 days.
              </p>
              <p>
                We will not discriminate against you for exercising any of these rights.
              </p>
            </LegalSection>

            {/* 10 */}
            <LegalSection id="security" index={10} title="Security">
              <p>
                We implement reasonable, industry-standard technical and organizational
                measures to protect your personal data:
              </p>
              <LegalList items={[
                "All connections to crossing.dev are encrypted using TLS (Transport Layer Security).",
                "Passwords are never stored in plain text. We use scrypt, a memory-hard key derivation function designed to resist brute-force attacks.",
                "Session tokens are randomly generated, cryptographically secure, and expire after 30 days of inactivity.",
                "Uploaded files are stored in cloud object storage with access control policies that prevent unauthorized public access beyond the CDN delivery endpoint.",
                "Our infrastructure is hosted on Vercel and Neon, which maintain industry-standard security certifications and compliance programs.",
                "Administrative access to user data is restricted to a small number of authorized personnel with a legitimate need.",
              ]} />
              <p>
                No method of internet transmission or electronic storage is 100% secure.
                While we take reasonable steps to protect your data, we cannot guarantee
                absolute security. In the event of a data breach that materially affects
                your personal data, we will notify you promptly via the email address
                associated with your account.
              </p>
            </LegalSection>

            {/* 11 */}
            <LegalSection id="children" index={11} title="Children&apos;s Privacy">
              <p>
                crossing.dev is not directed at children under the age of 13 and we do not
                knowingly collect personal information from children under 13. If you believe
                a child under 13 has created an account or provided us with personal data,
                contact us immediately at{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">
                  security@crossing.dev
                </a>{" "}
                and we will delete the data promptly.
              </p>
              <p>
                If you are between 13 and 18, you represent that a parent or legal guardian
                has consented to your use of the Platform in accordance with our Terms of
                Service.
              </p>
            </LegalSection>

            {/* 12 */}
            <LegalSection id="thirdparty" index={12} title="Third-Party Services">
              <p>
                The Platform integrates with and links to third-party services and websites.
                This Privacy Policy applies only to crossing.dev. We are not responsible for
                the privacy practices of any third-party service, including:
              </p>
              <LegalList items={[
                "Third-party platforms you connect to your profile (Discord, Twitch, Spotify, GitHub, Steam, etc.).",
                "External websites linked from your profile or another user's profile.",
                "Authentication providers (Google OAuth).",
                "Infrastructure providers (Vercel, Neon, Vercel Blob) — while these providers process data on our behalf, their own service terms and privacy policies govern their independent services.",
              ]} />
              <p>
                When you click a link that leaves the Platform, you are subject to the
                privacy practices of the destination site. We encourage you to review the
                privacy policies of any third-party service you use in connection with
                crossing.dev.
              </p>
            </LegalSection>

            {/* 13 */}
            <LegalSection id="changes" index={13} title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in
                our practices, the services we offer, or applicable law. When we make
                material changes, we will notify you by email and post a notice on the
                Platform at least <strong>7 days</strong> before changes take effect.
              </p>
              <p>
                The &ldquo;Last updated&rdquo; date at the top of this page reflects the
                most recent revision. Your continued use of the Platform after changes take
                effect constitutes acceptance of the updated policy.
              </p>
            </LegalSection>

            {/* 14 */}
            <LegalSection id="contact" index={14} title="Contact &amp; Privacy Requests">
              <p>
                For privacy questions, data access requests, or to report a concern
                regarding your personal data:
              </p>
              <div className="mt-[16px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[20px] flex flex-col gap-[12px]">
                <ContactRow label="Security, privacy &amp; data rights" email="security@crossing.dev"  />
                <ContactRow label="Account support"                     email="support@crossing.dev"   />
                <ContactRow label="Legal"                               email="legal@crossing.dev"     />
              </div>
              <ContactNotice />
              <p className="text-[var(--muted)]">
                &copy; {new Date().getFullYear()} crossing.dev — All rights reserved.
              </p>
            </LegalSection>

            {/* Cross-links */}
            <div className="flex flex-wrap gap-[14px] pt-[8px] border-t border-[var(--border)]">
              {[
                { href: "/terms",     label: "Terms of Service"      },
                { href: "/policies",  label: "Content Policy"        },
                { href: "/community", label: "Community Guidelines"   },
                { href: "/dmca",      label: "DMCA Policy"           },
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

// ─── Shared sub-components ─────────────────────────────────────────────────────

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
        <h2 className="t-heading text-[var(--text)]">{title}</h2>
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

function DataCategory({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[12px]">
      <p className="t-label text-[var(--text)] mb-[4px]">{label}</p>
      <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{children}</p>
    </div>
  );
}

function CookieRow({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="flex items-start gap-[14px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[12px]">
      <code className="font-mono text-[10px] text-[var(--text-soft)] bg-[rgba(255,255,255,0.05)] px-[8px] py-[2px] rounded flex-shrink-0 mt-[1px]">
        {name}
      </code>
      <p className="t-body-sm text-[var(--text-soft)]">{purpose}</p>
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
