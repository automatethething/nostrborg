import { OperatorConsole } from "@/components/OperatorConsole";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { SiteHeader } from "@/components/SiteHeader";
import { consentKeysConfigured, signIn, signOut } from "@/lib/auth";
import { optionalAuth } from "@/lib/optional-auth";
import { APP_NAME } from "@/lib/site";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await optionalAuth();
  const canSignIn = consentKeysConfigured();

  if (!session?.user?.id) {
    return (
      <main className="shell">
        <SiteHeader />
        <p className="kicker">Dashboard</p>
        <h1>Sign in to save drill history</h1>
        <p className="lede">
          The public restore drill on the home page works without an account. Sign in with ConsentKeys to keep recent
          pass/fail receipts on this operator dashboard. Recovery keys stay on your device.
        </p>
        {canSignIn ? (
          <form action={async () => { "use server"; await signIn("consentkeys", { redirectTo: "/dashboard" }); }}>
            <button className="btn btn-primary" type="submit">
              Sign in with ConsentKeys
            </button>
          </form>
        ) : (
          <p className="card">
            ConsentKeys is not configured in this environment yet. Use the public{" "}
            <Link href="/#restore-drill">restore drill</Link> to test the product loop.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="shell">
      <SiteHeader signedIn />
      <p className="kicker">Operator dashboard</p>
      <h1 style={{ fontSize: 42, marginBottom: 8 }}>Replica drills</h1>
      <p style={{ color: "var(--muted)" }}>
        Signed in as {session.user.name || "pseudonymous operator"}. Recovery keys are never stored here.
      </p>

      <PwaInstallPrompt
        appName={APP_NAME}
        reason="Keep the restore drill one tap away while you dogfood replica loss."
      />

      <OperatorConsole />

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Local Borg proof</h2>
        <p>
          Run <code>./scripts/local-rehearsal.sh</code> on a machine with Borg installed to prove a real encrypted
          repository survives replica loss.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
