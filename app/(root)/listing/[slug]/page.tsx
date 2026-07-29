import { Container } from "@/components/layout/container";
import { ListingDetail } from "@/components/product/listing-detail";

export default async function ListingPage({ params }: PageProps<"/listing/[slug]">) {
  const { slug } = await params;
  return (
    <Container size="xl" className="product-page">
      <ListingDetail slug={slug} />
    </Container>
  );
}
