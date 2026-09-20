import Link from "next/link";
import { APP_NAME } from "@/lib/site";

export function SiteHeader({ signedIn }: { signedIn?: boolean }) {
  return (
    <header className="topnav">
      <Link className="brand" href="/">
        <span aria-hidden="true">▣</span>
        {APP_NAME}
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <Link className="btn" href="/#restore-drill">
          Restore drill
        </Link>
        <Link className="btn" href="/dashboard">
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
