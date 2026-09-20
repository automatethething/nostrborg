import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME } from "@/lib/site";
import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="shell">
      <SiteHeader />
      <p className="kicker">Terms</p>
      <h1>Terms of Service</h1>
      <p>
        {APP_NAME} is a research-stage backup replication tool. The hosted restore drill uses synthetic ciphertext only
        and is provided as-is for testing.
      </p>
      <h2>No backup warranty yet</h2>
      <p>
        Do not rely on this hosted app as your only copy of production data. Local Borg proofs and the hosted drill
        demonstrate replica-loss recovery for synthetic fixtures. They are not a managed SLA.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not upload unlawful content, secrets you do not control, or anything other than the synthetic drill the
        product generates. Rate or availability limits may apply.
      </p>
      <h2>Identity-provider change</h2>
      <p>
        If the app changes identity providers, or the company is sold or changes control, ConsentKeys must not reveal a
        user’s real identity unless the user first sees a clear warning and manually types `I consent`.
      </p>
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
