import { redirect } from "next/navigation";

/**
 * `/dashboard` has no implemented product surface yet. Rather than render a blank
 * page (the previous behavior — `return null`), send users to the real consumer
 * entry point. Remove this redirect when a genuine dashboard ships.
 */
export default function DashboardPage() {
  redirect("/");
}
