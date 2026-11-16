"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Recipe = { id: number; name: string; inputs: [number, number][]; value: number; unlock: number };
type GameState = { gold: number; unlocked: boolean[]; stock: Record<number, number>; sold: number; produced: number; tick: number };

const recipes: Recipe[] = [
  { id: 1, name: "Iron Ore", inputs: [], value: 1, unlock: 0 },
  { id: 2, name: "Iron Bars", inputs: [[1, 2]], value: 2, unlock: 50 },
  { id: 3, name: "Steel", inputs: [[2, 2]], value: 4, unlock: 120 },
  { id: 4, name: "Industrial Gears", inputs: [[3, 2]], value: 6, unlock: 220 },
  { id: 5, name: "Reinforced Frame", inputs: [[1, 1], [4, 1]], value: 8, unlock: 350 },
  { id: 6, name: "Mechanical Assembly", inputs: [[2, 1], [5, 1]], value: 12, unlock: 500 },
  { id: 7, name: "Power Generator", inputs: [[3, 1], [6, 1]], value: 18, unlock: 700 },
  { id: 8, name: "Control System", inputs: [[4, 1], [6, 1]], value: 25, unlock: 950 },
  { id: 9, name: "Heavy Mining Drill", inputs: [[5, 1], [7, 1]], value: 35, unlock: 1250 },
  { id: 10, name: "Ultimate Mining Core", inputs: [[6, 1], [7, 1], [8, 1], [9, 1]], value: 60, unlock: 1600 }
];

const materialIcons = ["🪨", "🧱", "🔩", "⚙️", "🛠️", "🏗️", "⚡", "🖥️", "⛏️", "💎"];

const initial: GameState = {
  gold: 0,
  unlocked: recipes.map((r) => r.id === 1),
  stock: {},
  sold: 0,
  produced: 0,
  tick: 0
};

function routeMaterial(state: GameState, materialId: number, amount: number, producerId: number): GameState {
  let next = { ...state, stock: { ...state.stock } };
  const consumers = recipes.filter((r) => r.id > producerId && next.unlocked[r.id - 1] && r.inputs.some(([id]) => id === materialId));
  const target = consumers.find((r) => {
    const stored = r.inputs.reduce((sum, [id]) => sum + (next.stock[r.id * 100 + id] || 0), 0);
    return stored + amount <= 100;
  });
  if (target) {
    const key = target.id * 100 + materialId;
    next.stock[key] = (next.stock[key] || 0) + amount;
  } else {
    next.gold += amount * recipes[materialId - 1].value;
    next.sold += amount;
  }
  return next;
}

function advance(current: GameState): GameState {
  let next = { ...current, unlocked: [...current.unlocked], stock: { ...current.stock }, tick: current.tick + 1 };
  // The starter mine continuously produces Iron Ore.
  next = routeMaterial(next, 1, 5, 1);
  next.produced += 5;

  // Every unlocked factory automatically processes a batch as soon as all ingredients arrive.
  for (const factory of recipes.slice(1)) {
    if (!next.unlocked[factory.id - 1]) continue;
    const canProcess = factory.inputs.every(([materialId, quantity]) =>
      (next.stock[factory.id * 100 + materialId] || 0) >= quantity
    );
    if (!canProcess) continue;
    for (const [materialId, quantity] of factory.inputs) {
      const key = factory.id * 100 + materialId;
      next.stock[key] = (next.stock[key] || 0) - quantity;
    }
    next.produced += 1;
    next = routeMaterial(next, factory.id, 1, factory.id);
  }
  return next;
}

export default function MiningEmpirePage() {
  const [game, setGame] = useState<GameState>(initial);
  const [authReady, setAuthReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [message, setMessage] = useState("Your starter mine is running. Iron Ore is sold until its next factory is unlocked.");

  useEffect(() => {
    const sb = createClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = "/GEMS/login/"; return; }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!running || !authReady) return;
    const timer = window.setInterval(() => setGame((current) => advance(current)), 1800);
    return () => window.clearInterval(timer);
  }, [running, authReady]);

  const factoryCount = game.unlocked.filter(Boolean).length;
  const stockTotal = useMemo(() => Object.values(game.stock).reduce((sum, n) => sum + n, 0), [game.stock]);

  function unlock(factory: Recipe) {
    if (game.unlocked[factory.id - 1]) return;
    if (game.gold < factory.unlock) { setMessage(`You need ${factory.unlock.toLocaleString()} Gold to unlock ${factory.name}.`); return; }
    setGame((current) => {
      const unlocked = [...current.unlocked];
      unlocked[factory.id - 1] = true;
      return { ...current, gold: current.gold - factory.unlock, unlocked };
    });
    setMessage(`${factory.name} unlocked. Its conveyor input will now be accepted and processed automatically.`);
  }

  return (
    <main className="shell empire-shell">
      <header className="topbar">
        <Link href="/dashboard/" className="brand">💎 GEMS MINING</Link>
        <nav className="row">
          <Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link>
          <Link href="/empire/" aria-current="page">Mining Empire</Link><Link href="/market/">Market</Link>
        </nav>
      </header>
      <div className="mining-tabs" role="tablist" aria-label="Mining modes">
        <Link href="/mining/" className="mining-tab" role="tab" aria-selected="false">💎 Gemstone Mining</Link>
        <Link href="/empire/" className="mining-tab active" role="tab" aria-selected="true">🏭 Mining Empire</Link>
      </div>

      <section className="empire-hero panel">
        <div className="row">
          <div><p className="empire-kicker">IDLE FACTORY TYCOON</p><h1>GEMS: <span>Mining Empire</span></h1>
            <p className="muted">Build your industrial chain. Factories process materials automatically while your conveyor keeps moving.</p>
          </div>
          <div className="empire-demo-tag">GAMEPLAY PREVIEW</div>
        </div>
        <div className="empire-stats">
          <div><small>Gold</small><strong>🪙 {game.gold.toLocaleString()}</strong></div>
          <div><small>Factories</small><strong>{factoryCount} / 10</strong></div>
          <div><small>Stored inputs</small><strong>{stockTotal} / {factoryCount * 100}</strong></div>
          <div><small>Materials sold</small><strong>{game.sold.toLocaleString()}</strong></div>
        </div>
        <div className="row empire-controls">
          <span className="small">Simulation speed: 1 production check every 1.8 seconds</span>
          <div className="row">
            <button className="secondary" onClick={() => setRunning((v) => !v)}>{running ? "Ⅱ Pause" : "▶ Resume"}</button>
            <button className="secondary" onClick={() => { setGame(initial); setRunning(true); setMessage("Preview reset. The starter mine is running again."); }}>↻ Reset preview</button>
          </div>
        </div>
        <div className="notice empire-message">{message}</div>
      </section>

      <section className="section">
        <div className="row empire-section-heading"><div><h2>Conveyor & factory line</h2><p className="small">Locked factories are bypassed. Full factories pass excess material forward. Anything with no available unlocked destination is sold for Gold.</p></div></div>
        <div className="empire-world-wrap">
          <div className="empire-world-caption"><span>VERTICAL MINING WORLD</span><span className="live-indicator"><i /> FACTORY LINE RUNNING</span></div>
          <div className="empire-world-scroll">
            <div className="empire-world">
              {recipes.map((factory, index) => {
                const unlocked = game.unlocked[index];
                // Locked stations bypass material and never emit their own product.
                let flowingMaterialIndex = 0;
                for (let i = 0; i <= index; i++) {
                  if (game.unlocked[i]) flowingMaterialIndex = i;
                }
                const flowingMaterial = materialIcons[flowingMaterialIndex];
                return (
                  <div className={`empire-world-unit ${index % 2 === 0 ? "unit-left" : "unit-right"}`} key={factory.id}>
                    <div className={`empire-world-station ${unlocked ? "station-open" : "station-locked"}`}>
                      <div className="world-station-label">FACTORY {String(factory.id).padStart(2, "0")}</div>
                      <div className="world-machine">
                        <span className="world-machine-icon">{factory.id === 1 ? "⛏️" : factory.id === 10 ? "💎" : "🏭"}</span>
                        {unlocked && <span className="world-gear">⚙</span>}
                        {!unlocked && <span className="world-lock">🔒</span>}
                        {unlocked && <span className="world-smoke smoke-one" />}
                        {unlocked && <span className="world-smoke smoke-two" />}
                      </div>
                      <strong>{factory.name}</strong>
                      <small>{unlocked ? (factory.id === 1 ? "Mining" : "Auto processing") : "Material bypasses this station"}</small>
                      {!unlocked && <button className="world-unlock-button" disabled={game.gold < factory.unlock} onClick={() => unlock(factory)}>Unlock · 🪙 {factory.unlock.toLocaleString()}</button>}
                    </div>
                    {index < recipes.length - 1 && (
                      <div className={`world-belt ${unlocked ? "belt-active" : "belt-bypass"}`} aria-hidden="true">
                        <div className="world-belt-surface"><i /><i /><i /><i /><i /><i /></div>
                        <span className="world-material material-a" role="img" aria-label={`${recipes[flowingMaterialIndex].name} moving on conveyor`}>{flowingMaterial}</span>
                        <span className="world-material material-b" role="img" aria-label={`${recipes[flowingMaterialIndex].name} moving on conveyor`}>{flowingMaterial}</span>
                        <span className="world-material material-c" role="img" aria-label={`${recipes[flowingMaterialIndex].name} moving on conveyor`}>{flowingMaterial}</span>
                        <span className="world-belt-arrow">▼</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="empire-world-unit world-sell-unit">
                <div className="world-sell-machine">
                  <span>🪙</span><strong>GOLD SELLER</strong><small>Sell overflow</small>
                  <i className="gold-spark spark-a">✦</i><i className="gold-spark spark-b">✦</i>
                </div>
              </div>
            </div>
          </div>
          <p className="world-scroll-hint">Follow the production line from the mine at the top down to the Gold seller.</p>
        </div>
      </section>

    </main>
  );
}
