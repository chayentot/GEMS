"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

export default function GemsTycoon3Page() {
  return (
    <main className="shell tycoon3-shell">
      <header className="topbar tycoon3-topbar">
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

      <div className="tycoon3-map-space">
        <section className="tycoon3-map-section" aria-label="3rd Map section" />
      </div>

      <footer className="tycoon-map-footer" aria-label="Tycoon map navigation">
        <Link href="/tycoon/" className="tycoon-map-tab">1st Map</Link>
        <Link href="/tycoon2/" className="tycoon-map-tab">2nd Map</Link>
        <Link href="/tycoon3/" className="tycoon-map-tab active" aria-current="page">3rd Map</Link>
      </footer>

      <style jsx>{`
        .tycoon3-shell {
          width: min(1180px, calc(100% - 40px));
          height: 100vh;
          height: 100dvh;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 104px 0 100px;
          overflow: hidden;
        }
        .tycoon3-topbar {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          width: min(1180px, calc(100% - 40px));
          margin: 0;
        }
        .tycoon3-map-space {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          justify-content: center;
          align-items: stretch;
        }
        .tycoon3-map-section {
          width: 100%;
          min-height: 0;
          flex: 1 1 auto;
          border: 1px solid #334155;
          border-radius: 14px;
          background: rgba(17, 28, 46, 0.45);
        }
        .tycoon-map-footer {
          position: fixed;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          z-index: 100;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          width: min(1180px, calc(100% - 40px));
          margin: 0;
          padding: 8px;
          border: 1px solid #334155;
          border-radius: 14px;
          background: #111c2e;
          box-shadow: 0 8px 24px #0006;
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
        @media (max-width: 760px) {
          .tycoon3-shell {
            width: calc(100% - 20px);
            padding-top: 174px;
            padding-bottom: 96px;
          }
          .tycoon3-topbar {
            top: 8px;
            width: calc(100% - 20px);
          }
          .tycoon3-map-section { width: 100%; }
          .tycoon-map-footer {
            bottom: 8px;
            width: calc(100% - 20px);
            gap: 5px;
            padding: 6px;
          }
          .tycoon-map-tab { min-height: 42px; font-size: 12px; }
        }
        @media (max-width: 420px) {
          .tycoon3-shell {
            width: calc(100% - 16px);
            padding-top: 170px;
          }
          .tycoon3-topbar { width: calc(100% - 16px); }
          .tycoon-map-footer { width: calc(100% - 16px); }
        }
      `}</style>
    </main>
  );
}
