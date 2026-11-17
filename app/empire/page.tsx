"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Recipe = { id: number; name: string; inputs: [number, number][]; value: number; unlock: number };
type Shipment = { id: number; materialId: number; amount: number; remainingMs: number; producerId: number; destinationFactoryId: number | null; routeDecided: boolean };
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
  const next = { ...state, shipments: [...state.shipments] };
  // Do not decide the destination when production happens. Materials may wait
  // in the FIFO queue for a while, so choose the first downstream factory only
  // when each unit actually reaches the head and is ready to travel.
  for (let unit = 0; unit < amount; unit += 1) {
    next.shipments.push({
      id: next.nextShipmentId++,
      materialId,
      amount: 1,
      remainingMs: CONVEYOR_MATERIAL_TRAVEL_MS,
      producerId,
      destinationFactoryId: null,
      routeDecided: false
    });
  }
  return next;
}

function advance(current: GameState): GameState {
  let next = { ...current, unlocked: [...current.unlocked], stock: { ...current.stock }, tick: current.tick + 1 };
  // The starter mine continuously produces Iron Ore.
  next = routeMaterial(next, 1, 5, 1);
  next.produced += 5;

  // Each unlocked factory processes available batches at the cycle update.
  // The UI busy flag is only a short processing window, not the full cycle.
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

  // "Busy" means the factory is actively processing, not the whole 1.8s
  // production cycle. Keep the processing state brief, then accept new arrivals.
  useEffect(() => {
    if (!running || !game.busy.some(Boolean)) return;
    const timer = window.setTimeout(() => {
      setGame((current) => ({
        ...current,
        busy: current.busy.map(() => false)
      }));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [game.busy, running]);

  // FIFO conveyor: exactly one material unit travels for 3.2 seconds.
  // The next unit starts only after the active unit reaches its factory or seller.
  useEffect(() => {
    if (!authReady || !running) return;
    const timer = window.setInterval(() => {
      setGame((current) => {
        if (current.shipments.length === 0) return current;
        const [active, ...waiting] = current.shipments;
        if (!active.routeDecided) {
          const target = recipes.find((recipe) => recipe.id > active.producerId && recipe.inputs.some(([id]) => id === active.materialId));
          const stored = target
            ? target.inputs.reduce((sum, [materialId]) => sum + (current.stock[target.id * 100 + materialId] || 0), 0)
            : 0;
          const canDispatchToFactory = Boolean(target && current.unlocked[target.id - 1] && !current.busy[target.id - 1] && stored + 1 <= 100);
          const routed = { ...active, routeDecided: true, destinationFactoryId: canDispatchToFactory && target ? target.id : null };
          return { ...current, shipments: [routed, ...waiting] };
        }
        const remainingMs = active.remainingMs - 100;
        if (remainingMs > 0) {
          return { ...current, shipments: [{ ...active, remainingMs }, ...waiting] };
        }
        const destinationId = active.destinationFactoryId;
        const destination = destinationId ? recipes[destinationId - 1] : null;
        const stored = destination
          ? destination.inputs.reduce((sum, [materialId]) => sum + (current.stock[destination.id * 100 + materialId] || 0), 0)
          : 0;
        const canEnterFactory = Boolean(destination && current.unlocked[destination.id - 1] && !current.busy[destination.id - 1] && stored + 1 <= 100);
        if (destination && canEnterFactory) {
          const key = destination.id * 100 + active.materialId;
          return { ...current, shipments: waiting, stock: { ...current.stock, [key]: (current.stock[key] || 0) + 1 } };
        }
        // Credit the sale at the exact arrival event, not when the shipment is queued.
        const goldEarned = active.amount * recipes[active.materialId - 1].value;
        return { ...current, shipments: waiting, gold: current.gold + goldEarned, sold: current.sold + active.amount };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [authReady, running]);

  const factoryCount = game.unlocked.slice(0, 2).filter(Boolean).length;
  const stockTotal = useMemo(() => Object.values(game.stock).reduce((sum, n) => sum + n, 0), [game.stock]);
  const selectedFactory = selectedFactoryId ? recipes[selectedFactoryId - 1] : null;
  const selectedFactoryStored = selectedFactory ? selectedFactory.inputs.reduce((sum, [materialId]) => sum + (game.stock[selectedFactory.id * 100 + materialId] || 0), 0) : 0;
  const activeShipment = game.shipments[0] ?? null;

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
          <span className="small">Factory cycle: {(FACTORY_CYCLE_MS / 1000).toFixed(1)}s · Belt loop: {(CONVEYOR_BELT_LOOP_MS / 1000).toFixed(2)}s · Single-unit travel: {(CONVEYOR_MATERIAL_TRAVEL_MS / 1000).toFixed(1)}s</span>
          <div className="row">
            <button className="secondary" onClick={() => setRunning((v) => !v)}>{running ? "Ⅱ Pause" : "▶ Resume"}</button>
            <button className="secondary" onClick={() => { setGame(initial); setRunning(true); setMessage("Two-factory test reset. Factory 2 is locked and materials bypass it."); }}>↻ Reset preview</button>
          </div>
        </div>
        <div className="notice empire-message">{message}</div>
      </section>

      <section className="section">
        <div className="row empire-section-heading"><div><h2>Conveyor & factory line</h2><p className="small">An 80 × 80 compact world with a continuous zigzag route. Only the first material moves; the next waits until the active unit reaches its destination.</p></div></div>
        <div className="empire-world-wrap">
          <div className="empire-world-caption"><span>80 × 80 COMPACT MINING WORLD</span><span className="live-indicator"><i /> FACTORY LINE RUNNING</span></div>
          <div className="empire-board" aria-label="80 by 80 Mining Empire game world">
            <div className="empire-board-grid" />
            <div className="empire-board-topline">
              <span><i className="mine-live-dot" /> 80 × 80 COMPACT WORLD</span>
              <span>{game.shipments.length ? `FIFO QUEUE · ${game.shipments.length} MATERIALS` : "CONVEYOR CLEAR"}</span>
            </div>
            <svg className="empire-zigzag-track" viewBox="0 0 800 800" role="img" aria-label="Continuous zigzag conveyor route from mine to gold seller">
              <defs>
                <linearGradient id="beltGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8fa5b8" /><stop offset="50%" stopColor="#42566d" /><stop offset="100%" stopColor="#9db0bd" /></linearGradient>
              </defs>
              <path className="empire-track-shadow" d="M105 665 H690 V500 H110 V335 H690 V170 H400 V95" />
              <path className="empire-track-line" d="M105 665 H690 V500 H110 V335 H690 V170 H400 V95" />
              <path className="empire-track-center" d="M105 665 H690 V500 H110 V335 H690 V170 H400 V95" />
              {activeShipment && activeShipment.routeDecided && running && <circle key={activeShipment.id} className="empire-moving-material" r="17">
                <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto"><mpath href={activeShipment.destinationFactoryId ? "#empire-to-factory" : "#empire-to-seller"} /></animateMotion>
              </circle>}
              <path id="empire-to-seller" d="M105 665 H690 V500 H110 V335 H690 V170 H400 V95" fill="none" />
              <path id="empire-to-factory" d="M105 665 H690 V500" fill="none" />
            </svg>
            <div className="empire-board-label board-label-mine">START · RAW ORE</div>
            <div className="empire-board-node board-node-mine">
              <span className="board-node-icon">⛏️</span><strong>ORE MINE</strong><small>5 ORE / CYCLE</small>
            </div>
            <div className="empire-board-node board-node-smelter">
              <span className="board-node-icon">🏭</span><strong>IRON SMELTER</strong>
              <small>{!game.unlocked[1] ? "LOCKED · SELLER BYPASS" : game.busy[1] ? "BUSY · SELLER BYPASS" : "READY · ACCEPTING"}</small>
              {game.unlocked[1] && <small className="board-node-stock">{game.stock[201] || 0} / 100 ORE</small>}
              {!game.unlocked[1] && <button className="board-unlock" onClick={() => unlock(recipes[1])}>UNLOCK · {recipes[1].unlock} GOLD</button>}
            </div>
            <div className="empire-board-node board-node-seller">
              <span className="board-node-icon">🏪</span><strong>GOLD SELLER</strong><small>ARRIVAL = SOLD</small><b>🪙 {game.gold.toLocaleString()}</b>
            </div>
            <div className="empire-board-label board-label-queue">{activeShipment ? (!activeShipment.routeDecided ? "NEXT UNIT · CHECKING FACTORY" : activeShipment.destinationFactoryId ? "IN TRANSIT → FIRST FACTORY" : "IN TRANSIT → GOLD SELLER") : "ONE AT A TIME · NO OVERTAKING"}</div>
            <div className="empire-board-legend">
              <span><i className="legend-belt" /> Continuous conveyor</span>
              <span><i className="legend-unit" /> Single moving material</span>
              <span><i className="legend-bypass" /> Locked / busy / full → seller</span>
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
