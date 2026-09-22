import { RestoreDrill } from "@/components/RestoreDrill";
import { SiteHeader } from "@/components/SiteHeader";
import { optionalAuth } from "@/lib/optional-auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/site";
import Link from "next/link";

export default async function HomePage() {
  const session = await optionalAuth();

  return (
    <main className="shell">
      <SiteHeader signedIn={Boolean(session?.user?.id)} />
      <section className="hero">
        <p className="kicker">{APP_NAME}</p>
        <h1>{APP_TAGLINE}</h1>
        <p className="lede">
          NostrBorg keeps Borg repositories as encrypted, content-addressed blobs across independent replicas. The
          product test is simple: destroy one store, restore byte-identical ciphertext from the survivor.
        </p>
      </section>

      <div className="grid" style={{ marginTop: 28 }}>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Opaque by default</h2>
          <p style={{ color: "var(--muted)" }}>
            Storage providers see SHA-256 blobs and sizes, not file names, snapshots, or plaintext. Recovery keys stay
            on the operator’s device.
          </p>
        </article>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Replica, then shard</h2>
          <p style={{ color: "var(--muted)" }}>
            Full-replica loss is the first proof. Sharding and erasure coding wait until full replication works and
            users reject the storage cost.
          </p>
        </article>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Local Borg still wins</h2>
          <p style={{ color: "var(--muted)" }}>
            This hosted drill proves the replica/CAS contract. The repository still uses Borg for chunking, encryption,
            and `borg check --verify-data`.
          </p>
        </article>
      </div>

      <RestoreDrill />

      <p style={{ marginTop: 24, color: "var(--muted)" }}>
        Sign in with ConsentKeys to open the operator dashboard. The public restore drill does not require an account.
      </p>

      <footer className="footer">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/llms.txt">llms.txt</Link>
      </footer>
    </main>
  );
}
