"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

const FACTORY_NAMES = [
  "Iron Ore", "Iron Bars", "Steel", "Industrial Gears", "Reinforced Frame",
  "Mechanical Assembly", "Power Generator", "Control System", "Heavy Mining Drill",
  "Ultimate Mining Core"
];
const FACTORY_ICONS = ["⛏️", "🔥", "🔩", "⚙️", "🛠️", "🏗️", "⚡", "🖥️", "🚜", "💎"];
const UNLOCK_COSTS = [0, 50, 120, 220, 350, 500, 700, 950, 1250, 1600];
const CYCLE_MS = 180000;
const TICK_MS = 100;
const TRANSFER_UNIT_MS = 100;

type FactoryTwoPhase = "locked" | "idle" | "transferring" | "running";
type GameState = {
  unlocked: boolean[];
  banks: Record<number, number>;
  mineRunning: boolean;
  mineRemainingMs: number;
  mineAccumulatorMs: number;
  mineOutput: number;
  mineProducedTotal: number;
  oreToBank: number;
  oreBeltAccumulatorMs: number;
  factoryTwoPhase: FactoryTwoPhase;
  factoryTwoRemainingMs: number;
  factoryTwoAccumulatorMs: number;
  factoryTwoInputRemaining: number;
  factoryTwoInputAccumulatorMs: number;
  factoryTwoOutputPending: number;
  factoryTwoOutputAccumulatorMs: number;
  barsProducedTotal: number;
};

const initial: GameState = {
  unlocked: [true, false, false, false, false, false, false, false, false, false],
  banks: {},
  mineRunning: false,
  mineRemainingMs: 0,
  mineAccumulatorMs: 0,
  mineOutput: 0,
  mineProducedTotal: 0,
  oreToBank: 0,
  oreBeltAccumulatorMs: 0,
  factoryTwoPhase: "locked",
  factoryTwoRemainingMs: 0,
  factoryTwoAccumulatorMs: 0,
  factoryTwoInputRemaining: 0,
  factoryTwoInputAccumulatorMs: 0,
  factoryTwoOutputPending: 0,
  factoryTwoOutputAccumulatorMs: 0,
  barsProducedTotal: 0
};

function clock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

export default function MiningEmpirePage() {
  const [game, setGame] = useState<GameState>(initial);
  const [authReady, setAuthReady] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [cloudSaveReady, setCloudSaveReady] = useState(false);
  const [message, setMessage] = useState("Start Factory 1 to produce Iron Ore. Redeem it whenever you want to move it into the Ore Bank.");
  const gameRef = useRef<GameState>(game);
  gameRef.current = game;

  useEffect(() => {
    const sb = createClient();
    let active = true;
    void (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.href = "/GEMS/login/";
        return;
      }
      setPlayerId(user.id);
      const { data, error } = await sb
        .from("mining_empire_saves")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setMessage("Cloud save is not ready yet. Apply migration 012_mining_empire_saves.sql in Supabase to save progress across devices.");
      } else {
        if (data?.state && typeof data.state === "object") {
          const saved = data.state as Partial<GameState>;
          const unlocked = Array.isArray(saved.unlocked) && saved.unlocked.length === 10
            ? saved.unlocked.map((value, index) => index === 0 ? true : Boolean(value))
            : initial.unlocked;
          const restored: GameState = {
            ...initial,
            ...saved,
            unlocked,
            banks: saved.banks && typeof saved.banks === "object" ? saved.banks : {}
          };
          if (restored.unlocked[1] && restored.factoryTwoPhase === "locked") restored.factoryTwoPhase = "idle";
          setGame(restored);
          setMessage("Your Mining Empire progress has been loaded from your account.");
        }
        setCloudSaveReady(true);
      }
      setAuthReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cloudSaveReady || !playerId) return;
    const sb = createClient();
    const save = () => {
      void sb.from("mining_empire_saves").upsert({
        user_id: playerId,
        state: gameRef.current,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) console.error("Mining Empire cloud save failed:", error.message);
      });
    };
    const timer = window.setInterval(save, 5000);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [cloudSaveReady, playerId]);

  useEffect(() => {
    if (!authReady) return;
    const timer = window.setInterval(() => {
      setGame((current) => {
        const next: GameState = { ...current, banks: { ...current.banks } };

        // Factory 1: one Iron Ore is created each second during its 3-minute run.
        if (next.mineRunning) {
          next.mineRemainingMs = Math.max(0, next.mineRemainingMs - TICK_MS);
          next.mineAccumulatorMs += TICK_MS;
          while (next.mineAccumulatorMs >= 1000) {
            next.mineAccumulatorMs -= 1000;
            next.mineOutput += 1;
            next.mineProducedTotal += 1;
            // A cycle creates exactly 180 Ore. The per-cycle count is derived
            // from the remaining timer so a restart always begins a fresh run.
            if (next.mineRemainingMs === 0) break;
          }
          if (next.mineRemainingMs === 0) {
            next.mineRunning = false;
            next.mineAccumulatorMs = 0;
          }
        }

        // The short Factory 1 -> Ore Bank conveyor carries one Ore at a time.
        if (next.oreToBank > 0) {
          next.oreBeltAccumulatorMs += TICK_MS;
          while (next.oreBeltAccumulatorMs >= TRANSFER_UNIT_MS && next.oreToBank > 0) {
            next.oreBeltAccumulatorMs -= TRANSFER_UNIT_MS;
            next.oreToBank -= 1;
            next.banks[1] = (next.banks[1] || 0) + 1;
          }
        } else {
          next.oreBeltAccumulatorMs = 0;
        }

        // Factory 2 first receives all 360 reserved Ore. Its 3-minute timer
        // starts only after the last Ore reaches the factory.
        if (next.factoryTwoPhase === "transferring") {
          next.factoryTwoInputAccumulatorMs += TICK_MS;
          while (next.factoryTwoInputAccumulatorMs >= TRANSFER_UNIT_MS && next.factoryTwoInputRemaining > 0) {
            next.factoryTwoInputAccumulatorMs -= TRANSFER_UNIT_MS;
            next.factoryTwoInputRemaining -= 1;
          }
          if (next.factoryTwoInputRemaining === 0) {
            next.factoryTwoPhase = "running";
            next.factoryTwoRemainingMs = CYCLE_MS;
            next.factoryTwoAccumulatorMs = 0;
            next.factoryTwoInputAccumulatorMs = 0;
          }
        }

        // Factory 2: one Iron Bar per second for 3 minutes, then stop.
        if (next.factoryTwoPhase === "running") {
          next.factoryTwoRemainingMs = Math.max(0, next.factoryTwoRemainingMs - TICK_MS);
          next.factoryTwoAccumulatorMs += TICK_MS;
          while (next.factoryTwoAccumulatorMs >= 1000) {
            next.factoryTwoAccumulatorMs -= 1000;
            next.factoryTwoOutputPending += 1;
            next.barsProducedTotal += 1;
          }
          if (next.factoryTwoRemainingMs === 0) {
            next.factoryTwoPhase = "idle";
            next.factoryTwoAccumulatorMs = 0;
          }
        }

        // The short Factory 2 -> Iron Bar Bank conveyor moves finished bars.
        if (next.factoryTwoOutputPending > 0) {
          next.factoryTwoOutputAccumulatorMs += TICK_MS;
          while (next.factoryTwoOutputAccumulatorMs >= TRANSFER_UNIT_MS && next.factoryTwoOutputPending > 0) {
            next.factoryTwoOutputAccumulatorMs -= TRANSFER_UNIT_MS;
            next.factoryTwoOutputPending -= 1;
            next.banks[2] = (next.banks[2] || 0) + 1;
          }
        } else {
          next.factoryTwoOutputAccumulatorMs = 0;
        }

        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [authReady]);

  function startFactoryOne() {
    setGame((current) => {
      if (current.mineRunning || current.mineRemainingMs > 0) return current;
      return { ...current, mineRunning: true, mineRemainingMs: CYCLE_MS, mineAccumulatorMs: 0 };
    });
    setMessage("Factory 1 started. It will produce 1 Iron Ore every second for 3 minutes.");
  }

  function redeemOre() {
    setGame((current) => {
      if (current.mineOutput <= 0) return current;
      return {
        ...current,
        oreToBank: current.oreToBank + current.mineOutput,
        mineOutput: 0
      };
    });
    setMessage("Ore redemption started. Each Ore travels along the short conveyor before entering the Ore Bank.");
  }

  function unlockFactory(factoryId: number) {
    const materialId = factoryId - 1;
    const required = UNLOCK_COSTS[factoryId - 1];
    if (game.unlocked[factoryId - 1]) return;
    if (factoryId > 1 && !game.unlocked[factoryId - 2]) {
      setMessage("Unlock Factory " + (factoryId - 1) + " first. Factory progression is sequential.");
      return;
    }
    const availableNow = game.banks[materialId] || 0;
    if (availableNow < required) {
      setMessage("You need " + required.toLocaleString() + " " + FACTORY_NAMES[materialId] + " in its bank to unlock Factory " + factoryId + ".");
      return;
    }
    setGame((current) => {
      if (current.unlocked[factoryId - 1] || (factoryId > 1 && !current.unlocked[factoryId - 2]) || (current.banks[materialId] || 0) < required) return current;
      const unlocked = [...current.unlocked];
      unlocked[factoryId - 1] = true;
      const banks = { ...current.banks, [materialId]: (current.banks[materialId] || 0) - required };
      return { ...current, unlocked, banks, ...(factoryId === 2 ? { factoryTwoPhase: "idle" as FactoryTwoPhase } : {}) };
    });
    setMessage("Factory " + factoryId + " unlocked permanently. " + required.toLocaleString() + " " + FACTORY_NAMES[materialId] + " has been consumed.");
  }

  function startFactoryTwo() {
    if (!game.unlocked[1] || game.factoryTwoPhase !== "idle") return;
    const availableNow = game.banks[1] || 0;
    if (availableNow < 360) {
      setMessage("Factory 2 needs the full 360 Iron Ore in the Ore Bank before it can start. Current balance: " + availableNow + ".");
      return;
    }
    setGame((current) => {
      if (!current.unlocked[1] || current.factoryTwoPhase !== "idle" || (current.banks[1] || 0) < 360) return current;
      return {
        ...current,
        banks: { ...current.banks, 1: (current.banks[1] || 0) - 360 },
        factoryTwoPhase: "transferring",
        factoryTwoInputRemaining: 360,
        factoryTwoInputAccumulatorMs: 0,
        factoryTwoRemainingMs: 0,
        factoryTwoAccumulatorMs: 0
      };
    });
    setMessage("Factory 2 is receiving 360 Iron Ore through its conveyor. The 3-minute production timer will begin after all Ore arrives.");
  }

  const oreBank = game.banks[1] || 0;
  const barBank = game.banks[2] || 0;
  const factoryTwoCanStart = game.unlocked[1] && game.factoryTwoPhase === "idle" && oreBank >= 360;
  const visibleNextFactory = game.unlocked.findIndex((value, index) => index > 0 && !value);
  const nextFactoryId = visibleNextFactory === -1 ? null : visibleNextFactory + 1;

  if (!authReady) {
    return <main className="shell empire-shell"><div className="panel">Loading Mining Empire…</div></main>;
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
        <p className="empire-kicker">FACTORY PROGRESSION</p>
        <h1>GEMS: <span>Mining Empire</span></h1>
        <p className="muted">Start each available factory manually, move materials through short conveyors, and unlock the next stage permanently.</p>
        <div className="empire-inventory">
          <div className="empire-inventory-heading"><strong>MATERIAL BANKS</strong><small>Available stored quantity</small></div>
          <div className="empire-inventory-track">
            {FACTORY_NAMES.map((name, index) => (
              <div className="empire-inventory-item" key={index} title={name}>
                <b>M{index + 1}</b><strong>{(game.banks[index + 1] || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="empire-stats empire-stats-two">
          <div><small>Iron Ore at mine</small><strong>{game.mineOutput.toLocaleString()}</strong></div>
          <div><small>Ore in transit to bank</small><strong>{game.oreToBank.toLocaleString()}</strong></div>
          <div><small>Factories unlocked</small><strong>{game.unlocked.filter(Boolean).length} / 10</strong></div>
          <div><small>Iron Bars produced</small><strong>{game.barsProducedTotal.toLocaleString()}</strong></div>
        </div>
        <div className="notice empire-message" role="status">{message}</div>
      </section>

      <section className="section">
        <div className="row empire-section-heading">
          <div><h2>Production line</h2><p className="small">Factory 1 → Ore Bank → Factory 2 → Iron Bar Bank. Each conveyor is short, and materials visibly move one at a time.</p></div>
        </div>

        <div className="empire-production-line">
          <article className="empire-machine-card is-open">
            <div className="empire-machine-top"><span>FACTORY 1</span><span className={game.mineRunning ? "factory-pill is-running" : "factory-pill"}>{game.mineRunning ? "RUNNING" : "STOPPED"}</span></div>
            <div className="empire-machine-art">⛏️</div>
            <h3>Iron Ore Mine</h3>
            <p>Produces 1 Iron Ore every second.</p>
            <div className="empire-timer">{game.mineRunning ? clock(game.mineRemainingMs) : game.mineRemainingMs === 0 ? "00:00" : clock(game.mineRemainingMs)}</div>
            <small className="empire-card-caption">{game.mineRunning ? "TIME REMAINING" : "3-MINUTE CYCLE"}</small>
            <div className="empire-machine-count"><span>Unredeemed Ore</span><b>{game.mineOutput.toLocaleString()}</b></div>
            <button onClick={startFactoryOne} disabled={game.mineRunning || game.mineRemainingMs > 0}>
              {game.mineRunning ? "PRODUCING…" : game.mineRemainingMs > 0 ? "CYCLE ACTIVE" : "▶ START · 3 MIN"}
            </button>
            <button className="secondary" onClick={redeemOre} disabled={game.mineOutput === 0}>REDEEM ORE TO BANK</button>
          </article>

          <div className="empire-conveyor-block">
            <div className="empire-conveyor-label">SHORT CONVEYOR</div>
            <div className={"empire-short-belt " + (game.oreToBank > 0 ? "is-moving" : "")}>
              <span>🪨</span><i /><i /><i /><i /><i />
            </div>
            <small>{game.oreToBank > 0 ? game.oreToBank.toLocaleString() + " Ore travelling" : "Redeemed Ore route"}</small>
          </div>

          <article className="empire-bank-card">
            <div className="empire-bank-icon">🏦</div>
            <span>ORE BANK · M1</span>
            <strong className="empire-bank-quantity">{oreBank.toLocaleString()}</strong>
            <small>Available Iron Ore</small>
            <div className="empire-bank-note">Unlock Factory 2: 50 Ore</div>
          </article>

          <div className="empire-conveyor-block">
            <div className="empire-conveyor-label">INPUT CONVEYOR</div>
            <div className={"empire-short-belt " + (game.factoryTwoPhase === "transferring" ? "is-moving" : "")}>
              <span>🪨</span><i /><i /><i /><i /><i />
            </div>
            <small>{game.factoryTwoPhase === "transferring" ? game.factoryTwoInputRemaining.toLocaleString() + " Ore remaining" : "Ore Bank → Factory 2"}</small>
          </div>

          <article className={"empire-machine-card " + (game.unlocked[1] ? "is-open" : "is-locked")}>
            <div className="empire-machine-top"><span>FACTORY 2</span><span className={game.factoryTwoPhase === "running" ? "factory-pill is-running" : "factory-pill"}>{game.unlocked[1] ? game.factoryTwoPhase.toUpperCase() : "LOCKED"}</span></div>
            <div className="empire-machine-art">🔥</div>
            <h3>Iron Bar Smelter</h3>
            {!game.unlocked[1] ? (
              <>
                <p>Unlock permanently by consuming 50 Iron Ore from the Ore Bank.</p>
                <div className="empire-unlock-cost">50 M1 · IRON ORE</div>
                <button onClick={() => unlockFactory(2)} disabled={oreBank < 50}>UNLOCK FACTORY 2</button>
              </>
            ) : (
              <>
                <p>Consumes 360 Iron Ore and produces 1 Iron Bar per second.</p>
                <div className="empire-timer">{game.factoryTwoPhase === "running" ? clock(game.factoryTwoRemainingMs) : game.factoryTwoPhase === "transferring" ? "MOVING ORE" : "03:00"}</div>
                <small className="empire-card-caption">{game.factoryTwoPhase === "running" ? "TIME REMAINING" : game.factoryTwoPhase === "transferring" ? "WAITING FOR ALL 360 ORE" : "3-MINUTE CYCLE"}</small>
                {game.factoryTwoPhase === "transferring" && <div className="empire-transfer-progress"><i style={{ width: ((360 - game.factoryTwoInputRemaining) / 360 * 100) + "%" }} /></div>}
                <div className="empire-machine-count"><span>Iron Bars on output belt</span><b>{game.factoryTwoOutputPending.toLocaleString()}</b></div>
                <button onClick={startFactoryTwo} disabled={!factoryTwoCanStart}>
                  {game.factoryTwoPhase === "transferring" ? "TRANSFERRING…" : game.factoryTwoPhase === "running" ? "PRODUCING…" : "▶ START · 360 ORE"}
                </button>
                {game.factoryTwoPhase === "idle" && oreBank < 360 && <small className="empire-requirement-warning">Need { (360 - oreBank).toLocaleString() } more Ore in the bank.</small>}
              </>
            )}
          </article>

          <div className="empire-conveyor-block">
            <div className="empire-conveyor-label">OUTPUT CONVEYOR</div>
            <div className={"empire-short-belt " + (game.factoryTwoOutputPending > 0 ? "is-moving" : "")}>
              <span>🧱</span><i /><i /><i /><i /><i />
            </div>
            <small>{game.factoryTwoOutputPending > 0 ? game.factoryTwoOutputPending.toLocaleString() + " Bars travelling" : "Factory 2 → Iron Bar Bank"}</small>
          </div>

          <article className="empire-bank-card">
            <div className="empire-bank-icon">🏦</div>
            <span>IRON BAR BANK · M2</span>
            <strong className="empire-bank-quantity">{barBank.toLocaleString()}</strong>
            <small>Available Iron Bars</small>
            <div className="empire-bank-note">Unlock Factory 3: 120 Bars</div>
          </article>
        </div>
      </section>

      <section className="section panel empire-unlock-panel">
        <div className="row empire-section-heading"><div><h2>Factory unlock progression</h2><p className="small">Unlocking consumes the required banked material. Once unlocked, a factory stays unlocked permanently.</p></div></div>
        <div className="empire-unlock-grid">
          {FACTORY_NAMES.slice(2).map((name, index) => {
            const factoryId = index + 3;
            const materialId = factoryId - 1;
            const required = UNLOCK_COSTS[factoryId - 1];
            const unlocked = game.unlocked[factoryId - 1];
            const available = game.banks[materialId] || 0;
            return (
              <div className={"empire-unlock-item " + (unlocked ? "is-unlocked" : "")} key={factoryId}>
                <div className="empire-unlock-item-head"><b>FACTORY {factoryId}</b><span>{unlocked ? "UNLOCKED" : "LOCKED"}</span></div>
                <div className="empire-unlock-item-art">{FACTORY_ICONS[factoryId - 1]}</div>
                <strong>{name}</strong>
                <small>Unlock cost: {required.toLocaleString()} {FACTORY_NAMES[materialId - 1]}</small>
                <small>Bank balance: {available.toLocaleString()}</small>
                {!unlocked && <button className="secondary" onClick={() => unlockFactory(factoryId)} disabled={available < required || !game.unlocked[factoryId - 2]}>UNLOCK · CONSUME MATERIAL</button>}
                {!unlocked && !game.unlocked[factoryId - 2] && <small className="empire-pending-rules">Unlock Factory {factoryId - 1} first.</small>}
                {unlocked && <small className="success">Permanently unlocked</small>}
                {unlocked && <small className="empire-pending-rules">Production controls will be added after this factory's cycle is defined.</small>}
              </div>
            );
          })}
        </div>
        {nextFactoryId && <p className="small empire-next-factory">Next locked stage: Factory {nextFactoryId} · {FACTORY_NAMES[nextFactoryId - 1]}</p>}
      </section>
    </main>
  );
}
