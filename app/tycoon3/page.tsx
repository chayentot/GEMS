"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

export default function GemsTycoon3Page() {
  return (
    <main className="shell tycoon3-shell">
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

      <div className="tycoon3-map-space" aria-label="Gems Tycoon 3 map area" />

      <footer className="tycoon-map-footer" aria-label="Tycoon map navigation">
        <Link href="/tycoon/" className="tycoon-map-tab">1st Map</Link>
        <Link href="/tycoon2/" className="tycoon-map-tab">2nd Map</Link>
        <Link href="/tycoon3/" className="tycoon-map-tab active" aria-current="page">3rd Map</Link>
      </footer>

      <style jsx>{`
        .tycoon3-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding-bottom: 24px;
        }
        .tycoon3-map-space {
          flex: 1;
          min-height: 55vh;
        }
        .tycoon-map-footer {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
          margin-top: 16px;
          padding: 8px;
          border: 1px solid #334155;
          border-radius: 14px;
          background: #111c2e;
        }
        .tycoon-map-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 10px 8px;
          border-radius: 9px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          background: #1e293b;
          transition: background .18s ease, color .18s ease;
        }
        .tycoon-map-tab:hover {
          background: #334155;
          color: #fff;
        }
        .tycoon-map-tab.active {
          color: #172238;
          background: #facc15;
        }
        @media (max-width: 480px) {
          .tycoon-map-footer { gap: 5px; padding: 6px; }
          .tycoon-map-tab { min-height: 42px; font-size: 12px; }
        }
      `}</style>
    </main>
  );
}
