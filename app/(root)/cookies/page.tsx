import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies" updated="July 2026" active={ROUTES.site.cookies}>
      <p>
        Crossing uses a small number of cookies to keep you signed in and remember basic preferences.
        We don&rsquo;t use tracking or advertising cookies.
      </p>
      <h2>What we set</h2>
      <p>A session cookie for login, and one for your cookie preference itself. That&rsquo;s it.</p>
    </LegalLayout>
  );
}
