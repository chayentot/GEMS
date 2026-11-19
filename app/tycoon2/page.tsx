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
          // All conveyor lanes share one metallic belt appearance; only travel direction differs.
          const direction = blue ? "down" : red ? "left" : green ? "right" : null;

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
              }}
            />
          );
        })}
      </section>

      <style jsx global>{`
        /* Metallic conveyor belts: side rails and moving transverse tread plates. */
        .conveyor-cell {
          position: relative;
          overflow: hidden;
          background-color: #303b49;
          background-repeat: repeat;
          box-shadow: inset 0 0 0 1px rgba(10, 16, 25, .85);
        }
        .conveyor-down {
          background-image:
            linear-gradient(90deg,
              #aeb8c4 0 8%, #596575 8% 12%,
              transparent 12% 88%, #596575 88% 92%, #aeb8c4 92% 100%),
            repeating-linear-gradient(180deg,
              #aeb8c4 0 2px, #566272 2px 4px,
              #202a36 4px 7px, #657181 7px 9px);
          background-size: 100% 100%, 100% 18px;
          animation: belt-down .48s linear infinite;
        }
        .conveyor-left,
        .conveyor-right {
          background-image:
            linear-gradient(180deg,
              #aeb8c4 0 8%, #596575 8% 12%,
              transparent 12% 88%, #596575 88% 92%, #aeb8c4 92% 100%),
            repeating-linear-gradient(90deg,
              #aeb8c4 0 2px, #566272 2px 4px,
              #202a36 4px 7px, #657181 7px 9px);
          background-size: 100% 100%, 18px 100%;
        }
        .conveyor-right { animation: belt-right .48s linear infinite; }
        .conveyor-left { animation: belt-left .48s linear infinite; }
        @keyframes belt-down {
          from { background-position: 0 0, 0 0; }
          to { background-position: 0 0, 0 18px; }
        }
        @keyframes belt-right {
          from { background-position: 0 0, 0 0; }
          to { background-position: 0 0, 18px 0; }
        }
        @keyframes belt-left {
          from { background-position: 0 0, 0 0; }
          to { background-position: 0 0, -18px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .conveyor-cell { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
