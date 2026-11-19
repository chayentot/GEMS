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
    const timer = window.setInterval(() => {
      setProduction((previous) => {
        // Belts advance one tile per second: row 5 -> row 6 -> Factory 2.
        const factory2Rubellite = previous.factory2Rubellite + previous.rubelliteRow6;
        const factory2CanProcess = factory2Rubellite >= 2;
        const factory2Aquarion = previous.factory2Aquarion;
        const aquarionOnRow10 = factory2CanProcess ? previous.aquarionRow10 + 1 : previous.aquarionRow10;

        // Factory 2 converts 2 Rubellite into 1 Aquarion every second when stocked.
        const aquarionLeavingFactory2 = factory2CanProcess ? 1 : 0;
        const factory2RubelliteAfterProcess = factory2CanProcess ? factory2Rubellite - 2 : factory2Rubellite;

        // Belt advances Aquarion from row 10 -> row 11 -> Factory 3.
        const factory3Aquarion = previous.factory3Aquarion + previous.aquarionRow11;
        const factory3CanProcess = factory3Aquarion >= 2;

        // Factory 3 uses the same 2-to-1 recipe: 2 Aquarion -> 1 Verdium.
        return {
          factory1Rubellite: Math.max(0, previous.factory1Rubellite - (previous.factory1Rubellite > 0 ? 1 : 0)),
          factory2Rubellite: factory2RubelliteAfterProcess,
          factory2Aquarion,
          factory3Aquarion: factory3CanProcess ? factory3Aquarion - 2 : factory3Aquarion,
          factory3Verdium: previous.factory3Verdium + (factory3CanProcess ? 1 : 0),
          rubelliteRow5: previous.factory1Rubellite > 0 ? 1 : 0,
          rubelliteRow6: previous.rubelliteRow5,
          aquarionRow10: aquarionLeavingFactory2,
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
          const tokenCount =
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
              {token && tokenCount > 0 && (
                <span className="moving-gem" aria-label={token.label}>
                  {token.symbol}
                </span>
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
          font-size: clamp(8px, 1.25vw, 16px);
          line-height: 1;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,.7));
          animation: gem-bob .7s ease-in-out infinite alternate;
        }
        @keyframes gem-bob { from { transform: translateY(-2px); } to { transform: translateY(2px); } }
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
          animation: belt-down .48s linear infinite;
        }
        .conveyor-left, .conveyor-right {
          background-image:
            linear-gradient(180deg, #aeb8c4 0 8%, #596575 8% 12%, transparent 12% 88%, #596575 88% 92%, #aeb8c4 92% 100%),
            repeating-linear-gradient(90deg, #aeb8c4 0 2px, #566272 2px 4px, #202a36 4px 7px, #657181 7px 9px);
          background-size: 100% 100%, 18px 100%;
        }
        .conveyor-right { animation: belt-right .48s linear infinite; }
        .conveyor-left { animation: belt-left .48s linear infinite; }
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
