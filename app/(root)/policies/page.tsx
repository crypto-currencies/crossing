import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowRight, ShieldX, Scale, Info } from "lucide-react";
import { LegalSideNav } from "@/components/legal/legal-side-nav";
import type { LegalSection } from "@/components/legal/legal-side-nav";

export const metadata: Metadata = {
  title: "Content Policy — crossing.dev",
  description: "What content is and isn't permitted on crossing.dev, and how we enforce it.",
};

const SECTIONS: LegalSection[] = [
  { id: "overview",       label: "Overview"              },
  { id: "zerotolerance",  label: "Zero-Tolerance"        },
  { id: "prohibited",     label: "Prohibited Content"    },
  { id: "identity",       label: "Identity & Profiles"   },
  { id: "media",          label: "Media Standards"       },
  { id: "links",          label: "Links & Third Parties" },
  { id: "ownership",      label: "Content Ownership"     },
  { id: "enforcement",    label: "Enforcement"           },
  { id: "appeals",        label: "Appeals"               },
  { id: "contact",        label: "Contact"               },
];

export default function PoliciesPage() {
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
              <ShieldCheck className="size-4 text-[var(--purple-strong)]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Legal
            </span>
          </div>
          <h1 className="t-display-md text-[var(--text)] mb-[12px]">Content Policy</h1>
          <p className="t-body text-[var(--text-soft)] max-w-[560px]">
            This policy defines what content is and isn&rsquo;t permitted on crossing.dev.
            It applies to everything that appears on a profile — images, text, links,
            collections, and any other user-generated material.
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
            <PolicySection id="overview" index={1} icon={ShieldCheck} iconColor="var(--purple-strong)" title="Overview">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                crossing.dev is a platform for personal identity and self-expression. We
                believe people should be able to build a profile that genuinely represents
                who they are. At the same time, the Platform and its community are only
                valuable if users can trust what they see on it.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                This Content Policy sets the boundaries for what is permitted. These rules
                apply to all user-generated content on the Platform, including profile text
                and bios, avatars, banners, backgrounds, music artwork, showcase entries,
                collection items, custom links, and any other material you add to your profile.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                Violations of this policy are also violations of our{" "}
                <Link href="/terms" className="legal-link">Terms of Service</Link>. Depending
                on severity, violations may result in content removal, account suspension, or
                permanent ban.
              </p>
            </PolicySection>

            {/* 02 */}
            <PolicySection id="zerotolerance" index={2} icon={ShieldX} iconColor="var(--danger)" title="Zero-Tolerance Violations">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                The following categories represent absolute violations. There is no appeal
                path, no warning, and no exception. Accounts found in violation will be
                permanently terminated and, where required by law, referred to the
                appropriate authorities.
              </p>
              <ZeroToleranceItem
                title="Child sexual abuse material (CSAM)"
                description="Any content that sexually exploits, depicts, solicits, or endangers a minor. All instances are reported to the National Center for Missing & Exploited Children (NCMEC) and applicable law enforcement, as required by 18 U.S.C. § 2258A."
              />
              <ZeroToleranceItem
                title="Non-consensual intimate imagery (NCII)"
                description="Distribution of intimate, sexual, or otherwise private images of any person without that person's verified, explicit consent — including synthetic (AI-generated or deepfake) depictions."
              />
              <ZeroToleranceItem
                title="Specific credible threats of violence"
                description="Content that constitutes a credible, specific threat of physical harm, murder, or mass violence against a named or identifiable individual or group."
              />
            </PolicySection>

            {/* 03 */}
            <PolicySection id="prohibited" index={3} icon={ShieldX} iconColor="var(--warning)" title="Prohibited Content">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                The following content categories are prohibited on crossing.dev. Violations
                are subject to enforcement actions ranging from content removal to permanent
                account termination, depending on severity and history.
              </p>

              <ProhibitedCategory label="Harassment &amp; Abuse">
                Content that targets an identifiable individual with the intent to harass,
                intimidate, humiliate, or cause emotional distress — including sustained
                targeting of the same person across multiple profile elements, collections,
                or updates.
              </ProhibitedCategory>

              <ProhibitedCategory label="Hate Speech">
                Content that promotes, glorifies, or normalizes dehumanization of, or violence
                or discrimination against, individuals or groups based on race, ethnicity,
                national origin, religion, gender, gender identity, sexual orientation,
                disability, age, or similar characteristics. This includes slurs used to attack
                people and content designed to spread dehumanizing ideologies.
              </ProhibitedCategory>

              <ProhibitedCategory label="Incitement &amp; Violent Extremism">
                Content that promotes, glorifies, or recruits for terrorist organizations,
                violent extremist groups, or movements that have committed or advocated for
                mass violence. Content that incites others to commit acts of violence against
                specific people or groups.
              </ProhibitedCategory>

              <ProhibitedCategory label="Malware, Exploits &amp; Harmful Code">
                Links to, descriptions of, or files containing malware, ransomware, viruses,
                trojans, spyware, exploit kits, credential stealers, or any other software
                designed to compromise systems or steal data. Links to phishing pages or
                fake login forms designed to harvest credentials.
              </ProhibitedCategory>

              <ProhibitedCategory label="Doxxing &amp; Privacy Violations">
                Publishing or sharing another person&apos;s private information — including home
                address, phone number, email address, workplace, financial information,
                government ID numbers, or other personally identifying information — without
                their explicit consent.
              </ProhibitedCategory>

              <ProhibitedCategory label="Obscene &amp; Grossly Offensive Content">
                Graphic depictions of violence, gore, or death with no legitimate artistic
                or documentary purpose. Explicit sexual content in profile avatars, banners,
                backgrounds, or any publicly visible profile element. Content designed
                purely to shock or disgust without any communicative, artistic, or
                educational value.
              </ProhibitedCategory>

              <ProhibitedCategory label="Copyright &amp; IP Infringement">
                Uploading images, artwork, music, or other creative works for which you do
                not hold the rights. Using another creator&apos;s work — including logos, album
                artwork, fan art, or photography — without appropriate license or
                attribution. Reproducing substantial portions of copyrighted written work
                without authorization. See our{" "}
                <Link href="/dmca" className="legal-link">DMCA Policy</Link>{" "}
                for how to report infringement.
              </ProhibitedCategory>

              <ProhibitedCategory label="Spam &amp; Artificial Inflation">
                Mass-duplicate profile content, keyword-stuffed bios designed to game search
                results, artificially inflated metrics (purchased followers, fake reactions),
                or coordinated inauthentic behavior designed to manipulate Platform rankings
                or recommendations.
              </ProhibitedCategory>

              <ProhibitedCategory label="Illegal Content">
                Any content that violates applicable local, national, or international law —
                including but not limited to content that promotes or facilitates illegal
                drug sales, illegal weapons trafficking, financial fraud, human trafficking,
                or any other criminal activity.
              </ProhibitedCategory>
            </PolicySection>

            {/* 04 */}
            <PolicySection id="identity" index={4} icon={ShieldCheck} iconColor="var(--success)" title="Identity &amp; Profile Standards">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                Your profile represents you. These rules exist to ensure users can trust
                the identities they encounter on the Platform.
              </p>
              <ContentStandardList items={[
                "Impersonation is prohibited. You may not create a profile that is designed to be mistaken for another real person, brand, organization, or public figure. This includes using their name, likeness, or common identifiers without authorization.",
                "False verification signals are prohibited. Displaying a verification badge, checkmark, rank, or credential that you have not legitimately earned through crossing.dev is prohibited.",
                "Parody and satire are permitted when the profile clearly and prominently self-identifies as parody — in the username, bio, or both — and does not otherwise attempt to deceive visitors about the subject's identity.",
                "Your profile bio and 'about' sections must not contain scam offers, fraudulent claims, pyramid schemes, or content that deceives visitors into providing money or personal data.",
                "Profile links that redirect to prohibited content categories listed above are themselves prohibited.",
              ]} />
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                <strong className="text-[var(--text)]">We do not verify account ownership or handle cross-platform username claims.</strong>{" "}
                crossing.dev does not check whether the person who registered a given username on
                this Platform is the &ldquo;real&rdquo; owner of that name, and we do not
                adjudicate disputes where someone claims another user has taken their handle
                from a different website, game, or service. We have no reliable way to verify
                such claims and this falls outside the scope of what we manage.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                <strong className="text-[var(--text)]">Reporting active impersonation on crossing.dev.</strong>{" "}
                If a profile on this Platform is actively impersonating you — using your name,
                photo, or identity to deceive our users into believing they are interacting with
                you — that is a policy violation and we will act on it. You can submit a report
                using the report button on the offending profile or by contacting{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">security@crossing.dev</a>{" "}
                with the subject line <em>&ldquo;Impersonation report — [username]&rdquo;</em>.
                If the account is confirmed to be in violation, it will be removed and the
                responsible user may face further penalties up to and including permanent
                account termination.
              </p>
            </PolicySection>

            {/* 05 */}
            <PolicySection id="media" index={5} icon={ShieldCheck} iconColor="var(--success)" title="Media Upload Standards">
              <TldrBox>
                Uploads must be content you have the right to use. No explicit content,
                no content depicting real identifiable people without consent, no illegal material.
                Size and format limits apply.
              </TldrBox>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                All files you upload to crossing.dev — including avatars, banners, page
                backgrounds, and music artwork — must comply with the following standards:
              </p>
              <ContentStandardList items={[
                "You must own or hold all necessary rights to any file you upload. Uploading copyrighted images, artwork, or photos without authorization is a violation of this policy and may result in a DMCA takedown.",
                "Uploaded images and videos must not contain sexually explicit content, graphic violence, gore, or any other content prohibited under Section 3.",
                "Profile avatars must not depict real people in a manner designed to humiliate, harass, or impersonate them.",
                "Animated GIFs and video backgrounds must not contain flashing or strobing patterns that may trigger photosensitive conditions (epilepsy seizure risk).",
                "Files must not embed malicious code, steganographic payloads, or any hidden content.",
                "Per-file size limits and permitted file formats (MIME types) are enforced at the time of upload. These limits apply per file and are documented in the upload interface.",
                "Large media files — particularly high-framerate animated GIFs and high-resolution video backgrounds — may be rejected or restricted to protect profile page performance for visitors.",
              ]} />
            </PolicySection>

            {/* 06 */}
            <PolicySection id="links" index={6} icon={ShieldCheck} iconColor="var(--success)" title="Links &amp; Third-Party Content">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                You may add custom links to your profile pointing to external websites and
                platforms. Links are your responsibility. The following apply to all links
                added to your profile:
              </p>
              <ContentStandardList items={[
                "Links must not point to any of the prohibited content categories described in Section 3.",
                "Links that redirect to phishing pages, malware distribution sites, credential harvesting forms, or fraudulent schemes are prohibited.",
                "Links must not be misleadingly labeled. The displayed text for a link must accurately describe the destination.",
                "crossing.dev does not endorse, review, or take responsibility for any content on external websites. Visitors who click a link leave the Platform and are no longer subject to our policies.",
                "We reserve the right to block, warn against, or remove links to domains that have been identified as hosting prohibited content, regardless of whether the specific linked page contains that content.",
              ]} />
            </PolicySection>

            {/* 07 */}
            <PolicySection id="ownership" index={7} icon={ShieldCheck} iconColor="var(--success)" title="Content Ownership &amp; User Rights">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                You retain full ownership of all content you create and post on crossing.dev.
                By posting content, you grant crossing.dev a limited license to store, display,
                and deliver that content to operate the Platform. This license is described
                in detail in our{" "}
                <Link href="/terms#license" className="legal-link">Terms of Service</Link>.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                We do not claim ownership of your content. We do not use your content to
                advertise to other users, sell to third parties, or for any purpose beyond
                operating the service. When you delete content or your account, the license
                terminates and files are removed from storage within 30 days.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                You are solely responsible for ensuring you have the right to post any
                content you upload or link. crossing.dev cannot verify ownership claims
                prior to upload and relies on our reporting and DMCA systems to address
                infringement after the fact.
              </p>
            </PolicySection>

            {/* 08 */}
            <PolicySection id="enforcement" index={8} icon={Scale} iconColor="var(--warning)" title="Platform Enforcement">
              <TldrBox>
                We enforce this policy at our discretion. Enforcement is graduated — from
                content removal to permanent bans. Serious violations skip the warnings.
              </TldrBox>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                crossing.dev enforces this Content Policy through a combination of automated
                detection, user reports, and human review. We reserve the right to take any
                of the following enforcement actions, at our sole discretion:
              </p>
              <EnforcementRow
                action="Content removal"
                description="Applied immediately when content is found to violate this policy. Content is removed without prior notice."
              />
              <EnforcementRow
                action="Warning"
                description="Issued for first-time or lower-severity violations where the user appears unaware of the policy."
              />
              <EnforcementRow
                action="Temporary suspension"
                description="Applied for repeated violations, escalating severity, or situations requiring time-limited restriction to prevent ongoing harm."
              />
              <EnforcementRow
                action="Permanent termination"
                description="Applied for zero-tolerance violations, severe abuse, persistent violations after prior enforcement action, or ban evasion."
              />
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed mt-[8px]">
                We are not obligated to provide advance notice before enforcement for
                serious violations. For certain categories — including CSAM, NCII, and
                credible threats — enforcement is immediate and irrevocable.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                crossing.dev reserves the right to remove any content, suspend any account,
                and refuse service at any time, including for content or behavior that does
                not fall neatly within a defined category but that we determine, in our
                reasonable judgment, to be harmful, deceptive, or inconsistent with the
                spirit of these policies.
              </p>
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                To report a violation, use the report option on any profile or email{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">
                  security@crossing.dev
                </a>
                . Reports are confidential — the reported party is not told who filed the
                report. False or bad-faith reports are themselves a policy violation.
              </p>
            </PolicySection>

            {/* 09 */}
            <PolicySection id="appeals" index={9} icon={ShieldCheck} iconColor="var(--success)" title="Appeals">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                If your content was removed or your account was suspended for a reason you
                believe was incorrect or applied in error, you may appeal the decision:
              </p>
              <ContentStandardList items={[
                "Email support@crossing.dev with the subject line 'Appeal — [username]' and a clear explanation of why you believe the enforcement action was incorrect.",
                "Include any relevant context, supporting information, or evidence that the content complies with this policy.",
                "Appeals for content removal are reviewed within 5 business days. Appeals for account suspensions are reviewed within 10 business days.",
                "We will review your appeal in good faith. If we determine the action was in error, we will restore the content or account promptly.",
                "Decisions related to zero-tolerance violations (CSAM, NCII, credible threats) are not subject to appeal.",
                "Abuse of the appeal process — including repeat or bad-faith appeals — may itself constitute a policy violation.",
              ]} />
            </PolicySection>

            {/* 10 */}
            <PolicySection id="contact" index={10} icon={ShieldCheck} iconColor="var(--muted)" title="Contact">
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                For questions about this Content Policy or to report a violation:
              </p>
              <div className="mt-[8px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[20px] flex flex-col gap-[12px]">
                <ContactRow label="Security &amp; moderation reports" email="security@crossing.dev" />
                <ContactRow label="DMCA / Copyright"                  email="dmca@crossing.dev"     />
                <ContactRow label="Account support"                   email="support@crossing.dev"  />
                <ContactRow label="Legal"                             email="legal@crossing.dev"    />
              </div>
              <ContactNotice />
              <p className="t-body-sm text-[var(--muted)] mt-[8px]">
                &copy; {new Date().getFullYear()} crossing.dev — All rights reserved.
                This policy is subject to change. Rules are effective as of the date above.
              </p>
            </PolicySection>

            {/* Cross-links */}
            <div className="flex flex-wrap gap-[14px] pt-[8px] border-t border-[var(--border)]">
              {[
                { href: "/terms",     label: "Terms of Service"     },
                { href: "/privacy",   label: "Privacy Policy"       },
                { href: "/community", label: "Community Guidelines"  },
                { href: "/dmca",      label: "DMCA Policy"          },
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

function PolicySection({
  id,
  index,
  icon: Icon,
  iconColor,
  title,
  children,
}: {
  id: string;
  index: number;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[88px]">
      <div className="flex items-center gap-[12px] mb-[16px]">
        <span className="font-mono text-[10px] text-[var(--muted)] flex-shrink-0 w-[20px]">
          {String(index).padStart(2, "0")}
        </span>
        <div
          className="flex size-7 items-center justify-center rounded-[var(--radius-lg)] flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${iconColor} 12%, transparent)` }}
        >
          <Icon className="size-3.5" style={{ color: iconColor }} />
        </div>
        <h2
          className="t-heading text-[var(--text)]"
          dangerouslySetInnerHTML={{ __html: title }}
        />
      </div>
      <div className="pl-[30px] flex flex-col gap-[14px]">
        {children}
      </div>
    </section>
  );
}

function ZeroToleranceItem({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="rounded-[var(--radius-lg)] px-[14px] py-[12px]"
      style={{
        background: "color-mix(in srgb, var(--danger) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
      }}
    >
      <p className="t-label text-[var(--danger)] mb-[4px]">{title}</p>
      <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{description}</p>
    </div>
  );
}

function ProhibitedCategory({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[12px]">
      <p
        className="t-label text-[var(--text)] mb-[4px]"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{children}</p>
    </div>
  );
}

function ContentStandardList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-[8px]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-[10px] t-body-sm text-[var(--text-soft)] leading-relaxed">
          <ShieldCheck className="size-3.5 mt-[2px] flex-shrink-0 text-[var(--success)]" />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

function EnforcementRow({ action, description }: { action: string; description: string }) {
  return (
    <div className="flex items-start gap-[14px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[12px]">
      <p className="t-label text-[var(--warning)] flex-shrink-0 w-[140px]">{action}</p>
      <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">{description}</p>
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
