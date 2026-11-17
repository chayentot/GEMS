"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Recipe = { id: number; name: string; inputs: [number, number][]; value: number; unlock: number };
type Shipment = { id: number; materialId: number; amount: number; remainingMs: number };
type GameState = { gold: number; unlocked: boolean[]; busy: boolean[]; stock: Record<number, number>; sold: number; produced: number; tick: number; shipments: Shipment[]; nextShipmentId: number };

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

// Factory production checks every 1.8 seconds; factories can process all available batches.
const FACTORY_CYCLE_MS = 1800;
const CONVEYOR_BELT_LOOP_MS = 550;
const CONVEYOR_MATERIAL_TRAVEL_MS = 3200;

const initial: GameState = {
  gold: 0,
  unlocked: recipes.map((r) => r.id === 1),
  busy: recipes.map(() => false),
  stock: {},
  sold: 0,
  produced: 0,
  tick: 0,
  shipments: [],
  nextShipmentId: 1
};

function routeMaterial(state: GameState, materialId: number, amount: number, producerId: number): GameState {
  let next = { ...state, stock: { ...state.stock } };
  // A material may enter only its FIRST downstream factory. If that factory is locked,
  // processing, or full, this batch bypasses the factory line and is sold directly.
  const target = recipes.find((r) => r.id > producerId && r.inputs.some(([id]) => id === materialId));
  const stored = target?.inputs.reduce((sum, [id]) => sum + (next.stock[target.id * 100 + id] || 0), 0) ?? 0;
  const canAccept = Boolean(target && next.unlocked[target.id - 1] && !next.busy[target.id - 1] && stored + amount <= 100);
  if (target && canAccept) {
    const key = target.id * 100 + materialId;
    next.stock[key] = (next.stock[key] || 0) + amount;
  } else {
    // Locked, busy, or full first downstream factory: bypass directly to Gold Seller.
    next.shipments.push({ id: next.nextShipmentId++, materialId, amount, remainingMs: CONVEYOR_MATERIAL_TRAVEL_MS });
  }
  return next;
}

function advance(current: GameState): GameState {
  let next = { ...current, unlocked: [...current.unlocked], stock: { ...current.stock }, tick: current.tick + 1 };
  // The starter mine continuously produces Iron Ore.
  next = routeMaterial(next, 1, 5, 1);
  next.produced += 5;

  // Each unlocked factory processes repeatedly during this cycle until it
  // runs out of any required input. The previous cycle's busy state controls
  // incoming material; newly processed factories become busy for the next cycle.
  const processedThisCycle = new Set<number>();
  for (const factory of recipes.slice(1)) {
    if (!next.unlocked[factory.id - 1]) continue;
    let completedBatches = 0;
    while (factory.inputs.every(([materialId, quantity]) =>
      (next.stock[factory.id * 100 + materialId] || 0) >= quantity
    )) {
      for (const [materialId, quantity] of factory.inputs) {
        const key = factory.id * 100 + materialId;
        next.stock[key] = (next.stock[key] || 0) - quantity;
      }
      completedBatches += 1;
    }
    if (completedBatches === 0) continue;
    processedThisCycle.add(factory.id);
    next.produced += completedBatches;
    next = routeMaterial(next, factory.id, completedBatches, factory.id);
  }
  next.busy = recipes.map((factory) => processedThisCycle.has(factory.id));
  return next;
}

export default function MiningEmpirePage() {
  const [game, setGame] = useState<GameState>(initial);
  const [authReady, setAuthReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
  const [message, setMessage] = useState("Factory 2 is locked. Iron Ore bypasses it and travels directly to the Gold Seller.");

  useEffect(() => {
    const sb = createClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = "/GEMS/login/"; return; }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!running || !authReady) return;
    const timer = window.setInterval(() => setGame((current) => advance(current)), FACTORY_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [running, authReady]);

  // Material only becomes Gold after completing the full 3.2-second conveyor journey.
  useEffect(() => {
    if (!authReady) return;
    const timer = window.setInterval(() => {
      setGame((current) => {
        if (current.shipments.length === 0) return current;
        const shipments = current.shipments.map((shipment) => ({
          ...shipment,
          remainingMs: shipment.remainingMs - 100
        }));
        const arrived = shipments.filter((shipment) => shipment.remainingMs <= 0);
        const travelling = shipments.filter((shipment) => shipment.remainingMs > 0);
        if (arrived.length === 0) return { ...current, shipments: travelling };
        const goldEarned = arrived.reduce((sum, shipment) => sum + shipment.amount * recipes[shipment.materialId - 1].value, 0);
        const soldAmount = arrived.reduce((sum, shipment) => sum + shipment.amount, 0);
        return { ...current, shipments: travelling, gold: current.gold + goldEarned, sold: current.sold + soldAmount };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [authReady]);

  const factoryCount = game.unlocked.slice(0, 2).filter(Boolean).length;
  const stockTotal = useMemo(() => Object.values(game.stock).reduce((sum, n) => sum + n, 0), [game.stock]);
  const selectedFactory = selectedFactoryId ? recipes[selectedFactoryId - 1] : null;
  const selectedFactoryStored = selectedFactory ? selectedFactory.inputs.reduce((sum, [materialId]) => sum + (game.stock[selectedFactory.id * 100 + materialId] || 0), 0) : 0;

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
          <Link href="/referral/">Referral</Link><Link href="/market/">Market</Link><ProfileMenu />
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
          <div><small>Factories</small><strong>{factoryCount} / 2</strong></div>
          <div><small>Stored inputs</small><strong>{stockTotal} / {factoryCount * 100}</strong></div>
          <div><small>Materials sold</small><strong>{game.sold.toLocaleString()}</strong></div>
        </div>
        <div className="row empire-controls">
          <span className="small">Factory cycle: {(FACTORY_CYCLE_MS / 1000).toFixed(1)}s · Belt loop: {(CONVEYOR_BELT_LOOP_MS / 1000).toFixed(2)}s · Factory-to-seller travel: {(CONVEYOR_MATERIAL_TRAVEL_MS / 1000).toFixed(1)}s</span>
          <div className="row">
            <button className="secondary" onClick={() => setRunning((v) => !v)}>{running ? "Ⅱ Pause" : "▶ Resume"}</button>
            <button className="secondary" onClick={() => { setGame(initial); setRunning(true); setMessage("Two-factory test reset. Factory 2 is locked and materials bypass it."); }}>↻ Reset preview</button>
          </div>
        </div>
        <div className="notice empire-message">{message}</div>
      </section>

      <section className="section">
        <div className="row empire-section-heading"><div><h2>Conveyor & factory line</h2><p className="small">Factory 1 produces Iron Ore. The first downstream factory accepts it only when unlocked, ready, and below capacity. Otherwise, the material bypasses directly to the Gold Seller.</p></div></div>
        <div className="empire-world-wrap">
          <div className="empire-world-caption"><span>VERTICAL MINING WORLD</span><span className="live-indicator"><i /> FACTORY LINE RUNNING</span></div>
          <div className="mine-world-scene">
          <div className="mine-world-hud">
            <span><i className="mine-live-dot" /> LIVE PRODUCTION WORLD</span>
            <span>🚚 {game.shipments.length} shipment{game.shipments.length === 1 ? "" : "s"} on the belt</span>
          </div>
          <div className="mine-landscape">
            <div className="mine-sky-glow" />
            <div className="mine-cloud mine-cloud-one" />
            <div className="mine-cloud mine-cloud-two" />
            <div className="mine-mountain mountain-back" />
            <div className="mine-mountain mountain-front" />
            <div className="mine-sun">☀</div>
            <div className="mine-ground">
              <div className="mine-ground-line" />
              <div className="mine-rock rock-one">◆</div><div className="mine-rock rock-two">◆</div>
              <div className="mine-grass grass-one">♣</div><div className="mine-grass grass-two">♣</div>
            </div>
            <div className="mine-production-route">
              {recipes.slice(0, 2).map((factory, index) => {
                const unlocked = game.unlocked[index];
                const factoryStored = factory.inputs.reduce((sum, [materialId]) => sum + (game.stock[factory.id * 100 + materialId] || 0), 0);
                const isFull = factory.inputs.length > 0 && factoryStored >= 100;
                return (
                  <div className={`mine-building-wrap mine-building-${index + 1}`} key={factory.id}>
                    <button type="button" className={`mine-building ${unlocked ? "building-running" : "building-locked"} ${selectedFactoryId === factory.id ? "building-selected" : ""}`} aria-label={`Inspect ${factory.name}`} onClick={() => setSelectedFactoryId(factory.id)}>
                      <span className="mine-building-sign"> {index === 0 ? "ORE MINE" : "SMELTER"} · LV 1</span>
                      <span className="mine-building-art">
                        {index === 0 ? <><span className="mine-mine-shaft">⛏️</span><span className="mine-worker">👷</span><span className="mine-machine-wheel">⚙️</span></> : <><span className="mine-smelter-flame">🔥</span><span className="mine-smelter-stack">🏭</span><span className="mine-smoke-puff" /></>}
                      </span>
                      <strong>{factory.name}</strong>
                      <small>{!unlocked ? "LOCKED · ORE BYPASSES TO GOLD" : index === 0 ? "EXTRACTING IRON ORE" : isFull ? "FULL · ORE BYPASSES TO GOLD" : game.busy[factory.id - 1] ? "PROCESSING · ORE BYPASSES TO GOLD" : "READY · AUTO-SMELTING"}</small>
                      <span className="mine-building-meter"><i style={{ width: unlocked ? "78%" : "0%" }} /></span>
                      <span className="mine-building-stock">{factory.inputs.length === 0 ? "RAW OUTPUT · 5 ORE / CYCLE" : `INPUT · ${factoryStored} / 100 ORE`}</span>
                    </button>
                    {index === 1 && !unlocked && <button className="mine-unlock-flag" onClick={() => unlock(factory)}>UNLOCK · 🪙 {factory.unlock}</button>}
                    {index === 1 && unlocked && <span className="mine-unlock-flag active">● RUNNING</span>}
                    <button className="mine-inspect-hint" onClick={() => setSelectedFactoryId(factory.id)}>↗ Inspect building</button>
                  </div>
                );
              })}
            </div>
            <div className="mine-conveyor-route" aria-label="Animated conveyor belt">
              <div className="mine-belt-rail"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <span className="mine-ore ore-one">🪨</span><span className="mine-ore ore-two">🪨</span><span className="mine-ore ore-three">🧱</span>
              <span className="mine-belt-direction">MATERIAL FLOW →</span>
            </div>
            <div className="mine-seller">
              <div className="mine-seller-awning">GOLD EXCHANGE</div>
              <div className="mine-seller-art">🏪<span>🪙</span></div>
              <strong>GOLD SELLER</strong>
              <small>+ Gold when shipment arrives</small>
              <b>🪙 {game.gold.toLocaleString()}</b>
              <span className="mine-seller-glow" />
            </div>
            <div className="mine-scene-footer"><span>⛏️ Mine</span><span>⚙️ Process</span><span>🪙 Sell</span><span>⏱ {running ? "WORLD RUNNING" : "WORLD PAUSED"}</span></div>
          </div>
        </div>
          {selectedFactory && <div className="panel empire-factory-inspector">
            <div className="row"><div><strong>🏭 Factory {selectedFactory.id}: {selectedFactory.name}</strong><p className="small">Storage inspection · click another factory to view its limits</p></div><button className="secondary" onClick={() => setSelectedFactoryId(null)}>Close</button></div>
            <div className="empire-inspector-grid">
              <div><small>Factory status</small><strong>{!game.unlocked[selectedFactory.id - 1] ? "Locked · incoming material goes to Gold Seller" : game.busy[selectedFactory.id - 1] ? "Processing · incoming material goes to Gold Seller" : "Ready · accepting material"}</strong></div>
              <div><small>Input storage limit</small><strong>{selectedFactory.inputs.length ? "100 units" : "Not applicable · producer"}</strong></div>
              <div><small>Stored inputs</small><strong>{selectedFactory.inputs.length ? `${selectedFactoryStored} / 100 units` : "No input materials"}</strong></div>
            </div>
            {selectedFactory.inputs.length > 0 ? <div className="empire-inspector-inputs">{selectedFactory.inputs.map(([materialId, quantity]) => <div key={materialId}><span>{materialIcons[materialId - 1]} {recipes[materialId - 1].name}</span><strong>{game.stock[selectedFactory.id * 100 + materialId] || 0} units <small>· recipe needs {quantity}</small></strong></div>)}</div> : <p className="small">This factory creates raw Iron Ore and has no incoming material storage.</p>}
          </div>}
          <p className="world-scroll-hint">MATERIAL RULE: First factory accepts only when ready · locked / processing / full = direct Gold Seller bypass · no duplicate processing or sale</p>
        </div>
      </section>

    </main>
  );
}
