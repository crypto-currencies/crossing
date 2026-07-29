import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductHeader } from "@/components/product/product-primitives";
import { SubmissionStepper } from "@/components/product/submission-stepper";

export const metadata: Metadata = {
  title: "Submit a listing — Crossing",
  description: "Suggest a listing for Crossing’s moderation queue.",
};

export default function SubmitPage() {
  return (
    <Container size="content" className="product-page">
      <ProductHeader
        eyebrow="Contribute"
        title="Suggest a missing listing"
        description="Send the public facts Crossing needs to review. A submission is never shown as successful until the existing backend confirms it."
      />
      <SubmissionStepper />
    </Container>
  );
}
