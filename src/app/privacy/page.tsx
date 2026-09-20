import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME, APP_URL } from "@/lib/site";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="shell">
      <SiteHeader />
      <p className="kicker">Privacy</p>
      <h1>Privacy Policy</h1>
      <p>
        {APP_NAME} is a restore-drill and backup-coordination product. This policy describes what the hosted app at{" "}
        {APP_URL} collects.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>ConsentKeys identity is pseudonymous. We treat `sub` as the account id and may display the provider’s generated name or email fields.</li>
        <li>The public restore drill uses short-lived synthetic ciphertext in a single request. Blob bytes are not written to a database.</li>
        <li>Privacy-safe analytics events such as page views, CTA clicks, and drill completion may be sent to a first-party PostHog host.</li>
      </ul>
      <h2>What we do not store</h2>
      <ul>
        <li>Borg passphrases, repository keys, Nostr secret keys, or plaintext backup contents.</li>
        <li>Real names or personal email addresses from ConsentKeys at the application layer.</li>
      </ul>
      <h2>Operator control</h2>
      <p>
        You can stop using the hosted drill at any time. If you signed in, signing out ends the session cookie. Contact
        the operator through the product site if you need a dashboard record removed after authentication is enabled.
      </p>
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
