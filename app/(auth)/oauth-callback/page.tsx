import { Spinner } from "@/components/ui/spinner";

export default function OAuthCallbackPage() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Spinner size={28} />
      <p className="t-body-sm text-[var(--text-secondary)]">Signing you in…</p>
    </div>
  );
}
