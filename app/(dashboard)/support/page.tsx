import { PagePlaceholder } from "@/components/marketing/page-placeholder";

export const metadata = { title: "Support — Crossing" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow={"Support"}
      title={"Support"}
      subtitle={"Get help with Crossing."}
      status={"Not available yet"}
      body={"There is no support desk yet. Crossing is pre-launch and not accepting support requests."}
      actions={[{"label":"Back to home","href":"/"}]}
    />
  );
}
