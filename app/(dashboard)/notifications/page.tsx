import { PagePlaceholder } from "@/components/marketing/page-placeholder";

export const metadata = { title: "Notifications — Crossing" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow={"Account"}
      title={"Notifications"}
      subtitle={"Updates about your account and saved items."}
      status={"Not available yet"}
      body={"Notifications are not implemented yet. Nothing is being sent, so nothing appears here."}
      actions={[{"label":"Back to home","href":"/"}]}
    />
  );
}
