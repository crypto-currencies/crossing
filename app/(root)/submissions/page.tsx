import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductHeader } from "@/components/product/product-primitives";
import { SubmissionHistory } from "@/components/product/submission-history";

export const metadata: Metadata = {
  title: "Your submissions — Crossing",
  description: "Track moderation for listing submissions confirmed by Crossing.",
};

export default function SubmissionsPage() {
  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Your contributions"
        title="Submission history"
        description="Pending, approved, and rejected states come from the existing submissions endpoint. Nothing is marked received until persistence is confirmed."
      />
      <SubmissionHistory />
    </Container>
  );
}
