import { redirect } from "next/navigation";

export default async function CategoryAliasPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  redirect(`/browse/${encodeURIComponent(slug)}`);
}
