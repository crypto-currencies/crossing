import { redirect } from "next/navigation";

// No admin overview yet — go straight to the only implemented admin tool.
export default function Page() {
  redirect("/control/admin/evidence");
}
