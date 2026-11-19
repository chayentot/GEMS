"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

export default function GemsTycoon3Page() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">💎 GEMS MINING</Link>
        <nav className="row">
          <Link href="/dashboard/">Dashboard</Link>
          <Link href="/mining/">Mining</Link>
          <Link href="/tycoon/">Gems Tycoon</Link>
          <Link href="/tycoon2/">Gems Tycoon 2</Link>
          <Link href="/tycoon3/" aria-current="page">Gems Tycoon 3</Link>
          <Link href="/referral/">Referral</Link>
          <Link href="/market/">Market</Link>
          <ProfileMenu />
        </nav>
      </header>
      <div>
        <h1>Gems Tycoon 3</h1>
        <p className="muted">New Gems Tycoon map. This page uses the same page layout and navigation structure as the Referral menu.</p>
      </div>
      <section className="panel section">
        <h2>Gems Tycoon 3 Map</h2>
        <p className="muted">The new map area is ready. We can build its grid, factories, conveyors, and production system here without changing Gems Tycoon 1 or 2.</p>
      </section>
    </main>
  );
}
