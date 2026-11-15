"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Wallet = { gems_balance:number; diamonds_balance:number };
type Gemstone = {
  id:string; code:string; name:string; earning_units_per_minute:number[];
  units_per_gems:number; level_up_cost_units:number[]; unlock_cost_units:number;
  requires_gemstone_id:string|null; is_available:boolean;
};
type Inventory = {
  id:string; gemstone_id:string; level:number; is_active:boolean; gemstone_units_balance:number;
  gemstones?:Gemstone;
};
type Tx = { id:string; transaction_type:string; amount:number; description:string|null; created_at:string };

const GEM_ORDER=["GARNET","MOONSTONE","BLACK_OPAL","AQUAMARINE","TOPAZ","AMETHYST","EMERALD","SAPPHIRE","RUBY","DIAMOND"];
const number=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});

export default function Dashboard() {
  const [email,setEmail] = useState("");
  const [wallet,setWallet] = useState<Wallet|null>(null);
  const [inventory,setInventory] = useState<Inventory[]>([]);
  const [catalog,setCatalog] = useState<Gemstone[]>([]);
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
    if (authError || !user) { window.location.href=`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login/`; return; }
    setEmail(user.email ?? "");
    const [w,i,t,c] = await Promise.all([
      supabase.from("wallets").select("gems_balance,diamonds_balance").eq("user_id",user.id).maybeSingle(),
      supabase.from("player_gemstones").select("id,gemstone_id,level,is_active,gemstone_units_balance,gemstones(id,code,name,earning_units_per_minute,units_per_gems,level_up_cost_units,unlock_cost_units,requires_gemstone_id,is_available)").eq("user_id",user.id),
      supabase.from("wallet_transactions").select("id,transaction_type,amount,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10),
      supabase.from("gemstones").select("id,code,name,earning_units_per_minute,units_per_gems,level_up_cost_units,unlock_cost_units,requires_gemstone_id,is_available").eq("is_available",true)
    ]);
    if (w.error || i.error || t.error || c.error) {
      setStatus(w.error?.message || i.error?.message || t.error?.message || c.error?.message || "Unable to load account.");
      return;
    }
    setWallet(w.data as Wallet);
    setInventory((i.data ?? []) as unknown as Inventory[]);
    setTransactions((t.data ?? []) as Tx[]);
    setCatalog(((c.data ?? []) as unknown as Gemstone[]).sort((a,b)=>GEM_ORDER.indexOf(a.code)-GEM_ORDER.indexOf(b.code)));
    setStatus("");
  }

  useEffect(()=>{ load(); },[]);

  async function rpc(name:string,args:Record<string,unknown>={}) {
    setBusy(true); setStatus("");
    try {
      const supabase=createClient();
      const {error}=await supabase.rpc(name,args);
      if(error) throw error;
      setStatus("Request completed successfully.");
      await load();
    } catch(e) { setStatus(e instanceof Error?e.message:"Request failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    const supabase=createClient(); await supabase.auth.signOut(); window.location.href=`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login/`;
  }

  const ownedIds=new Set(inventory.map(g=>g.gemstone_id));
  const inventoryByGem=new Map(inventory.map(g=>[g.gemstone_id,g]));

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><div className="row"><span className="small">{email}</span><button className="secondary" onClick={logout}>Sign out</button></div></header>
    <h1>Player Dashboard</h1><p className="muted">Your wallet, gemstone collection and mining controls.</p>
    {status && <div className="notice">{status}</div>}
    <section className="grid section">
      <div className="panel"><div className="muted">GEMS Balance</div><div className="stat">{number(wallet?.gems_balance ?? 0)} GEMS</div><div className="small">Accounting value: ₱1 per GEMS</div></div>
      <div className="panel"><div className="muted">Diamonds Balance</div><div className="stat">{number(wallet?.diamonds_balance ?? 0)}</div><div className="small">Separate Diamonds wallet balance.</div></div>
      <div className="panel"><div className="muted">Gemstones owned</div><div className="stat">{inventory.length} / 10</div><div className="small">Your available mining assets</div></div>
    </section>

    <section className="panel section">
      <h2>My Gemstones</h2>
      {inventory.length===0?<p className="muted">No gemstones found on this account.</p>:inventory.map(g=>{
        const gem=g.gemstones;
        const rate=gem?.earning_units_per_minute?.[g.level-1] ?? 0;
        const nextCost=gem?.level_up_cost_units?.[g.level-1] ?? 0;
        const canConvert=gem?.units_per_gems ? Math.floor(g.gemstone_units_balance/gem.units_per_gems) : 0;
        return <div className="item section" key={g.id}>
          <div className="row">
            <div><strong>{gem?.name ?? "Gemstone"}</strong><div className="small">Level {g.level} / 10 · {number(rate)} units/minute · {g.is_active?"Active":"Inactive"}</div></div>
            <strong>{number(g.gemstone_units_balance)} units</strong>
          </div>
          <div className="row">
            <button disabled={busy || !g.is_active} onClick={()=>rpc("start_mining",{p_player_gemstone_id:g.id})}>Start mining</button>
            <button className="secondary" disabled={busy} onClick={()=>rpc("collect_mining",{p_player_gemstone_id:g.id})}>Collect units</button>
            <button className="secondary" disabled={busy || canConvert<1} onClick={()=>rpc("convert_gemstone_units",{p_player_gemstone_id:g.id})}>Convert {canConvert} GEMS</button>
            <button className="secondary" disabled={busy || g.level>=10 || g.gemstone_units_balance<nextCost} onClick={()=>rpc("level_up_gemstone",{p_player_gemstone_id:g.id})}>Level up · {number(nextCost)} units</button>
          </div>
          <div className="small">Conversion: {number(gem?.units_per_gems ?? 0)} units = 1 GEMS. Mining cycle: maximum 24 hours.</div>
        </div>;
      })}
    </section>

    <section className="panel section">
      <h2>Gemstone Collection</h2>
      <p className="muted">Unlock the next gemstone by spending the required units from the previous gemstone. Your first Level 1 Garnet remains free for new accounts.</p>
      <div className="grid">
        {catalog.map(g=>{
          const owned=ownedIds.has(g.id);
          const previous=g.requires_gemstone_id ? catalog.find(x=>x.id===g.requires_gemstone_id) : null;
          const previousInventory=g.requires_gemstone_id ? inventoryByGem.get(g.requires_gemstone_id) : null;
          const canUnlock=owned ? false : g.requires_gemstone_id
            ? Boolean(previousInventory && previousInventory.gemstone_units_balance>=g.unlock_cost_units)
            : Number(wallet?.gems_balance ?? 0)>=1;
          return <div className="panel" key={g.id}>
            <div className="row"><strong>{g.name}</strong><span className="small">{owned?"Owned":"Locked"}</span></div>
            <div className="small">Level 1 earning: {number(g.earning_units_per_minute?.[0] ?? 0)} units/min</div>
            <div className="small">Conversion: {number(g.units_per_gems)} units = 1 GEMS</div>
            {g.requires_gemstone_id
              ? <div className="small">Unlock: {number(g.unlock_cost_units)} {previous?.name ?? "previous gemstone"} units</div>
              : <div className="small">Starter Garnet: free for new accounts</div>}
            {owned
              ? <p className="small">Already in your collection.</p>
              : <button disabled={busy || !canUnlock} onClick={()=>rpc("purchase_gemstone",{p_gemstone_id:g.id})}>{canUnlock?"Unlock gemstone":"Requirement not met"}</button>}
          </div>;
        })}
      </div>
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
        <div className="small">Estimated payout: ₱{number(Math.max(0,Number(withdrawAmount)||0)*0.94)} after the 6% fee.</div>
        <label>Payout details</label><textarea value={payoutDetails} onChange={e=>setPayoutDetails(e.target.value)} placeholder="Enter payout method and account details securely"/>
        <button disabled={busy || Number(withdrawAmount)<150 || !payoutDetails.trim()} onClick={()=>rpc("request_withdrawal",{p_gems_amount:Number(withdrawAmount),p_payout_details:payoutDetails})}>Request withdrawal</button>
      </div>
    </section>

    <section className="panel section">
      <h2>Recent wallet transactions</h2>
      {transactions.length===0?<p className="muted">No transactions yet.</p>:transactions.map(t=><div className="item row" key={t.id}>
        <div><strong>{t.transaction_type}</strong><div className="small">{t.description ?? ""} · {new Date(t.created_at).toLocaleString()}</div></div>
        <strong>{t.amount>0?"+":""}{number(t.amount)} GEMS</strong>
      </div>)}
    </section>
    <p className="small section">GEMS withdrawals are subject to admin verification. Only mark a payout as paid after the PHP transfer has actually been completed. Review payment, payout, identity, fraud and applicable Philippine legal requirements before operating this as a real-money service.</p>
  </main>;
}
