"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

const COLUMNS = 15;
const ROWS = 51;

// Yellow 3x3 areas centered on the previously selected coordinates.
const YELLOW_CENTERS: Array<[number, number]> = [
  [8, 3],
  [8, 8],
  [8, 13],
  [4, 21],
  [12, 21],
  [2, 29],
  [6, 29],
  [10, 29],
  [14, 29],
  [2, 34],
  [6, 34],
  [10, 34],
  [14, 34],
  [4, 42],
  [12, 42],
  [8, 50],
];


// Red and green cells are exact column spans on the specified row.
const RED_RANGES: Array<[number, number, number]> = [
  [5, 7, 17],
  [2, 3, 25],
  [10, 11, 25],
  [5, 6, 38],
  [13, 14, 38],
  [9, 11, 46],
];

const GREEN_RANGES: Array<[number, number, number]> = [
  [9, 11, 17],
  [5, 6, 25],
  [13, 14, 25],
  [2, 3, 38],
  [10, 11, 38],
  [5, 7, 46],
];

function isInRanges(column: number, row: number, ranges: Array<[number, number, number]>) {
  return ranges.some(
    ([startColumn, endColumn, targetRow]) =>
      row === targetRow && column >= startColumn && column <= endColumn
  );
}

// Blue cells are exact column/row ranges. Blue takes priority over yellow.
const BLUE_RANGES: Array<[number, number, number]> = [
  [8, 5, 6],
  [8, 10, 11],
  [8, 15, 17],
  [4, 18, 19],
  [12, 18, 19],
  [4, 23, 25],
  [12, 23, 25],
  [2, 26, 27],
  [6, 26, 27],
  [10, 26, 27],
  [14, 26, 27],
  [2, 31, 32],
  [6, 31, 32],
  [10, 31, 32],
  [14, 31, 32],
  [2, 36, 37],
  [6, 36, 37],
  [10, 36, 37],
  [14, 36, 37],
  [4, 38, 40],
  [12, 38, 40],
  [4, 44, 46],
  [12, 44, 46],
  [8, 46, 48],
];

function isYellowCell(column: number, row: number) {
  return YELLOW_CENTERS.some(
    ([centerColumn, centerRow]) =>
      Math.abs(column - centerColumn) <= 1 &&
      Math.abs(row - centerRow) <= 1
  );
}

function isBlueCell(column: number, row: number) {
  return BLUE_RANGES.some(
    ([rangeColumn, startRow, endRow]) =>
      column === rangeColumn && row >= startRow && row <= endRow
  );
}

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
        {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
          const column = (index % COLUMNS) + 1;
          const row = Math.floor(index / COLUMNS) + 1;
          const red = isInRanges(column, row, RED_RANGES);
          const green = isInRanges(column, row, GREEN_RANGES);
          const blue = isBlueCell(column, row);
          const yellow = isYellowCell(column, row);
          const direction = blue ? "down" : red ? "right" : green ? "left" : null;
          const arrow = direction === "down" ? "↓" : direction === "right" ? "→" : direction === "left" ? "←" : "";

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
                background: direction
                  ? direction === "down" ? "#1746A2" : direction === "right" ? "#991B1B" : "#166534"
                  : yellow ? "#FFD700" : "#172238",
              }}
            >
              {direction && <span className="conveyor-arrow" aria-hidden="true">{arrow}</span>}
            </div>
          );
        })}
      </section>

      <style jsx global>{`
        .conveyor-cell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background-size: 100% 20px, auto;
        }
        .conveyor-down {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255,255,255,.22) 0px,
            rgba(255,255,255,.22) 3px,
            transparent 3px,
            transparent 10px
          );
          animation: conveyor-flow-down .55s linear infinite;
        }
        .conveyor-right {
          background-image: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.22) 0px,
            rgba(255,255,255,.22) 3px,
            transparent 3px,
            transparent 10px
          );
          animation: conveyor-flow-right .55s linear infinite;
        }
        .conveyor-left {
          background-image: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.22) 0px,
            rgba(255,255,255,.22) 3px,
            transparent 3px,
            transparent 10px
          );
          animation: conveyor-flow-left .55s linear infinite;
        }
        .conveyor-arrow {
          position: relative;
          z-index: 1;
          color: white;
          font-size: clamp(10px, 1.6vw, 20px);
          line-height: 1;
          font-weight: 900;
          text-shadow: 0 1px 3px rgba(0,0,0,.8);
          animation: conveyor-arrow-pulse .55s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes conveyor-flow-down {
          from { background-position: 0 0; }
          to { background-position: 0 20px; }
        }
        @keyframes conveyor-flow-right {
          from { background-position: 0 0; }
          to { background-position: 20px 0; }
        }
        @keyframes conveyor-flow-left {
          from { background-position: 20px 0; }
          to { background-position: 0 0; }
        }
        @keyframes conveyor-arrow-pulse {
          from { opacity: .65; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .conveyor-cell, .conveyor-arrow { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
