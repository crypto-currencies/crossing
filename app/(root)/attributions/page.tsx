import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { IMAGE_ATTRIBUTIONS, UNSPLASH_LICENSE } from "@/content/attributions";

export const metadata: Metadata = {
  title: "Attributions — Crossing",
  description: "Image sources, creator credits, licenses, and permissions for assets used by Crossing.",
};

export default function AttributionsPage() {
  return (
    <div className="attributions-page">
      <PageHero
        eyebrow="Sources & permissions"
        title="Attributions"
        subtitle="Creator credits, original sources, and the permissions attached to visual assets used by Crossing."
      />

      <Container size="lg" className="pb-24 sm:pb-32">
        <div className="attribution-intro">
          <p>This page is the source of record for third-party visuals used on Crossing.</p>
        </div>

        <section className="attribution-license" aria-labelledby="unsplash-license-title">
          <div className="attribution-license-heading">
            <span className="attribution-license-icon" aria-hidden="true"><ShieldCheck size={19} /></span>
            <div>
              <p>Shared license</p>
              <h2 id="unsplash-license-title">{UNSPLASH_LICENSE.name}</h2>
            </div>
          </div>
          <div className="attribution-license-copy">
            <p><strong>Use</strong>{UNSPLASH_LICENSE.permissions}</p>
            <p><strong>Limits</strong>{UNSPLASH_LICENSE.restrictions}</p>
          </div>
          <a href={UNSPLASH_LICENSE.url} target="_blank" rel="noreferrer">
            Read the license <ExternalLink size={14} />
          </a>
        </section>

        <div className="attribution-grid">
          {IMAGE_ATTRIBUTIONS.map((item) => (
            <article className="attribution-card" key={item.id}>
              <div className="attribution-image">
                <Image
                  src={item.assetPath}
                  alt={item.alt}
                  width={1200}
                  height={800}
                  sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
                />
              </div>

              <div className="attribution-content">
                <div className="attribution-heading">
                  <span>{item.sourceName}</span>
                  <h2>{item.title}</h2>
                  <p>{item.creditLine}</p>
                </div>

                <dl className="attribution-details">
                  <div><dt>Original post</dt><dd>{item.originalPostDate}</dd></div>
                  {item.retrievedAt ? <div><dt>Retrieved</dt><dd>{item.retrievedAt}</dd></div> : null}
                </dl>

                <div className="attribution-links">
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Original photo <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </div>
  );
}
