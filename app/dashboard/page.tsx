"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Wallet = { gems_balance:number; diamonds_balance:number };
type Inventory = { id:string; gemstone_id:string; level:number; is_active:boolean; gemstones?:{name:string; mining_reward_per_hour:number; unlock_cost_gems:number} };
type Tx = { id:string; transaction_type:string; amount:number; description:string|null; created_at:string };

export default function Dashboard() {
  const [email,setEmail] = useState("");
  const [wallet,setWallet] = useState<Wallet|null>(null);
  const [inventory,setInventory] = useState<Inventory[]>([]);
  const [transactions,setTransactions] = useState<Tx[]>([]);
  const [status,setStatus] = useState("Loading account…");
  const [busy,setBusy] = useState(false);
  const [rechargeAmount,setRechargeAmount] = useState("100");
  const [reference,setReference] = useState("");
  const [withdrawAmount,setWithdrawAmount] = useState("150");
  const [payoutDetails,setPayoutDetails] = useState("");

  async function load() {
    const supabase = createClient();
    const { data:{user}, error:authError } = await supabase.auth.getUser();
    if (authError || !user) { window.location.href="/login"; return; }
    setEmail(user.email ?? "");
    const [w,i,t] = await Promise.all([
      supabase.from("wallets").select("gems_balance,diamonds_balance").eq("user_id",user.id).maybeSingle(),
      supabase.from("player_gemstones").select("id,gemstone_id,level,is_active,gemstones(name,mining_reward_per_hour,unlock_cost_gems)").eq("user_id",user.id),
      supabase.from("wallet_transactions").select("id,transaction_type,amount,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10)
    ]);
    if (w.error || i.error || t.error) { setStatus(w.error?.message || i.error?.message || t.error?.message || "Unable to load account."); return; }
    setWallet(w.data as Wallet); setInventory((i.data ?? []) as unknown as Inventory[]); setTransactions((t.data ?? []) as Tx[]); setStatus("");
  }

  useEffect(()=>{ load(); },[]);

  async function rpc(name:string,args:Record<string,unknown>={}) {
    setBusy(true); setStatus("");
    try {
      const supabase=createClient();
      const {error}=await supabase.rpc(name,args);
      if(error) throw error;
      setStatus("Request completed."); await load();
    } catch(e) { setStatus(e instanceof Error?e.message:"Request failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    const supabase=createClient(); await supabase.auth.signOut(); window.location.href="/login";
  }

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><div className="row"><span className="small">{email}</span><button className="secondary" onClick={logout}>Sign out</button></div></header>
    <h1>Player Dashboard</h1><p className="muted">Your wallet, gemstones and mining controls.</p>
    {status && <div className="notice">{status}</div>}
    <section className="grid section">
      <div className="panel"><div className="muted">GEMS Balance</div><div className="stat">{wallet?.gems_balance ?? "—"} GEMS</div><div className="small">Accounting value: ₱1 per GEMS</div></div>
      <div className="panel"><div className="muted">Diamonds Balance</div><div className="stat">{wallet?.diamonds_balance ?? "—"}</div><div className="small">Conversion remains disabled until an admin configures a rate.</div></div>
      <div className="panel"><div className="muted">Gemstones owned</div><div className="stat">{inventory.length}</div><div className="small">Your available mining assets</div></div>
    </section>

    <section className="panel section">
      <h2>My Gemstones</h2>
      {inventory.length===0?<p className="muted">No gemstones found on this account.</p>:inventory.map(g=><div className="item row" key={g.id}>
        <div><strong>{g.gemstones?.name ?? "Gemstone"}</strong><div className="small">Level {g.level} · {g.gemstones?.mining_reward_per_hour ?? 0} GEMS/hour · {g.is_active?"Active":"Inactive"}</div></div>
        <button disabled={busy || !g.is_active} onClick={()=>rpc("start_mining",{p_player_gemstone_id:g.id})}>Start / Restart mining</button>
        <button className="secondary" disabled={busy} onClick={()=>rpc("collect_mining",{p_player_gemstone_id:g.id})}>Collect</button>
      </div>)}
      <p className="small">Mining runs for up to 24 hours per cycle. You can collect accrued rewards at any time. Starting again begins a new cycle; uncollected reward is not silently discarded.</p>
    </section>

    <section className="grid section">
      <div className="panel">
        <h2>Recharge request</h2>
        <p className="small">Create a manual recharge request. Fee: 0%. GEMS are credited only after an administrator verifies payment.</p>
        <label>Amount in PHP</label><input type="number" min="1" step="1" value={rechargeAmount} onChange={e=>setRechargeAmount(e.target.value)}/>
        <label>Payment reference / instructions</label><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Transaction reference"/>
        <button disabled={busy || Number(rechargeAmount)<1 || !reference.trim()} onClick={()=>rpc("create_recharge_request",{p_php_amount:Number(rechargeAmount),p_payment_reference:reference})}>Submit recharge request</button>
      </div>
      <div className="panel">
        <h2>Withdrawal request</h2>
        <p className="small">Minimum: 150 GEMS · Fee: 6%. Net payout is 94% of the requested amount, subject to admin review.</p>
        <label>GEMS amount</label><input type="number" min="150" step="1" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)}/>
        <label>Payout details</label><textarea value={payoutDetails} onChange={e=>setPayoutDetails(e.target.value)} placeholder="Enter payout method and account details securely"/>
        <button disabled={busy || Number(withdrawAmount)<150 || !payoutDetails.trim()} onClick={()=>rpc("request_withdrawal",{p_gems_amount:Number(withdrawAmount),p_payout_details:payoutDetails})}>Request withdrawal</button>
      </div>
    </section>

    <section className="panel section">
      <h2>Recent wallet transactions</h2>
      {transactions.length===0?<p className="muted">No transactions yet.</p>:transactions.map(t=><div className="item row" key={t.id}>
        <div><strong>{t.transaction_type}</strong><div className="small">{t.description ?? ""} · {new Date(t.created_at).toLocaleString()}</div></div>
        <strong>{t.amount>0?"+":""}{t.amount} GEMS</strong>
      </div>)}
    </section>
    <p className="small section">This is a starter application. Do not accept real customer funds or promise cash withdrawals until payment processing, payout operations, identity/fraud controls, applicable Philippine legal requirements and customer disclosures have been reviewed and configured.</p>
  </main>;
}
