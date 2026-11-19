"use client";

import Link from "next/link";
import ProfileMenu from "@/components/profile-menu";

const COLUMNS = 15;
const ROWS = 51;

// Each coordinate is the center of a 3x3 yellow area.
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

function isYellowCell(column: number, row: number) {
  return YELLOW_CENTERS.some(
    ([centerColumn, centerRow]) =>
      Math.abs(column - centerColumn) <= 1 &&
      Math.abs(row - centerRow) <= 1
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
          const yellow = isYellowCell(column, row);

          return (
            <div
              key={index}
              data-column={column}
              data-row={row}
              style={{
                minWidth: 0,
                aspectRatio: "1 / 1",
                borderRight: "1px solid #52627a",
                borderBottom: "1px solid #52627a",
                background: yellow ? "#FFD700" : "#172238",
              }}
            />
          );
        })}
      </section>
    </main>
  );
}
