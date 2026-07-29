import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductHeader } from "@/components/product/product-primitives";
import { SavedLibrary } from "@/components/product/saved-library";

export const metadata: Metadata = {
  title: "Saved — Crossing",
  description: "Return to listings you have confirmed as saved to your Crossing account.",
};

export default function SavedPage() {
  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Your library"
        title="Saved results"
        description="A durable shortlist of listings saved to your account. Empty, unavailable, and logged-out states never imply data was persisted."
      />
      <SavedLibrary />
    </Container>
  );
}
