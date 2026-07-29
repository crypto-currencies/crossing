import { Container } from "@/components/layout/container";
import { CatalogExplorer } from "@/components/product/catalog-explorer";
import { ProductHeader } from "@/components/product/product-primitives";
import { getCategory, listCategories } from "@/features/recommendation/categories/definitions";

export default async function BrowseCategoryPage({ params }: PageProps<"/browse/[category]">) {
  const { category: categoryId } = await params;
  const category = getCategory(categoryId);
  const categories = listCategories().map((item) => ({
    id: item.id,
    name: item.name,
    description: item.attributes.filter((attribute) => attribute.preferenceable).slice(0, 3).map((attribute) => attribute.label).join(" · "),
  }));

  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Browse category"
        title={category?.name ?? "Catalog category"}
        description={
          category
            ? `Compare listings using the category’s ${category.attributes.length} supported attributes and live catalog data.`
            : "This category is not in the current recommendation contract. The catalog will show results only if the backend recognizes it."
        }
      />
      <CatalogExplorer mode="browse" contractCategories={categories} initialCategory={categoryId} />
    </Container>
  );
}
