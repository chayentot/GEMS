"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";
import { useEffect, useRef, useState } from "react";

const MAP_ROWS = 24;
const FIRST_SECTION_COLUMNS = 15;
const SECOND_SECTION_COLUMNS = 15;
const THIRD_SECTION_COLUMNS = 20;
const FOURTH_SECTION_COLUMNS = 20;
const TOTAL_COLUMNS = FIRST_SECTION_COLUMNS + SECOND_SECTION_COLUMNS + THIRD_SECTION_COLUMNS + FOURTH_SECTION_COLUMNS;

const STRUCTURES = [
  { name: "FACTORY 1", centerColumn: 19, centerRow: 12, className: "tycoon3-factory" },
  { name: "BANK", centerColumn: 27, centerRow: 13, className: "tycoon3-bank" },
  { name: "FACTORY 2", centerColumn: 38, centerRow: 5, className: "tycoon3-factory" },
  { name: "FACTORY 3", centerColumn: 38, centerRow: 10, className: "tycoon3-factory" },
  { name: "FACTORY 4", centerColumn: 38, centerRow: 15, className: "tycoon3-factory" },
  { name: "FACTORY 5", centerColumn: 38, centerRow: 20, className: "tycoon3-factory" },
  { name: "FACTORY 6", centerColumn: 58, centerRow: 5, className: "tycoon3-factory" },
  { name: "FACTORY 7", centerColumn: 58, centerRow: 10, className: "tycoon3-factory" },
  { name: "FACTORY 8", centerColumn: 58, centerRow: 15, className: "tycoon3-factory" },
  { name: "FACTORY 9", centerColumn: 58, centerRow: 20, className: "tycoon3-factory" },
  { name: "BANK 2", centerColumn: 47, centerRow: 13, className: "tycoon3-bank" },
  { name: "BANK 3", centerColumn: 67, centerRow: 13, className: "tycoon3-bank" },
];

const STAR_CRYSTAL_PATH = [
  { column: 21, row: 12 },
  { column: 22, row: 12 },
  { column: 23, row: 12 },
  { column: 23, row: 13 },
  { column: 24, row: 13 },
  { column: 25, row: 13 },
];

const CONVEYOR_CELLS = new Set([
  "29,13", "30,13",
  "23,13", "24,13", "25,13",
  "21,12", "22,12", "23,12",
  "31,13", "32,13",
  "34,5", "35,5", "36,5",
  "34,10", "35,10", "36,10",
  "34,15", "35,15", "36,15",
  "34,20", "35,20", "36,20",
  "40,5", "41,5", "42,5",
  "40,10", "41,10", "42,10",
  "40,15", "41,15", "42,15",
  "40,20", "41,20", "42,20",
  "44,13", "45,13",
  "49,13", "50,13",
]);

const LEFT_TO_RIGHT_CONVEYOR_CELLS = new Set([
  "31,13", "32,13",
  "34,5", "35,5", "36,5",
  "34,10", "35,10", "36,10",
  "34,15", "35,15", "36,15",
  "34,20", "35,20", "36,20",
  "40,5", "41,5", "42,5",
  "40,10", "41,10", "42,10",
  "40,15", "41,15", "42,15",
  "40,20", "41,20", "42,20",
  "44,13", "45,13",
  "49,13", "50,13",
]);

function getStructureAt(column: number, row: number) {
  return STRUCTURES.find((structure) =>
    Math.abs(column - structure.centerColumn) <= 1 &&
    Math.abs(row - structure.centerRow) <= 1
  );
}

export default function GemsTycoon3Page() {
  const [isFactoryRunning, setIsFactoryRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [starCrystals, setStarCrystals] = useState<{ id: number; step: number }[]>([]);
  const [bankedStarCrystals, setBankedStarCrystals] = useState(0);
  const nextCrystalId = useRef(0);

  useEffect(() => {
    if (!isFactoryRunning) return;
    const timer = window.setInterval(() => {
      setStarCrystals((current) => [
        ...current,
        { id: ++nextCrystalId.current, step: 0 },
      ]);
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isFactoryRunning]);

  useEffect(() => {
    if (remainingSeconds === 0) setIsFactoryRunning(false);
  }, [remainingSeconds]);

  const hasCrystalsOnConveyor = starCrystals.length > 0;

  useEffect(() => {
    if (!hasCrystalsOnConveyor) return;
    const conveyor = window.setInterval(() => {
      setStarCrystals((current) =>
        current.map((crystal) => ({ ...crystal, step: crystal.step + 1 }))
      );
    }, 300);
    return () => window.clearInterval(conveyor);
  }, [hasCrystalsOnConveyor]);

  useEffect(() => {
    const delivered = starCrystals.filter((crystal) => crystal.step >= STAR_CRYSTAL_PATH.length);
    if (delivered.length === 0) return;
    setBankedStarCrystals((count) => count + delivered.length);
    setStarCrystals((current) =>
      current.filter((crystal) => crystal.step < STAR_CRYSTAL_PATH.length)
    );
  }, [starCrystals]);

  const startFactory = () => {
    if (remainingSeconds === 0) setRemainingSeconds(60);
    setIsFactoryRunning(true);
  };

  const formattedTime = `00:${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

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
              const conveyorKey = `${column},${row}`;
              const isConveyor = CONVEYOR_CELLS.has(conveyorKey);
              const isLeftMovingConveyor = LEFT_TO_RIGHT_CONVEYOR_CELLS.has(conveyorKey);

              const cellClassName = [
                "tycoon3-cell",
                isYellowDivider && "tycoon3-divider-yellow",
                isRedDivider && "tycoon3-divider-red",
                isGreenDivider && "tycoon3-divider-green",
                structure?.className,
                isConveyor && "tycoon3-conveyor",
                isLeftMovingConveyor && "tycoon3-conveyor-left",
              ].filter(Boolean).join(" ");

              return (
                <div
                  className={cellClassName}
                  key={index}
                  style={{ gridColumn: column, gridRow: row }}
                  aria-label={`Column ${column}, Row ${row}${structure ? `, ${structure.name}` : isConveyor ? ", conveyor moving right" : ""}`}
                >
                  {isStructureCenter && (
                    <span className="tycoon3-structure-label">
                      {structure.name}
                      {structure.name === "BANK" && <small className="tycoon3-bank-count">✦ {bankedStarCrystals} STORED</small>}
                    </span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="tycoon3-play-button"
              style={{ gridColumn: 19, gridRow: 10 }}
              onClick={startFactory}
              disabled={isFactoryRunning}
              aria-label="Start Factory 1 for 60 seconds"
              hidden={isFactoryRunning}
            >
              PLAY
            </button>
            <div className="tycoon3-level-label" style={{ gridColumn: "16 / span 2", gridRow: 12 }}>
              LVL 1
            </div>
            <div className="tycoon3-time-display" style={{ gridColumn: "18 / span 3", gridRow: 14 }}>
              {formattedTime}
            </div>
            {starCrystals.map((crystal) => {
              const position = STAR_CRYSTAL_PATH[Math.min(crystal.step, STAR_CRYSTAL_PATH.length - 1)];
              return (
                <div
                  key={crystal.id}
                  className="tycoon3-star-crystal"
                  style={{ gridColumn: position.column, gridRow: position.row }}
                  aria-label="Star Crystal moving to Bank"
                >
                  ✦
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
        .tycoon3-bank-count {
          display: block;
          margin-top: 3px;
          color: #bae6fd;
          font-size: clamp(7px, 0.68vw, 10px);
          line-height: 1.1;
          font-weight: 900;
          white-space: nowrap;
          text-shadow: 0 0 4px #0284c7, 0 1px 2px #000;
        }
        .tycoon3-play-button {
          box-sizing: border-box;
          width: calc(100% - 6px);
          height: calc(100% - 6px);
          min-width: 0;
          min-height: 0;
          max-width: 100%;
          max-height: 100%;
          align-self: stretch;
          justify-self: stretch;
          padding: 0;
          margin: 3px;
          border: 2px solid #86efac;
          border-radius: 6px;
          color: #052e16;
          background: linear-gradient(145deg, #bbf7d0, #22c55e);
          box-shadow: 0 2px 6px #0008, inset 0 1px 2px #fff9;
          font-size: clamp(7px, 0.75vw, 11px);
          font-weight: 900;
          cursor: pointer;
        }
        .tycoon3-play-button:hover { filter: brightness(1.12); }
        .tycoon3-play-button:disabled { opacity: .55; cursor: default; }
        .tycoon3-level-label,
        .tycoon3-time-display {
          z-index: 4;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #facc15;
          border-radius: 5px;
          color: #fff;
          background: #172554;
          box-shadow: 0 2px 6px #0008, inset 0 0 8px #facc1544;
          font-weight: 900;
          text-shadow: 0 1px 3px #000;
          white-space: nowrap;
        }
        .tycoon3-level-label {
          margin: 3px;
          font-size: clamp(7px, 0.75vw, 11px);
        }
        .tycoon3-time-display {
          margin: 2px;
          font-size: clamp(9px, 0.95vw, 14px);
          font-variant-numeric: tabular-nums;
          letter-spacing: .04em;
        }
        .tycoon3-star-crystal {
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #bae6fd;
          font-size: clamp(13px, 1.3vw, 20px);
          font-weight: 900;
          text-shadow: 0 0 5px #38bdf8, 0 0 10px #e0f2fe;
          pointer-events: none;
          animation: tycoon3-crystal-pulse .6s ease-in-out infinite alternate;
        }
        @keyframes tycoon3-crystal-pulse {
          from { transform: scale(.8) rotate(0deg); }
          to { transform: scale(1.15) rotate(45deg); }
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
        .tycoon3-conveyor-left {
          animation-name: tycoon3-belt-move-left;
        }
        @keyframes tycoon3-belt-move-left {
          from { background-position: 30px 0; }
          to { background-position: 0 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tycoon3-conveyor { animation: none; }
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
