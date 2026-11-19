"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

const MAP_ROWS = 24;
const FIRST_SECTION_COLUMNS = 15;
const SECOND_SECTION_COLUMNS = 15;
const THIRD_SECTION_COLUMNS = 20;
const FOURTH_SECTION_COLUMNS = 20;
const TOTAL_COLUMNS = FIRST_SECTION_COLUMNS + SECOND_SECTION_COLUMNS + THIRD_SECTION_COLUMNS + FOURTH_SECTION_COLUMNS;

const STRUCTURES = [
  { name: "FACTORY 1", centerColumn: 19, centerRow: 12, className: "tycoon3-factory" },
  { name: "BANK", centerColumn: 27, centerRow: 13, className: "tycoon3-bank" },
];

const CONVEYOR_CELLS = new Set([
  "29,13", "30,13",
  "23,13", "24,13", "25,13",
  "21,12", "22,12", "23,12",
]);

function getStructureAt(column: number, row: number) {
  return STRUCTURES.find((structure) =>
    Math.abs(column - structure.centerColumn) <= 1 &&
    Math.abs(row - structure.centerRow) <= 1
  );
}

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
        <section className="tycoon3-map-section" aria-label="3rd Map grid">
          <div className="tycoon3-grid">
            {Array.from({ length: TOTAL_COLUMNS * MAP_ROWS }, (_, index) => {
              const column = Math.floor(index / MAP_ROWS) + 1;
              const row = (index % MAP_ROWS) + 1;
              const isYellowDivider = column === FIRST_SECTION_COLUMNS;
              const isRedDivider =
                column === FIRST_SECTION_COLUMNS + SECOND_SECTION_COLUMNS;
              const isGreenDivider =
                column === FIRST_SECTION_COLUMNS + SECOND_SECTION_COLUMNS + THIRD_SECTION_COLUMNS;
              const structure = getStructureAt(column, row);
              const isStructureCenter = structure?.centerColumn === column && structure?.centerRow === row;
              const isConveyor = CONVEYOR_CELLS.has(`${column},${row}`);

              const cellClassName = [
                "tycoon3-cell",
                isYellowDivider && "tycoon3-divider-yellow",
                isRedDivider && "tycoon3-divider-red",
                isGreenDivider && "tycoon3-divider-green",
                structure?.className,
                isConveyor && "tycoon3-conveyor",
              ].filter(Boolean).join(" ");

              return (
                <div
                  className={cellClassName}
                  key={index}
                  aria-label={`Column ${column}, Row ${row}${structure ? `, ${structure.name}` : isConveyor ? ", conveyor moving right" : ""}`}
                >
                  {isStructureCenter && <span className="tycoon3-structure-label">{structure.name}</span>}
                  {isConveyor && <span className="tycoon3-conveyor-arrow">→</span>}
                </div>
              );
            })}
          </div>
        </section>
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
          align-items: stretch;
        }
        .tycoon3-map-section {
          width: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
          overflow-x: auto;
          overflow-y: hidden;
          border: 1px solid #334155;
          border-radius: 14px;
          background: rgba(17, 28, 46, 0.45);
          scrollbar-color: #64748b #111c2e;
          scrollbar-width: thin;
        }
        .tycoon3-grid {
          display: grid;
          width: max-content;
          height: 100%;
          grid-auto-flow: column;
          grid-template-rows: repeat(24, minmax(0, 1fr));
          grid-auto-columns: calc((100dvh - 206px) / 24);
        }
        .tycoon3-cell {
          min-width: 0;
          min-height: 0;
          border-right: 1px solid #64748b88;
          border-bottom: 1px solid #64748b88;
          background: #15223855;
          user-select: none;
        }
        .tycoon3-cell:nth-child(24n + 1) {
          border-top: 1px solid #64748b88;
        }
        .tycoon3-divider-yellow {
          border-right: 4px solid #facc15;
        }
        .tycoon3-divider-red {
          border-right: 4px solid #ef4444;
        }
        .tycoon3-divider-green {
          border-right: 4px solid #22c55e;
        }
        .tycoon3-factory {
          background: linear-gradient(145deg, #92400e, #f59e0b 52%, #78350f);
          border: 1px solid #fbbf24;
          box-shadow: inset 0 0 0 1px #fff3, inset 0 0 10px #0008;
          position: relative;
          z-index: 1;
        }
        .tycoon3-bank {
          background: linear-gradient(145deg, #334155, #94a3b8 52%, #1e293b);
          border: 1px solid #cbd5e1;
          box-shadow: inset 0 0 0 1px #fff5, inset 0 0 10px #0008;
          position: relative;
          z-index: 1;
        }
        .tycoon3-structure-label {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: clamp(7px, 0.75vw, 11px);
          font-weight: 900;
          text-align: center;
          text-shadow: 0 1px 3px #000;
          pointer-events: none;
        }
        .tycoon3-conveyor {
          background-color: #334155;
          background-image: repeating-linear-gradient(
            90deg,
            #475569 0,
            #64748b 5px,
            #334155 10px,
            #475569 15px
          );
          background-size: 30px 100%;
          animation: tycoon3-belt-move 0.65s linear infinite;
          box-shadow: inset 0 1px 2px #fff5, inset 0 -2px 3px #0009;
          position: relative;
          overflow: hidden;
        }
        @keyframes tycoon3-belt-move {
          from { background-position: 0 0; }
          to { background-position: 30px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tycoon3-conveyor { animation: none; }
        }
        .tycoon3-conveyor-arrow {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: #f8fafc;
          font-size: clamp(10px, 1.1vw, 16px);
          font-weight: 900;
          text-shadow: 0 1px 3px #000;
          pointer-events: none;
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
        .tycoon-map-tab:hover { background: #334155; color: #fff; }
        .tycoon-map-tab.active { color: #172238; background: #facc15; }
        @media (max-width: 760px) {
          .tycoon3-shell {
            width: calc(100% - 20px);
            padding-top: 174px;
            padding-bottom: 96px;
          }
          .tycoon3-topbar { top: 8px; width: calc(100% - 20px); }
          .tycoon3-grid { grid-auto-columns: calc((100dvh - 272px) / 24); }
          .tycoon-map-footer {
            bottom: 8px;
            width: calc(100% - 20px);
            gap: 5px;
            padding: 6px;
          }
          .tycoon-map-tab { min-height: 42px; font-size: 12px; }
        }
        @media (max-width: 420px) {
          .tycoon3-shell { width: calc(100% - 16px); padding-top: 170px; }
          .tycoon3-topbar, .tycoon-map-footer { width: calc(100% - 16px); }
          .tycoon3-grid { grid-auto-columns: calc((100dvh - 268px) / 24); }
        }
      `}</style>
    </main>
  );
}
