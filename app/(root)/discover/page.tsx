import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { CatalogExplorer } from "@/components/product/catalog-explorer";
import { ProductHeader } from "@/components/product/product-primitives";
import { listCategories } from "@/features/recommendation/categories/definitions";

export const metadata: Metadata = {
  title: "Discover — Crossing",
  description: "Explore live catalog listings and guided starting points without invented popularity.",
};

export default function DiscoverPage() {
  const categories = listCategories().map((category) => ({
    id: category.id,
    name: category.name,
    description: `${category.attributes.length} comparable attributes in the current recommendation contract.`,
  }));

  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Discover"
        title="Find a useful place to start"
        description="Browse the live catalog when data is available, or begin with a guided search grounded in Crossing’s supported software categories."
      />
      <CatalogExplorer mode="discover" contractCategories={categories} />
    </Container>
  );
}
