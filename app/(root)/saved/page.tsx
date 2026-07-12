import type { Metadata } from "next";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { listSavedListings } from "@/features/saves/data";
import { getVotedListingIds } from "@/features/votes/data";
import { mapListingCard } from "@/features/listings/dto";
import { SignInGate } from "@/components/product/sign-in-gate";
import { PageTransition } from "@/components/motion/page-transition";
import { SavedClient } from "@/components/saved/saved-client";

export const metadata: Metadata = { title: "Saved — Crossing.dev" };

const PAGE_SIZE = 100;

export default async function SavedPage() {
  if (!DB_AVAILABLE) {
    return (
      <SignInGate
        title="Saved"
        description="Saved listings aren't available right now — the database is temporarily unreachable."
        returnTo="/saved"
      />
    );
  }

  const user = await getServerUser();
  if (!user) {
    return (
      <SignInGate
        title="Saved"
        description="Sign in to see the listings you've saved."
        returnTo="/saved"
      />
    );
  }

  const result = await listSavedListings(user.id, { page: 1, pageSize: PAGE_SIZE, skip: 0, take: PAGE_SIZE });
  const items = result.items.map(mapListingCard);
  const votedIds = await getVotedListingIds(user.id, items.map((l) => l.id));

  return (
    <PageTransition>
      <SavedClient listings={items} votedIds={[...votedIds]} />
    </PageTransition>
  );
}
