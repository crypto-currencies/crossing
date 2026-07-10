import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight, Info } from "lucide-react";
import { LegalSideNav } from "@/components/legal/legal-side-nav";
import type { LegalSection } from "@/components/legal/legal-side-nav";

export const metadata: Metadata = {
  title: "Terms of Service — crossing.dev",
  description: "The terms and conditions that govern your access to and use of crossing.dev.",
};

const SECTIONS: LegalSection[] = [
  { id: "acceptance",    label: "Acceptance"             },
  { id: "eligibility",   label: "Eligibility"            },
  { id: "accounts",      label: "Accounts"               },
  { id: "usernames",     label: "Usernames"              },
  { id: "ugc",           label: "User Content"           },
  { id: "license",       label: "Content License"        },
  { id: "uploads",       label: "Uploads & Storage"      },
  { id: "prohibited",    label: "Prohibited Content"     },
  { id: "impersonation", label: "Impersonation & Scams"  },
  { id: "integrations",  label: "Integrations"           },
  { id: "ip",            label: "Intellectual Property"  },
  { id: "moderation",    label: "Moderation"             },
  { id: "termination",   label: "Termination"            },
  { id: "disclaimers",   label: "Disclaimers"            },
  { id: "liability",     label: "Liability"              },
  { id: "commercial",    label: "Commercial Features"    },
  { id: "governing",     label: "Governing Law"          },
  { id: "changes",       label: "Changes"                },
  { id: "contact",       label: "Contact"                },
];

export default function TermsPage() {
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
              <FileText className="size-4 text-[var(--purple-strong)]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Legal
            </span>
          </div>
          <h1 className="t-display-md text-[var(--text)] mb-[12px]">Terms of Service</h1>
          <p className="t-body text-[var(--text-soft)] max-w-[560px]">
            These terms govern your access to and use of crossing.dev. By using the platform
            you agree to be bound by them. Please read them carefully.
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
            <LegalSection id="acceptance" index={1} title="Acceptance of Terms">
              <p>
                By accessing or using crossing.dev — including the website, profile system, media
                uploads, integrations, and all associated features (collectively, the
                &ldquo;Platform&rdquo;) — you agree to be bound by these Terms of Service
                (&ldquo;Terms&rdquo;), our{" "}
                <Link href="/privacy" className="legal-link">Privacy Policy</Link>,{" "}
                <Link href="/policies" className="legal-link">Content Policy</Link>, and{" "}
                <Link href="/policies" className="legal-link">Content Policy</Link>.
                These documents together form the complete agreement between you and crossing.dev.
              </p>
              <p>
                If you do not agree to these Terms, you must not use the Platform. Your continued
                use of the Platform following any update to these Terms constitutes acceptance of
                the revised Terms.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you
                (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and
                crossing.dev (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
              </p>
            </LegalSection>

            {/* 02 */}
            <LegalSection id="eligibility" index={2} title="Eligibility">
              <p>
                You must be at least <strong>13 years of age</strong> to create an account or use
                crossing.dev. If you are between 13 and 18 years old, you represent that you have
                obtained the consent of a parent or legal guardian to use the Platform, and that
                your parent or guardian has read and agreed to these Terms on your behalf.
              </p>
              <p>
                By creating an account, you represent and warrant that: (i) you meet the minimum
                age requirement; (ii) all registration information you provide is accurate and
                current; and (iii) you have the legal capacity to enter into a binding agreement.
              </p>
              <p>
                We reserve the right to request proof of age at any time. If we determine that a
                user does not meet the eligibility requirements, we will terminate the account and
                delete associated data in accordance with our{" "}
                <Link href="/privacy" className="legal-link">Privacy Policy</Link>.
              </p>
            </LegalSection>

            {/* 03 */}
            <LegalSection id="accounts" index={3} title="Account Registration &amp; Security">
              <TldrBox>
                You&rsquo;re responsible for your account and everything that happens under it.
                One account per person. Keep your credentials secure.
              </TldrBox>
              <p>
                You must provide accurate, current, and complete information during registration
                and keep that information up to date. You are solely responsible for all
                activity that occurs under your account.
              </p>
              <LegalList items={[
                "Each person may hold only one account. Creating duplicate accounts to evade enforcement, circumvent suspensions, or otherwise abuse the platform is prohibited.",
                "You are responsible for maintaining the confidentiality of your login credentials. Do not share your password with any third party.",
                "Notify us immediately at security@crossing.dev if you suspect unauthorized access to your account or any security breach.",
                "crossing.dev is not liable for any loss or damage arising from unauthorized use of your account where you failed to keep your credentials secure.",
                "You may not sell, transfer, lease, or otherwise assign your account or any associated username to another person or entity.",
                "Accounts that are inactive for an extended period may be subject to reclamation of the username under our Username Policy.",
              ]} />
            </LegalSection>

            {/* 04 */}
            <LegalSection id="usernames" index={4} title="Username &amp; Identity Policy">
              <TldrBox>
                Your username is your public identity on crossing.dev. Pick something that genuinely
                represents you. Squatting, impersonation, and offensive handles are not allowed.
              </TldrBox>
              <p>
                Usernames must be between 3 and 24 characters and may contain only letters,
                numbers, underscores, and hyphens. Usernames are case-insensitive for purposes
                of uniqueness checking.
              </p>
              <LegalList items={[
                "You may not register a username that impersonates, closely mimics, or falsely suggests affiliation with any person, brand, organization, or public figure.",
                "You may not claim a username with the intent to sell it, hold it for ransom, transfer it for value, or prevent its legitimate use by its rightful owner.",
                "Usernames that are offensive, hateful, discriminatory, or designed to harass or target a specific individual or group are prohibited.",
                "Reserved names — including but not limited to 'admin', 'support', 'system', 'moderator', 'staff', 'crossing', and similar platform-associated terms — may not be registered.",
                "Displaying a verification badge, rank, or credential on your profile that you have not legitimately earned through crossing.dev is prohibited.",
                "crossing.dev reserves the right to reclaim, reassign, or suspend any username that violates this policy or that has been associated with a terminated account.",
              ]} />
              <p>
                <strong className="text-[var(--text)]">We do not verify username ownership across other platforms.</strong>{" "}
                crossing.dev does not adjudicate cross-platform username disputes. The fact
                that you hold a username on another website, social network, or service —
                including usernames that are identical or similar to yours — does not grant
                you an automatic right to that username on crossing.dev, and we will not
                reclaim, transfer, or force-release a username on the basis that you hold it
                elsewhere. We have no way to verify such claims and do not manage
                cross-platform identity disputes.
              </p>
            </LegalSection>

            {/* 05 */}
            <LegalSection id="ugc" index={5} title="User-Generated Content">
              <TldrBox>
                You own what you create. We don&rsquo;t claim ownership of your content.
                You&rsquo;re responsible for making sure you have the rights to everything
                you post.
              </TldrBox>
              <p>
                You retain full ownership of all content you create and post on crossing.dev,
                including profile text, avatars, banners, backgrounds, music artwork, showcase
                entries, collection items, custom links, and any other material you submit
                (&ldquo;User Content&rdquo;). Nothing in these Terms transfers ownership of your
                User Content to crossing.dev.
              </p>
              <p>
                By posting User Content, you represent and warrant that:
              </p>
              <LegalList items={[
                "You own the User Content or hold all necessary rights, licenses, consents, and permissions to post it on the Platform.",
                "The User Content does not infringe, misappropriate, or violate any third-party intellectual property right, right of publicity, right of privacy, or other proprietary right.",
                "The User Content does not violate any applicable law, regulation, or these Terms.",
                "You have obtained the consent of any identifiable individuals depicted in your User Content to use their likeness in the manner contemplated by the Platform.",
              ]} />
              <p>
                You are solely responsible for your User Content. crossing.dev does not endorse,
                verify, or take responsibility for User Content posted by other users.
                crossing.dev is not a publisher of User Content and exercises no editorial
                control over it prior to posting.
              </p>
            </LegalSection>

            {/* 06 */}
            <LegalSection id="license" index={6} title="Content License">
              <TldrBox>
                We need a limited license to store and display your content to run the
                service. That&rsquo;s all we&rsquo;re taking. We don&rsquo;t use your
                content to advertise or for any other purpose.
              </TldrBox>
              <p>
                By posting User Content on crossing.dev, you grant us a non-exclusive,
                royalty-free, worldwide, sublicensable, and transferable license to:
              </p>
              <LegalList items={[
                "Store and host your User Content on our infrastructure and third-party storage providers (such as Vercel Blob) solely to deliver it as part of the Platform.",
                "Display and distribute your User Content to other users of the Platform, including members of the public viewing your public profile.",
                "Resize, crop, compress, reformat, or transcode your User Content as reasonably necessary for technical compatibility, optimized delivery, or display across different devices and interfaces.",
                "Cache and create copies of your User Content as necessary for performance, redundancy, and content delivery network (CDN) distribution.",
              ]} />
              <p>
                This license is granted <strong>solely for the purpose of operating and
                providing the Platform</strong>. We will not use your User Content in
                advertisements, sell it to third parties, or use it for any purpose beyond
                what is reasonably necessary to operate and improve the service.
              </p>
              <p>
                This license terminates when you delete the specific User Content from the
                Platform, or when you delete your account, subject to any reasonable
                technical delay required to complete deletion from storage systems and
                backups as described in our{" "}
                <Link href="/privacy" className="legal-link">Privacy Policy</Link>.
              </p>
            </LegalSection>

            {/* 07 */}
            <LegalSection id="uploads" index={7} title="Uploads &amp; Storage">
              <TldrBox>
                You can upload avatars, banners, backgrounds, and music artwork. Files must
                meet size and format limits. We store uploaded files in cloud object storage
                and clean them up when you delete or replace them.
              </TldrBox>
              <p>
                crossing.dev allows you to upload media files for use as your profile avatar,
                banner, page background, and music artwork. The following conditions apply
                to all uploads:
              </p>
              <LegalList items={[
                "Uploads must comply with our Content Policy and all applicable law. Uploading illegal, harmful, or infringing content is prohibited.",
                "You must own or have all necessary rights to any file you upload. Uploading copyrighted media without authorization is a violation of these Terms and may result in a DMCA takedown and account action.",
                "Per-file size limits and permitted file types (MIME types) are enforced at upload. These limits are subject to change and are documented in the upload interface.",
                "Large animated GIFs and video backgrounds are subject to additional restrictions to protect page performance for viewers.",
                "Uploaded files are stored in cloud object storage. We track the storage location of each file to enable deletion when you remove or replace a media item.",
                "When you replace, delete, or remove a media item, we will delete the associated file from storage within a commercially reasonable timeframe.",
                "We cannot guarantee indefinite storage of uploaded files. In the event of account termination or deletion, uploaded files will be removed from storage.",
                "We reserve the right to remove any uploaded file that violates these Terms, immediately and without prior notice.",
              ]} />
            </LegalSection>

            {/* 08 */}
            <LegalSection id="prohibited" index={8} title="Prohibited Content &amp; Conduct">
              <TldrBox>
                Some things are completely off-limits. Violating these rules gets your account
                removed, not warned. Some violations — particularly those involving minors or
                non-consensual intimate imagery — are reported to authorities.
              </TldrBox>

              <p className="font-semibold text-[var(--text)]">Zero-tolerance violations</p>
              <p>
                The following constitute absolute violations of these Terms. Upon discovery,
                we will remove the content, terminate the account, and where required by law,
                report to the appropriate authorities:
              </p>
              <LegalList items={[
                "Any content that sexually exploits, depicts, or endangers minors (CSAM). We have zero tolerance for child sexual abuse material and will report all instances to the National Center for Missing & Exploited Children (NCMEC) and applicable law enforcement.",
                "Non-consensual intimate imagery (NCII) — the distribution of intimate or sexual images of a person without their consent.",
                "Content that constitutes a credible, specific threat of violence against an identifiable person or group.",
              ]} />

              <p className="font-semibold text-[var(--text)] mt-[8px]">Prohibited content</p>
              <p>
                The following content is prohibited across all parts of the Platform, including
                profiles, collections, showcases, links, and any other user-facing feature:
              </p>
              <LegalList items={[
                "Harassment, targeted abuse, sustained threatening behavior, or coordinated attacks directed at any individual or group.",
                "Content that promotes, glorifies, or incites violence, terrorism, or hate crimes.",
                "Hate speech — content that dehumanizes or calls for discrimination against individuals or groups based on race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, or similar protected characteristics.",
                "Doxxing — publishing or sharing another person's private contact information, physical location, financial information, or other personal details without their explicit consent.",
                "Malware, viruses, phishing kits, exploits, or any code or link designed to harm, deceive, or gain unauthorized access to systems or users.",
                "Spam — unsolicited, bulk, or repetitive content, mass-messaging, or coordinated artificial engagement.",
                "Content that is obscene, grossly offensive, or designed to shock or disgust without legitimate purpose.",
                "Misinformation or fabricated content designed to deceive other users in a manner that causes material harm.",
                "Any content that violates applicable local, national, or international law.",
              ]} />

              <p className="font-semibold text-[var(--text)] mt-[8px]">Prohibited conduct</p>
              <LegalList items={[
                "Attempting to gain unauthorized access to any account, system, database, or infrastructure component of the Platform.",
                "Using automated tools, scrapers, bots, or scripts to interact with the Platform without explicit written authorization from crossing.dev.",
                "Artificially inflating profile views, follower counts, reaction counts, or any other engagement metric.",
                "Using the Platform to facilitate or coordinate any form of off-platform harassment, stalking, or harm targeting specific individuals.",
                "Evading a suspension or ban by creating a new account or accessing the Platform through proxies.",
              ]} />
            </LegalSection>

            {/* 09 */}
            <LegalSection id="impersonation" index={9} title="Impersonation, Scams &amp; Phishing">
              <TldrBox>
                Don&rsquo;t pretend to be someone you&rsquo;re not, and don&rsquo;t use your
                profile to scam, phish, or deceive others. This includes fake giveaways,
                credential harvesting, and fraudulent links.
              </TldrBox>
              <p>
                crossing.dev prohibits all forms of deception designed to mislead other users
                or cause financial, reputational, or personal harm. Specifically:
              </p>
              <LegalList items={[
                "Impersonating any real person — including public figures, celebrities, platform staff, or other users — in a manner that is likely to deceive a reasonable viewer.",
                "Creating or maintaining a profile that falsely claims to be an official account of a brand, company, organization, or public figure without authorization.",
                "Operating fake giveaways, contests, or promotions — including those that require users to provide personal information, send cryptocurrency, or visit external websites under false pretenses.",
                "Including links to phishing pages, credential-harvesting sites, fake login forms, or any page designed to trick users into disclosing sensitive information.",
                "Promoting fraudulent schemes, pyramid structures, pump-and-dump arrangements, or any investment vehicle using misleading claims.",
                "Using the Platform to facilitate any form of financial fraud, identity theft, or social engineering.",
              ]} />
              <p>
                Satire and parody profiles are permitted only when the profile clearly and
                prominently identifies itself as parody and does not otherwise attempt to
                deceive viewers about the subject&rsquo;s identity, affiliation, or statements.
              </p>
              <p>
                <strong className="text-[var(--text)]">What we handle vs. what we do not.</strong>{" "}
                We investigate and act on reports of impersonation <em>on crossing.dev</em> — that
                is, accounts on this Platform that are actively pretending to be you in order to
                deceive our users. We do not handle claims that someone has registered a username
                on crossing.dev that matches one you hold on an external platform (e.g., the same
                handle you use on YouTube, Twitter, Twitch, or elsewhere). Those are separate
                platforms with their own policies, and we have no mechanism to verify or
                adjudicate such claims.
              </p>
              <p>
                If you believe an account <em>on crossing.dev</em> is actively impersonating you
                — using your name, likeness, or identity to deceive our users — you may submit
                a support ticket requesting its removal. If the account is found to be in
                violation of our impersonation rules, it will be removed and the user may face
                further penalties including permanent account termination. Use the report button
                on the profile page, or contact{" "}
                <a href="mailto:security@crossing.dev" className="legal-link">security@crossing.dev</a>{" "}
                with the subject line <em>&ldquo;Impersonation report — [username]&rdquo;</em>.
              </p>
            </LegalSection>

            {/* 10 */}
            <LegalSection id="integrations" index={10} title="Connected Accounts &amp; Integrations">
              <TldrBox>
                When you link a third-party account (Discord, Twitch, Spotify, etc.), you
                remain subject to that platform&rsquo;s own terms. We get limited public data
                from them — nothing sensitive.
              </TldrBox>
              <p>
                crossing.dev allows you to connect third-party platform accounts — including but
                not limited to Discord, Twitch, Spotify, GitHub, Steam, and others — to your
                profile. By connecting a third-party account:
              </p>
              <LegalList items={[
                "You represent that you are the rightful owner of the account you are linking. Linking accounts belonging to others is prohibited.",
                "You remain fully subject to the terms of service, community guidelines, and privacy policies of the respective third-party platform. Those terms govern your use of that platform — crossing.dev does not assume responsibility for your relationship with third-party services.",
                "We receive limited, publicly available profile data from the connected platform, such as your username, avatar, and account identifier. We do not receive or store your credentials, passwords, or private messages for any third-party platform.",
                "Linked account data is displayed publicly on your profile by default. You may remove any linked account from your profile settings at any time.",
                "Removing a linked account from your crossing.dev profile does not revoke the OAuth authorization you granted to that platform. You must revoke access independently through that platform's own account settings.",
                "crossing.dev is not responsible for any changes, outages, policy updates, API deprecations, or enforcement actions made by third-party platforms that affect connected account functionality.",
              ]} />
              <p>
                Links you add to your profile that point to external websites are your sole
                responsibility. crossing.dev does not endorse, review, or take responsibility
                for any content on linked external websites. Users who follow links leave the
                Platform and are no longer subject to our protections.
              </p>
            </LegalSection>

            {/* 11 */}
            <LegalSection id="ip" index={11} title="Intellectual Property">
              <p>
                The crossing.dev name, logo, wordmark, design system, platform code, original
                content, and all other materials created by or for crossing.dev
                (&ldquo;Platform IP&rdquo;) are the property of crossing.dev or its licensors
                and are protected by applicable intellectual property, copyright, and trademark
                law.
              </p>
              <LegalList items={[
                "You may not use the crossing.dev name, logo, or other Platform IP in any manner without prior written permission from crossing.dev.",
                "You may not reverse-engineer, decompile, or attempt to extract source code from the Platform.",
                "You may not reproduce, resell, frame, or otherwise exploit any portion of the Platform for commercial purposes without a license from crossing.dev.",
              ]} />
              <p>
                We respect the intellectual property rights of others and expect our users to
                do the same. If you believe content on the Platform infringes your copyright
                or other intellectual property right, please refer to our{" "}
                <Link href="/dmca" className="legal-link">DMCA &amp; Copyright Policy</Link>{" "}
                for information on how to submit a takedown notice.
              </p>
            </LegalSection>

            {/* 12 */}
            <LegalSection id="moderation" index={12} title="Moderation &amp; Account Actions">
              <TldrBox>
                We enforce these Terms. Enforcement ranges from content removal to permanent
                bans, depending on severity. You can appeal — but decisions for serious
                violations are final.
              </TldrBox>
              <p>
                crossing.dev maintains the right to take any enforcement action necessary to
                uphold these Terms, protect the community, and maintain platform integrity.
                Enforcement actions include but are not limited to:
              </p>
              <LegalList items={[
                "Removal of specific content — applied immediately when content is found to violate these Terms.",
                "Issuance of a formal warning — applied for first-time or lower-severity violations.",
                "Temporary suspension — applied for repeated violations, escalating severity, or conduct that requires time-limited restriction.",
                "Permanent ban — applied for severe violations, patterns of abuse, or continued violations after prior enforcement action.",
                "IP-level or device-level blocks — applied when users repeatedly evade enforcement through new accounts.",
              ]} />
              <p>
                We are not obligated to provide advance warning before taking enforcement
                action for serious, zero-tolerance, or repeat violations. For moderate
                violations, we may issue a warning before escalating.
              </p>
              <p>
                You may appeal any moderation decision by contacting{" "}
                <a href="mailto:support@crossing.dev" className="legal-link">support@crossing.dev</a>.
                We will review appeals in good faith and respond within a reasonable time.
                Our moderation decisions are final for violations of zero-tolerance rules.
              </p>
              <p>
                Attempting to evade a suspension or ban by creating a new account, using a
                proxy, or accessing the Platform through another user&rsquo;s account may
                result in all associated accounts being permanently banned.
              </p>
            </LegalSection>

            {/* 13 */}
            <LegalSection id="termination" index={13} title="Account Suspension &amp; Deletion">
              <TldrBox>
                You can delete your account at any time. We may also terminate accounts that
                violate these Terms. Either way, your uploaded files and personal data will be
                deleted within 30 days.
              </TldrBox>
              <p>
                <strong className="text-[var(--text)]">Voluntary deletion.</strong> You may
                delete your account at any time from your account settings. Upon deletion:
              </p>
              <LegalList items={[
                "Your public profile becomes inaccessible immediately.",
                "Your personal data — including email address, linked account data, and profile content — will be purged from active databases within 30 days.",
                "Uploaded media files (avatars, banners, backgrounds) will be deleted from cloud storage within 30 days.",
                "Data may persist in encrypted backups for up to 90 days, after which it is permanently deleted.",
                "Some anonymized, aggregated data (e.g., aggregate platform statistics) may be retained indefinitely as it cannot be linked back to you.",
              ]} />
              <p>
                <strong className="text-[var(--text)]">Involuntary termination.</strong> We may
                suspend or permanently terminate your account if you violate these Terms or for
                any reason at our sole discretion, including but not limited to:
              </p>
              <LegalList items={[
                "Repeated or severe violations of these Terms, or the Content Policy.",
                "Determination that the account was created using false information.",
                "A valid legal requirement, court order, or law enforcement request to disable the account.",
                "Risk of harm to users, third parties, or the Platform itself.",
              ]} />
              <p>
                Following involuntary termination, we will delete your personal data in
                accordance with our{" "}
                <Link href="/privacy" className="legal-link">Privacy Policy</Link>, subject
                to any legal hold obligations.
              </p>
            </LegalSection>

            {/* 14 */}
            <LegalSection id="disclaimers" index={14} title="Disclaimers">
              <p>
                THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
                AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
                INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p>
                crossing.dev does not warrant that: (i) the Platform will be uninterrupted,
                error-free, or secure; (ii) any defects or errors will be corrected;
                (iii) the Platform is free of viruses or other harmful components; or
                (iv) any content or information obtained through the Platform is accurate,
                complete, or reliable.
              </p>
              <p>
                We make no representations about the content posted by other users. Your
                use of the Platform and any content or services obtained through it is at
                your sole risk.
              </p>
            </LegalSection>

            {/* 15 */}
            <LegalSection id="liability" index={15} title="Limitation of Liability">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CROSSING.DEV AND ITS
                OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AGENTS, AFFILIATES, AND LICENSORS
                SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                EXEMPLARY, OR PUNITIVE DAMAGES — INCLUDING, WITHOUT LIMITATION, LOSS OF
                PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES — ARISING OUT
                OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE PLATFORM,
                EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                TO THE EXTENT LIABILITY CANNOT BE EXCLUDED UNDER APPLICABLE LAW, OUR TOTAL
                CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THESE
                TERMS OR THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU
                PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS
                (US $100).
              </p>
              <p>
                Some jurisdictions do not permit certain limitations of liability. In those
                jurisdictions, our liability is limited to the maximum extent permitted by law.
              </p>
            </LegalSection>

            {/* 16 */}
            <LegalSection id="commercial" index={16} title="Commercial &amp; Marketplace Features">
              <p>
                As of the effective date of these Terms, crossing.dev does not offer any
                commercial marketplace, account trading, subscription, or paid feature. The
                Platform is a customizable identity and profile service.
              </p>
              <p>
                If and when commercial features — including but not limited to paid
                subscriptions, profile upgrades, digital goods, or marketplace functionality —
                are introduced, they will be governed by separate supplemental terms that will
                be presented to you at the time of participation. Those supplemental terms will
                supplement, not replace, these Terms.
              </p>
            </LegalSection>

            {/* 17 */}
            <LegalSection id="governing" index={17} title="Governing Law &amp; Dispute Resolution">
              <p>
                These Terms are governed by and construed in accordance with the laws of the
                United States, without regard to conflict-of-law principles. Any dispute
                arising out of or relating to these Terms or the Platform shall be resolved
                in the federal or state courts of competent jurisdiction, and you consent to
                the personal jurisdiction of such courts.
              </p>
              <p>
                You agree to bring any claim arising from these Terms within one (1) year of
                the date the claim arose. Claims not brought within this period are
                permanently barred.
              </p>
            </LegalSection>

            {/* 18 */}
            <LegalSection id="changes" index={18} title="Changes to These Terms">
              <p>
                We may update these Terms at any time to reflect changes in the law, our
                practices, or the Platform&rsquo;s features. When we make material changes,
                we will provide notice via email or a prominent notice on the Platform at
                least <strong>7 days</strong> before the changes take effect.
              </p>
              <p>
                Your continued use of the Platform after the effective date of any revised
                Terms constitutes acceptance of those Terms. If you do not agree to the
                updated Terms, you must stop using the Platform and may delete your account.
              </p>
              <p>
                Non-material changes (such as grammatical corrections or clarifications that
                do not affect your rights) may be made without advance notice.
              </p>
            </LegalSection>

            {/* 19 */}
            <LegalSection id="contact" index={19} title="Contact">
              <p>For questions or concerns about these Terms of Service:</p>
              <div className="mt-[16px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[20px] flex flex-col gap-[12px]">
                <ContactRow label="Legal &amp; Terms"      email="legal@crossing.dev"      />
                <ContactRow label="Security &amp; moderation" email="security@crossing.dev"   />
                <ContactRow label="Account support"        email="support@crossing.dev"    />
                <ContactRow label="Copyright / DMCA"       email="dmca@crossing.dev"       />
              </div>
              <ContactNotice />
            </LegalSection>

            {/* Cross-links */}
            <div className="flex flex-wrap gap-[14px] pt-[8px] border-t border-[var(--border)]">
              {[
                { href: "/privacy",   label: "Privacy Policy"       },
                { href: "/policies",  label: "Content Policy"       },
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
