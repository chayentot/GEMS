"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Recipe = { id: number; name: string; inputs: [number, number][]; value: number; unlock: number; icon: string; kind: string };
type Shipment = { id: number; materialId: number; amount: number; remainingMs: number };
type GameState = { gold: number; unlocked: boolean[]; stock: Record<number, number>; sold: number; produced: number; tick: number; shipments: Shipment[]; nextShipmentId: number };

const recipes: Recipe[] = [
  { id: 1, name: "Garnet Mine", inputs: [], value: 1, unlock: 0, icon: "⛏️", kind: "EXTRACTION" },
  { id: 2, name: "Ore Washer", inputs: [[1, 2]], value: 2, unlock: 50, icon: "💧", kind: "WASHING" },
  { id: 3, name: "Crystal Sorter", inputs: [[2, 2]], value: 4, unlock: 120, icon: "🔮", kind: "SORTING" },
  { id: 4, name: "Gem Cutter", inputs: [[3, 2]], value: 6, unlock: 220, icon: "💎", kind: "CUTTING" },
  { id: 5, name: "Polishing Mill", inputs: [[1, 1], [4, 1]], value: 8, unlock: 350, icon: "⚙️", kind: "POLISHING" },
  { id: 6, name: "Crystal Press", inputs: [[2, 1], [5, 1]], value: 12, unlock: 500, icon: "🏗️", kind: "PROCESSING" },
  { id: 7, name: "Gem Lab", inputs: [[3, 1], [6, 1]], value: 18, unlock: 700, icon: "🧪", kind: "REFINING" },
  { id: 8, name: "Vault Workshop", inputs: [[4, 1], [6, 1]], value: 25, unlock: 950, icon: "🏦", kind: "STORAGE" },
  { id: 9, name: "Deep Core Drill", inputs: [[5, 1], [7, 1]], value: 35, unlock: 1250, icon: "🚜", kind: "DEEP MINING" },
  { id: 10, name: "Legendary Crystal Forge", inputs: [[6, 1], [7, 1], [8, 1], [9, 1]], value: 60, unlock: 1600, icon: "✨", kind: "MASTER FORGE" }
];

const cycleMs = 1800;
const travelMs = 3200;
const initial: GameState = { gold: 0, unlocked: recipes.map((r) => r.id === 1), stock: {}, sold: 0, produced: 0, tick: 0, shipments: [], nextShipmentId: 1 };
const fmt = (n: number) => Math.floor(n).toLocaleString();

function routeMaterial(state: GameState, materialId: number, amount: number, producerId: number): GameState {
  const next = { ...state, stock: { ...state.stock }, shipments: [...state.shipments] };
  const consumers = recipes.filter((r) => r.id > producerId && next.unlocked[r.id - 1] && r.inputs.some(([id]) => id === materialId));
  const target = consumers.find((r) => (next.stock[r.id * 100 + materialId] || 0) + amount <= 100);
  if (target) {
    const key = target.id * 100 + materialId;
    next.stock[key] = (next.stock[key] || 0) + amount;
  } else {
    next.shipments.push({ id: next.nextShipmentId++, materialId, amount, remainingMs: travelMs });
  }
  return next;
}

function advance(current: GameState): GameState {
  let next = { ...current, unlocked: [...current.unlocked], stock: { ...current.stock }, tick: current.tick + 1 };
  next = routeMaterial(next, 1, 5, 1);
  next.produced += 5;
  for (const factory of recipes.slice(1)) {
    if (!next.unlocked[factory.id - 1]) continue;
    let batches = 0;
    while (factory.inputs.every(([id, quantity]) => (next.stock[factory.id * 100 + id] || 0) >= quantity)) {
      for (const [id, quantity] of factory.inputs) {
        const key = factory.id * 100 + id;
        next.stock[key] = (next.stock[key] || 0) - quantity;
      }
      batches += 1;
    }
    if (batches) {
      next.produced += batches;
      next = routeMaterial(next, factory.id, batches, factory.id);
    }
  }
  return next;
}

export default function MiningEmpirePage() {
  const [game, setGame] = useState<GameState>(initial);
  const [authReady, setAuthReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [selected, setSelected] = useState(1);
  const [message, setMessage] = useState("Your Garnet Mine is online. Unlock new facilities to expand the production chain.");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const sb = createClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = "/GEMS/login/"; return; }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!running || !authReady) return;
    const timer = window.setInterval(() => setGame((current) => advance(current)), cycleMs);
    return () => window.clearInterval(timer);
  }, [running, authReady]);

  useEffect(() => {
    if (!authReady) return;
    const timer = window.setInterval(() => {
      setNow((n) => n + 100);
      setGame((current) => {
        if (!current.shipments.length) return current;
        const moving = current.shipments.map((s) => ({ ...s, remainingMs: s.remainingMs - 100 }));
        const arrived = moving.filter((s) => s.remainingMs <= 0);
        if (!arrived.length) return { ...current, shipments: moving };
        const gold = arrived.reduce((sum, s) => sum + s.amount * recipes[s.materialId - 1].value, 0);
        const sold = arrived.reduce((sum, s) => sum + s.amount, 0);
        return { ...current, shipments: moving.filter((s) => s.remainingMs > 0), gold: current.gold + gold, sold: current.sold + sold };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [authReady]);

  const unlockedCount = game.unlocked.filter(Boolean).length;
  const stored = useMemo(() => Object.values(game.stock).reduce((sum, n) => sum + n, 0), [game.stock]);
  const activeFactory = recipes[selected - 1];
  const inputRows = activeFactory.inputs.map(([id, quantity]) => ({
    name: recipes[id - 1].name,
    icon: recipes[id - 1].icon,
    amount: game.stock[selected * 100 + id] || 0,
    required: quantity
  }));
  const activeStored = inputRows.reduce((sum, x) => sum + x.amount, 0);
  const isUnlocked = game.unlocked[selected - 1];

  function unlock(factory: Recipe) {
    if (game.unlocked[factory.id - 1]) return;
    if (game.gold < factory.unlock) {
      setMessage("You need " + factory.unlock.toLocaleString() + " Gold to unlock " + factory.name + ".");
      return;
    }
    setGame((current) => {
      const unlocked = [...current.unlocked];
      unlocked[factory.id - 1] = true;
      return { ...current, gold: current.gold - factory.unlock, unlocked };
    });
    setMessage(factory.name + " unlocked. Incoming materials can now be processed here.");
    setSelected(factory.id);
  }

  return (
    <main className="shell empire-shell gem-world-page">
      <header className="topbar">
        <Link href="/dashboard/" className="brand">💎 GEMS MINING</Link>
        <nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Gemstone Mining</Link><Link href="/referral/">Referral</Link><Link href="/market/">Market</Link><ProfileMenu /></nav>
      </header>

      <div className="mining-tabs" role="tablist" aria-label="Mining modes">
        <Link href="/mining/" className="mining-tab" role="tab" aria-selected="false">💎 Gemstone Mining</Link>
        <Link href="/empire/" className="mining-tab active" role="tab" aria-selected="true">🌎 Mining World</Link>
      </div>

      <section className="gem-world-hero">
        <div className="gem-world-title">
          <div><p className="gem-world-eyebrow">YOUR WORLD · YOUR EMPIRE</p><h1>Gemstone <span>Frontier</span></h1><p>Build your mining operation, connect the production line and discover what lies beneath.</p></div>
          <div className="gem-world-live"><i /> {running ? "WORLD ACTIVE" : "WORLD PAUSED"}</div>
        </div>
        <div className="gem-world-stats">
          <div><small>GAME GOLD</small><strong>🪙 {fmt(game.gold)}</strong></div>
          <div><small>FACILITIES</small><strong>{unlockedCount} / 10</strong></div>
          <div><small>IN PRODUCTION</small><strong>{fmt(stored)} <em>units</em></strong></div>
          <div><small>SHIPPED</small><strong>{fmt(game.sold)} <em>units</em></strong></div>
        </div>
      </section>

      <section className="gem-world-layout">
        <div className="gem-world-map-panel">
          <div className="gem-world-map-top"><div><strong>⛏️ MINING TERRITORY</strong><span>Tap a facility to inspect or upgrade it</span></div><div className="gem-world-coords">SECTOR 01 · DEPTH 240M</div></div>
          <div className="gem-world-map">
            <div className="world-terrain terrain-a" /><div className="world-terrain terrain-b" /><div className="world-water" />
            <div className="world-road road-horizontal" /><div className="world-road road-vertical" /><div className="world-rail rail-one" /><div className="world-rail rail-two" />
            <div className="world-decoration deco-crystals">💠 ✦ 💠</div><div className="world-decoration deco-crystals-two">💎 ✧</div><div className="world-decoration deco-plants">🌿 🌱</div><div className="world-decoration deco-rocks">🪨 🪨</div>
            <div className="world-conveyor conveyor-one"><span>🪨</span><span>🪨</span><span>💎</span><b>ORE FLOW →</b></div>
            <div className="world-conveyor conveyor-two"><span>💎</span><span>💠</span><b>GEM FLOW →</b></div>
            {recipes.map((factory, index) => {
              const unlocked = game.unlocked[index];
              const inputTotal = factory.inputs.reduce((sum, [id]) => sum + (game.stock[factory.id * 100 + id] || 0), 0);
              const active = selected === factory.id;
              const positions = ["world-node-1","world-node-2","world-node-3","world-node-4","world-node-5","world-node-6","world-node-7","world-node-8","world-node-9","world-node-10"];
              return <button type="button" key={factory.id} className={"world-facility " + positions[index] + (unlocked ? " is-unlocked" : " is-locked") + (active ? " is-selected" : "")} onClick={() => setSelected(factory.id)}>
                <span className="world-facility-icon">{factory.icon}</span><strong>{factory.name}</strong><small>{unlocked ? (factory.id === 1 ? "EXTRACTING" : "PROCESSING") : "🔒 " + factory.unlock + " GOLD"}</small>
                {unlocked && <span className="world-facility-level">LV. 1</span>}
                {unlocked && <span className="world-facility-fill"><i style={{width: Math.min(100, inputTotal) + "%"}} /></span>}
              </button>;
            })}
            <div className="world-gold-station">🪙<strong>GOLD EXCHANGE</strong><small>Auto-sell overflow</small></div>
            <div className="world-map-label">GARNET RIDGE MINING DISTRICT</div>
          </div>
          <div className="gem-world-map-footer"><span><i className="legend-dot online" /> Operating</span><span><i className="legend-dot locked" /> Locked facility</span><span><i className="legend-dot belt" /> Conveyor route</span><span>🚚 {game.shipments.length} shipments moving</span></div>
        </div>

        <aside className="gem-factory-panel">
          <div className="gem-factory-heading"><div><small>FACILITY CONTROL</small><h2>{activeFactory.icon} {activeFactory.name}</h2></div><span className={isUnlocked ? "factory-state online" : "factory-state locked"}>{isUnlocked ? "● ONLINE" : "🔒 LOCKED"}</span></div>
          <div className="gem-factory-art"><span>{activeFactory.icon}</span><i /><b>{activeFactory.kind}</b></div>
          <div className="gem-factory-level"><span>Factory level</span><strong>LEVEL 1</strong></div>
          <div className="gem-factory-storage">
            <div><span>INPUT STORAGE</span><strong>{activeFactory.inputs.length ? activeStored + " / 100" : "RAW MINE"}</strong></div>
            <div className="factory-storage-bar"><i style={{width: (activeFactory.inputs.length ? Math.min(100, activeStored) : 100) + "%"}} /></div>
            {inputRows.length ? inputRows.map((row) => <div className="factory-input-row" key={row.name}><span>{row.icon} {row.name}</span><strong>{row.amount} <small>/ batch {row.required}</small></strong></div>) : <p className="factory-help">This mine extracts raw Garnet Ore and feeds the conveyor network.</p>}
          </div>
          <div className="gem-factory-recipe"><small>PRODUCTION RECIPE</small><div className="factory-recipe-flow"><span>{activeFactory.inputs.length ? activeFactory.inputs.map(([id]) => recipes[id - 1].icon).join(" + ") : "⛏️"}</span><b>→</b><span>{activeFactory.icon}</span></div><strong>{activeFactory.inputs.length ? activeFactory.inputs.map(([id, qty]) => qty + " × " + recipes[id - 1].name).join(" + ") : "5 raw ore / cycle"}</strong></div>
          {isUnlocked ? <div className="factory-upgrade-box"><div><strong>⚙️ Upgrade facility</strong><small>Higher levels will improve speed and capacity.</small></div><button disabled title="Facility upgrades will be enabled in the persistent gameplay phase">COMING SOON</button></div> : <div className="factory-upgrade-box"><div><strong>Unlock this facility</strong><small>Pay with separate in-game Gold.</small></div><button onClick={() => unlock(activeFactory)} disabled={game.gold < activeFactory.unlock}>🪙 {fmt(activeFactory.unlock)} GOLD</button></div>}
          <div className="factory-panel-note">Preview mode · gameplay progress currently resets when this page is refreshed.</div>
        </aside>
      </section>

      <section className="gem-world-bottom">
        <div className="gem-world-bottom-heading"><div><h2>Production network</h2><p>Materials flow through unlocked facilities. Unused materials travel to the Gold Exchange.</p></div><div className="gem-world-controls"><button className="secondary" onClick={() => setRunning((v) => !v)}>{running ? "Ⅱ Pause world" : "▶ Resume world"}</button><button className="secondary" onClick={() => {setGame(initial);setRunning(true);setSelected(1);setMessage("Mining territory reset. Your Garnet Mine is online.");}}>↻ Reset preview</button></div></div>
        <div className="gem-production-list">{recipes.map((factory) => <button key={factory.id} className={"gem-production-item" + (game.unlocked[factory.id - 1] ? " active" : "")} onClick={() => setSelected(factory.id)}><span>{factory.icon}</span><div><strong>{factory.name}</strong><small>{factory.kind}</small></div><b>{game.unlocked[factory.id - 1] ? "● ACTIVE" : "🔒 LOCKED"}</b></button>)}</div>
      </section>
      <div className="notice empire-message">{message}</div>
      <p className="gem-world-disclaimer">This is a visual gameplay preview. Gold, inventory, unlocks and production are currently simulated in the browser and are not real wallet balances. Persistent player progress and secure offline production require the next Supabase backend phase.</p>
    </main>
  );
}
