"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileMenu from "@/components/profile-menu";

const COLUMNS = 15;
const ROWS = 51;

const YELLOW_CENTERS: Array<[number, number]> = [
  [8, 3], [8, 8], [8, 13], [4, 21], [12, 21],
  [2, 29], [6, 29], [10, 29], [14, 29],
  [2, 34], [6, 34], [10, 34], [14, 34],
  [4, 42], [12, 42], [8, 50],
];

const RED_RANGES: Array<[number, number, number]> = [
  [5, 7, 17], [2, 3, 25], [10, 11, 25],
  [5, 6, 38], [13, 14, 38], [9, 11, 46],
];

const GREEN_RANGES: Array<[number, number, number]> = [
  [9, 11, 17], [5, 6, 25], [13, 14, 25],
  [2, 3, 38], [10, 11, 38], [5, 7, 46],
];

const BLUE_RANGES: Array<[number, number, number]> = [
  [8, 5, 6], [8, 10, 11], [8, 15, 17],
  [4, 18, 19], [12, 18, 19], [4, 23, 25], [12, 23, 25],
  [2, 26, 27], [6, 26, 27], [10, 26, 27], [14, 26, 27],
  [2, 31, 32], [6, 31, 32], [10, 31, 32], [14, 31, 32],
  [2, 36, 37], [6, 36, 37], [10, 36, 37], [14, 36, 37],
  [4, 38, 40], [12, 38, 40], [4, 44, 46], [12, 44, 46],
  [8, 46, 48],
];

function isInRanges(column: number, row: number, ranges: Array<[number, number, number]>) {
  return ranges.some(([startColumn, endColumn, targetRow]) =>
    row === targetRow && column >= startColumn && column <= endColumn
  );
}

function isYellowCell(column: number, row: number) {
  return YELLOW_CENTERS.some(([centerColumn, centerRow]) =>
    Math.abs(column - centerColumn) <= 1 && Math.abs(row - centerRow) <= 1
  );
}

function isBlueCell(column: number, row: number) {
  return BLUE_RANGES.some(([rangeColumn, startRow, endRow]) =>
    column === rangeColumn && row >= startRow && row <= endRow
  );
}

type ProductionState = {
  factory1Rubellite: number;
  factory2Rubellite: number;
  factory2Aquarion: number;
  factory3Aquarion: number;
  factory3Verdium: number;
  rubelliteRow5: number;
  rubelliteRow6: number;
  aquarionRow10: number;
  aquarionRow11: number;
  seconds: number;
};

const INITIAL_STATE: ProductionState = {
  factory1Rubellite: 10000,
  factory2Rubellite: 0,
  factory2Aquarion: 0,
  factory3Aquarion: 0,
  factory3Verdium: 0,
  rubelliteRow5: 0,
  rubelliteRow6: 0,
  aquarionRow10: 0,
  aquarionRow11: 0,
  seconds: 0,
};

export default function GemsTycoonCopyPage() {
  const [production, setProduction] = useState<ProductionState>(INITIAL_STATE);

  useEffect(() => {
    // One crystal at a time per belt. Each tile takes one second to travel.
    const timer = window.setInterval(() => {
      setProduction((previous) => {
        const rubelliteArriving = previous.rubelliteRow6;
        const factory2Stock = previous.factory2Rubellite + rubelliteArriving;
        const rubelliteBeltBusy = previous.rubelliteRow5 > 0 || previous.rubelliteRow6 > 0;
        const launchRubellite = !rubelliteBeltBusy && previous.factory1Rubellite > 0;
        const aquarionArriving = previous.aquarionRow11;
        const factory3Stock = previous.factory3Aquarion + aquarionArriving;
        const aquarionBeltBusy = previous.aquarionRow10 > 0 || previous.aquarionRow11 > 0;
        const launchAquarion = !aquarionBeltBusy && factory2Stock >= 2;
        const factory2StockAfterLaunch = launchAquarion ? factory2Stock - 2 : factory2Stock;
        const makeVerdium = factory3Stock >= 2;
        return {
          factory1Rubellite: previous.factory1Rubellite - (launchRubellite ? 1 : 0),
          factory2Rubellite: factory2StockAfterLaunch,
          factory2Aquarion: previous.factory2Aquarion + (launchAquarion ? 1 : 0),
          factory3Aquarion: makeVerdium ? factory3Stock - 2 : factory3Stock,
          factory3Verdium: previous.factory3Verdium + (makeVerdium ? 1 : 0),
          rubelliteRow5: launchRubellite ? 1 : 0,
          rubelliteRow6: previous.rubelliteRow5,
          aquarionRow10: launchAquarion ? 1 : 0,
          aquarionRow11: previous.aquarionRow10,
          seconds: previous.seconds + 1,
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const factoryLabels: Record<string, string> = {
    "8-3": "F1",
    "8-8": "F2",
    "8-13": "F3",
  };

  const conveyorTokens: Record<string, { symbol: string; label: string }> = {
    "8-5": { symbol: "🔴", label: "Rubellite travelling on row 5" },
    "8-6": { symbol: "🔴", label: "Rubellite travelling on row 6" },
    "8-10": { symbol: "🔵", label: "Aquarion travelling on row 10" },
    "8-11": { symbol: "🔵", label: "Aquarion travelling on row 11" },
  };

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

      <section className="production-panel" aria-label="Live factory production status">
        <div className="factory-status">
          <strong>FACTORY 1 · RUBELLITE</strong>
          <span className="amount">{production.factory1Rubellite.toLocaleString()} / 10,000</span>
          <small>Produces 1 Rubellite per second</small>
        </div>
        <div className="factory-status">
          <strong>FACTORY 2 · AQUARION</strong>
          <span className="amount">{production.factory2Rubellite.toLocaleString()} Rubellite</span>
          <small>{production.factory2Aquarion.toLocaleString()} Aquarion produced · 2 Rubellite → 1 Aquarion</small>
        </div>
        <div className="factory-status">
          <strong>FACTORY 3 · VERDIUM</strong>
          <span className="amount">{production.factory3Verdium.toLocaleString()} Verdium</span>
          <small>{production.factory3Aquarion.toLocaleString()} Aquarion stored · 2 Aquarion → 1 Verdium</small>
        </div>
      </section>

      <div className="elapsed">Production running · {production.seconds.toLocaleString()} seconds elapsed</div>

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
        {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
          const column = (index % COLUMNS) + 1;
          const row = Math.floor(index / COLUMNS) + 1;
          const red = isInRanges(column, row, RED_RANGES);
          const green = isInRanges(column, row, GREEN_RANGES);
          const blue = isBlueCell(column, row);
          const yellow = isYellowCell(column, row);
          const direction = blue ? "down" : red ? "left" : green ? "right" : null;
          const key = `${column}-${row}`;
          const factoryLabel = factoryLabels[key];
          const token = conveyorTokens[key];
          const tokenStage =
            key === "8-5" ? production.rubelliteRow5 :
            key === "8-6" ? production.rubelliteRow6 :
            key === "8-10" ? production.aquarionRow10 :
            key === "8-11" ? production.aquarionRow11 : 0;

          return (
            <div
              key={index}
              data-column={column}
              data-row={row}
              className={direction ? `conveyor-cell conveyor-${direction}` : undefined}
              style={{
                minWidth: 0,
                zIndex: tokenStage === 1 ? 5 : undefined,
                overflow: tokenStage === 1 ? "visible" : undefined,
                aspectRatio: "1 / 1",
                borderRight: "1px solid #52627a",
                borderBottom: "1px solid #52627a",
                background: direction ? undefined : yellow ? "#FFD700" : "#172238",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              title={factoryLabel ? `Factory ${factoryLabel.slice(1)}` : token?.label}
            >
              {factoryLabel && <span className="factory-marker">{factoryLabel}</span>}
              {token && tokenStage > 0 && (
                <span
                  className={`moving-gem ${key === "8-5" || key === "8-6" ? "gem-rubellite" : "gem-aquarion"} ${tokenStage === 1 ? "gem-advance" : "gem-on-tile"}`}
                  aria-label={token.label}
                />
              )}
            </div>
          );
        })}
      </section>

      <style jsx global>{`
        .production-panel {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 10px;
        }
        .factory-status {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 12px;
          border: 1px solid #475569;
          border-radius: 10px;
          background: #172238;
          color: #e5edf7;
        }
        .factory-status strong { font-size: 12px; letter-spacing: .04em; }
        .factory-status .amount { font-size: clamp(15px, 2vw, 22px); font-weight: 800; color: #facc15; }
        .factory-status small { font-size: 11px; color: #b9c5d5; line-height: 1.35; }
        .elapsed { color: #aab8ca; font-size: 12px; margin: 0 0 10px; }
        .factory-marker {
          font-size: clamp(7px, 1vw, 12px);
          font-weight: 900;
          color: #172238;
          text-shadow: 0 1px rgba(255,255,255,.35);
        }
        .moving-gem {
          position: absolute;
          z-index: 2;
          display: block;
          width: 33%;
          height: 33%;
          min-width: 5px;
          min-height: 5px;
          aspect-ratio: 1 / 1;
          clip-path: polygon(50% 0%, 92% 27%, 78% 83%, 50% 100%, 22% 83%, 8% 27%);
          filter: drop-shadow(0 2px 3px rgba(0,0,0,.75));
          animation: none;
        }
        .gem-rubellite {
          background: linear-gradient(135deg, #ffd1d1 0%, #ff5252 32%, #a80018 70%, #61000c 100%);
          box-shadow: inset 0 0 5px rgba(255,255,255,.8);
        }
        .gem-aquarion {
          background: linear-gradient(135deg, #d8fbff 0%, #35d8ff 32%, #0876c9 70%, #06356f 100%);
          box-shadow: inset 0 0 5px rgba(255,255,255,.8);
        }
        .gem-advance { animation: gem-one-tile 1s linear forwards; }
        .gem-on-tile { transform: translateY(0); }
        @keyframes gem-one-tile {
          from { transform: translateY(0); }
          to { transform: translateY(calc(100% + 1px)); }
        }
        .conveyor-cell {
          position: relative;
          overflow: hidden;
          background-color: #303b49;
          background-repeat: repeat;
          box-shadow: inset 0 0 0 1px rgba(10, 16, 25, .85);
        }
        .conveyor-down {
          background-image:
            linear-gradient(90deg, #aeb8c4 0 8%, #596575 8% 12%, transparent 12% 88%, #596575 88% 92%, #aeb8c4 92% 100%),
            repeating-linear-gradient(180deg, #aeb8c4 0 2px, #566272 2px 4px, #202a36 4px 7px, #657181 7px 9px);
          background-size: 100% 100%, 100% 18px;
          animation: belt-down 3.2s linear infinite;
        }
        .conveyor-left, .conveyor-right {
          background-image:
            linear-gradient(180deg, #aeb8c4 0 8%, #596575 8% 12%, transparent 12% 88%, #596575 88% 92%, #aeb8c4 92% 100%),
            repeating-linear-gradient(90deg, #aeb8c4 0 2px, #566272 2px 4px, #202a36 4px 7px, #657181 7px 9px);
          background-size: 100% 100%, 18px 100%;
        }
        .conveyor-right { animation: belt-right 3.2s linear infinite; }
        .conveyor-left { animation: belt-left 3.2s linear infinite; }
        @keyframes belt-down { from { background-position: 0 0, 0 0; } to { background-position: 0 0, 0 18px; } }
        @keyframes belt-right { from { background-position: 0 0, 0 0; } to { background-position: 0 0, 18px 0; } }
        @keyframes belt-left { from { background-position: 0 0, 0 0; } to { background-position: 0 0, -18px 0; } }
        @media (max-width: 700px) {
          .production-panel { grid-template-columns: 1fr; }
          .factory-status { padding: 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .conveyor-cell, .moving-gem { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
