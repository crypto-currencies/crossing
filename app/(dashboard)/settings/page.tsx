import { PagePlaceholder } from "@/components/marketing/page-placeholder";

export const metadata = { title: "Settings — Crossing" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow={"Account"}
      title={"Settings"}
      subtitle={"Manage your account."}
      status={"Not available yet"}
      body={"Account settings are not built yet. You can sign out from the topbar. Account deletion and profile editing are planned."}
      actions={[{"label":"Back to home","href":"/"}]}
    />
  );
}
