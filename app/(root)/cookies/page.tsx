import { LegalLayout } from "@/components/legal/legal-layout";
import { ROUTES } from "@/lib/routes";

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies" updated="July 2026" active={ROUTES.site.cookies}>
      <p>
        Crossing uses a small number of strictly necessary cookies to keep you signed in. We do not
        use tracking, profiling, or advertising cookies.
      </p>

      <h2>What we set</h2>
      <ul>
        <li>
          <strong>session_token</strong> — an httpOnly cookie identifying your signed-in session.
          Required for you to stay logged in. Expires after 30 days or when you log out.
        </li>
        <li>
          <strong>next-auth.session-token</strong> — set during Google sign-in as part of the OAuth
          flow. Cleared on logout.
        </li>
      </ul>

      <h2>Local storage</h2>
      <p>
        We also keep a small amount of data in your browser&rsquo;s local storage so the interface
        can show your signed-in state immediately on page load. It is cleared when you log out.
      </p>

      <h2>Managing cookies</h2>
      <p>
        These cookies are strictly necessary — blocking them will prevent you from signing in.
        Searching and browsing work without signing in at all.
      </p>
    </LegalLayout>
  );
}
