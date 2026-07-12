import type { Metadata } from "next";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { listActiveCategories } from "@/features/categories/data";
import { mapCategory } from "@/features/categories/dto";
import { SignInGate } from "@/components/product/sign-in-gate";
import { PageTransition } from "@/components/motion/page-transition";
import { SubmitForm } from "@/components/submit/submit-form";

export const metadata: Metadata = { title: "Submit a listing — Crossing.dev" };

export default async function SubmitPage() {
  if (!DB_AVAILABLE) {
    return (
      <SignInGate
        title="Submit a listing"
        description="Submissions aren't available right now — the database is temporarily unreachable."
        returnTo="/submit"
      />
    );
  }

  const user = await getServerUser();
  if (!user) {
    return (
      <SignInGate
        title="Submit a listing"
        description="Sign in to submit something you think belongs on Crossing.dev."
        returnTo="/submit"
      />
    );
  }

  const categories = await listActiveCategories();

  return (
    <PageTransition>
      <SubmitForm categories={categories.map(mapCategory)} />
    </PageTransition>
  );
}
