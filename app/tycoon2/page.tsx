"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

const COLUMNS = 15;
const ROWS = 51;

export default function GemsTycoonCopyPage() {
  return (
    <main style={{ width: "90vw", maxWidth: "none", margin: "0 auto", padding: "18px 0 40px" }}>
      <header className="topbar">
        <Link href="/" className="brand">💎 GEMS MINING</Link>
        <nav className="row">
          <Link href="/dashboard/">Dashboard</Link>
          <Link href="/mining/">Mining</Link>
          <Link href="/tycoon/">Gems Tycoon</Link>
          <Link href="/tycoon2/" aria-current="page">Gems Tycoon</Link>
          <Link href="/referral/">Referral</Link>
          <Link href="/market/">Market</Link>
          <ProfileMenu />
        </nav>
      </header>

      <section
        aria-label="Gems Tycoon game map, 15 columns by 51 rows"
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
          gap: 0,
          borderTop: "1px solid #52627a",
          borderLeft: "1px solid #52627a",
          background: "#101827",
        }}
      >
        {Array.from({ length: COLUMNS * ROWS }, (_, index) => (
          <div
            key={index}
            data-column={(index % COLUMNS) + 1}
            data-row={Math.floor(index / COLUMNS) + 1}
            style={{
              minWidth: 0,
              aspectRatio: "1 / 1",
              borderRight: "1px solid #52627a",
              borderBottom: "1px solid #52627a",
              background: "#172238",
            }}
          />
        ))}
      </section>
    </main>
  );
}
