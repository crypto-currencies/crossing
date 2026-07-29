import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { CatalogExplorer } from "@/components/product/catalog-explorer";
import { ProductHeader } from "@/components/product/product-primitives";
import { listCategories } from "@/features/recommendation/categories/definitions";

export const metadata: Metadata = {
  title: "Browse categories — Crossing",
  description: "Browse Crossing’s active catalog and supported software category contract.",
};

export default function BrowsePage() {
  const categories = listCategories().map((category) => ({
    id: category.id,
    name: category.name,
    description: category.attributes.filter((attribute) => attribute.preferenceable).slice(0, 3).map((attribute) => attribute.label).join(" · "),
  }));

  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Browse"
        title="Move through the catalog"
        description="Filter active listings, switch category and sort order, or search within the result set. Counts and items come from the existing catalog endpoints."
      />
      <CatalogExplorer mode="browse" contractCategories={categories} />
    </Container>
  );
}
