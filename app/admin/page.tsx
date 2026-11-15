"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Player={id:string;username:string|null;email:string|null;created_at?:string};
type Wallet={user_id:string;gems_balance:number;diamonds_balance?:number};
type Gemstone={name:string};
type PlayerGem={id:string;user_id:string;level:number;gemstone_units_balance:number;is_active:boolean;is_unlocked:boolean;gemstones:Gemstone|null};
type Recharge={id:string;user_id:string;php_amount:number;gems_amount:number;fee_percent:number;payment_reference:string;status:string;created_at:string};
type Withdrawal={id:string;user_id:string;gems_amount:number;fee_percent:number;fee_amount:number;net_php_amount:number;payout_details:string;status:string;created_at:string};
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const when=(v:string)=>new Date(v).toLocaleString();

export default function AdminPage(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [wallets,setWallets]=useState<Wallet[]>([]);
 const [gems,setGems]=useState<PlayerGem[]>([]);
 const [recharges,setRecharges]=useState<Recharge[]>([]);
 const [withdrawals,setWithdrawals]=useState<Withdrawal[]>([]);
 const [status,setStatus]=useState("Checking administrator access…");
 const [busy,setBusy]=useState("");
 const [filter,setFilter]=useState("");
 const [tab,setTab]=useState<"players"|"recharges"|"withdrawals">("players");

 const load=useCallback(async()=>{
  const sb=createClient();
  const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  const {data:isAdmin,error:adminError}=await sb.rpc("is_admin");
  if(adminError){setStatus(adminError.message);return;}
  if(!isAdmin){setStatus("Access denied. This account is not registered as a GEMS administrator.");return;}
  const [p,w,g,r,wd]=await Promise.all([
   sb.from("profiles").select("id,username,email,created_at").order("created_at",{ascending:false}),
   sb.from("wallets").select("user_id,gems_balance"),
   sb.from("player_gemstones").select("id,user_id,level,gemstone_units_balance,is_active,is_unlocked,gemstones(name)"),
   sb.from("recharge_orders").select("id,user_id,php_amount,gems_amount,fee_percent,payment_reference,status,created_at").order("created_at",{ascending:false}),
   sb.from("withdrawal_requests").select("id,user_id,gems_amount,fee_percent,fee_amount,net_php_amount,payout_details,status,created_at").order("created_at",{ascending:false})
  ]);
  const error=p.error||w.error||g.error||r.error||wd.error;
  if(error){setStatus(error.message);return;}
  setPlayers((p.data??[]) as Player[]);setWallets((w.data??[]) as Wallet[]);
  setGems((g.data??[]) as unknown as PlayerGem[]);setRecharges((r.data??[]) as Recharge[]);
  setWithdrawals((wd.data??[]) as Withdrawal[]);setStatus("");
 },[]);
 useEffect(()=>{void load();},[load]);

 const playerMap=useMemo(()=>new Map(players.map(p=>[p.id,p])),[players]);
 const walletMap=useMemo(()=>new Map(wallets.map(w=>[w.user_id,w])),[wallets]);
 const filtered=useMemo(()=>players.filter(p=>(p.username??"").toLowerCase().includes(filter.toLowerCase())||(p.email??"").toLowerCase().includes(filter.toLowerCase())||p.id.toLowerCase().includes(filter.toLowerCase())),[players,filter]);
 const pendingRecharge=recharges.filter(x=>x.status==="pending").length;
 const openWithdrawals=withdrawals.filter(x=>x.status==="pending"||x.status==="approved").length;

 async function act(fn:string,args:Record<string,string>,label:string){
  if(busy)return;
  if(!window.confirm(label))return;
  setBusy(label);setStatus("");
  try{const sb=createClient();const {error}=await sb.rpc(fn,args);if(error)throw error;setStatus("Request updated successfully.");await load();}
  catch(e){setStatus(e instanceof Error?e.message:"Admin action failed.");}
  finally{setBusy("");}
 }
 async function logout(){const sb=createClient();await sb.auth.signOut();window.location.href="/GEMS/login/";}

 if(status==="Checking administrator access…")return <main className="shell"><h1>GEMS Admin</h1><div className="notice">{status}</div></main>;
 if(status.startsWith("Access denied"))return <main className="shell"><h1>GEMS Admin</h1><div className="notice">{status}</div><Link href="/GEMS/">Return to GEMS</Link></main>;

 return <main className="shell">
  <header className="topbar"><Link href="/GEMS/dashboard/" className="brand">💎 GEMS ADMIN</Link><nav className="row"><Link href="/GEMS/dashboard/">Player site</Link><button className="secondary" onClick={logout}>Sign out</button></nav></header>
  <div className="row"><div><h1>Admin Dashboard</h1><p className="muted">Player monitoring and payment request management.</p></div><button className="secondary" onClick={()=>void load()}>Refresh data</button></div>
  {status&&<div className="notice section">{status}</div>}
  <section className="grid section">
   <div className="panel"><div className="muted">Registered players</div><div className="stat">{players.length}</div></div>
   <div className="panel"><div className="muted">Pending recharges</div><div className="stat">{pendingRecharge}</div></div>
   <div className="panel"><div className="muted">Open withdrawals</div><div className="stat">{openWithdrawals}</div></div>
   <div className="panel"><div className="muted">Total player GEMS</div><div className="stat">{fmt(wallets.reduce((sum,w)=>sum+Number(w.gems_balance||0),0))}</div></div>
  </section>
  <div className="row section">
   <button className={tab==="players"?"":"secondary"} onClick={()=>setTab("players")}>Players ({players.length})</button>
   <button className={tab==="recharges"?"":"secondary"} onClick={()=>setTab("recharges")}>Recharges ({pendingRecharge} pending)</button>
   <button className={tab==="withdrawals"?"":"secondary"} onClick={()=>setTab("withdrawals")}>Withdrawals ({openWithdrawals} open)</button>
  </div>
  {tab==="players"&&<section className="panel section">
   <h2>Player monitoring</h2><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search username, email or player ID"/>
   <div className="transaction-list">{filtered.map(p=>{const w=walletMap.get(p.id);const inventory=gems.filter(x=>x.user_id===p.id);return <div className="item" key={p.id}>
    <div className="row"><div><strong>{p.username||"Player"}</strong><div className="small">{p.email||p.id}</div></div><strong>{fmt(Number(w?.gems_balance||0))} GEMS</strong></div>
    <div className="small section">{inventory.length} gemstone records: {inventory.map(x=>(x.gemstones?.name||"Gemstone")+" L"+x.level+" · "+fmt(Number(x.gemstone_units_balance||0))+" units"+(x.is_unlocked?"":" (locked)")).join(" | ")||"No gemstones"}</div>
   </div>;})}{filtered.length===0&&<p className="muted">No matching players.</p>}</div>
  </section>}
  {tab==="recharges"&&<section className="panel section"><h2>Recharge requests</h2>
   {recharges.length===0?<p className="muted">No recharge requests.</p>:<div className="transaction-list">{recharges.map(r=>{const p=playerMap.get(r.user_id);return <div className="item" key={r.id}>
    <div className="row"><div><strong>{p?.username||p?.email||r.user_id}</strong><div className="small">{p?.email||""} · {when(r.created_at)}</div></div><span className="status-active">{r.status.toUpperCase()}</span></div>
    <div className="small section">PHP amount: ₱{fmt(Number(r.php_amount))} · GEMS to credit: {fmt(Number(r.gems_amount))} · Reference: {r.payment_reference}</div>
    {r.status==="pending"&&<div className="row section"><button disabled={!!busy} onClick={()=>act("admin_approve_recharge",{p_order_id:r.id},"Approve recharge and credit GEMS?")}>Approve & credit</button><button className="secondary" disabled={!!busy} onClick={()=>act("admin_reject_recharge",{p_order_id:r.id},"Reject this recharge request?")}>Reject</button></div>}
   </div>;})}</div>}
  </section>}
  {tab==="withdrawals"&&<section className="panel section"><h2>Withdrawal requests</h2><p className="small">Mark a request as paid only after you have actually sent the PHP payout.</p>
   {withdrawals.length===0?<p className="muted">No withdrawal requests.</p>:<div className="transaction-list">{withdrawals.map(r=>{const p=playerMap.get(r.user_id);return <div className="item" key={r.id}>
    <div className="row"><div><strong>{p?.username||p?.email||r.user_id}</strong><div className="small">{p?.email||""} · {when(r.created_at)}</div></div><span className="status-active">{r.status.toUpperCase()}</span></div>
    <div className="small section">Requested: {fmt(Number(r.gems_amount))} GEMS · Fee: {fmt(Number(r.fee_amount))} GEMS · Payout: ₱{fmt(Number(r.net_php_amount))}</div>
    <div className="small">Payout details: {r.payout_details}</div>
    {r.status==="pending"&&<div className="row section"><button disabled={!!busy} onClick={()=>act("admin_approve_withdrawal",{p_request_id:r.id},"Approve this withdrawal request?")}>Approve</button><button className="secondary" disabled={!!busy} onClick={()=>act("admin_reject_withdrawal",{p_request_id:r.id},"Reject and refund this withdrawal request?")}>Reject & refund</button></div>}
    {r.status==="approved"&&<button className="section" disabled={!!busy} onClick={()=>act("admin_mark_withdrawal_paid",{p_request_id:r.id},"Confirm that you have already sent the PHP payout?")}>Mark as paid</button>}
   </div>;})}</div>}
  </section>}
 </main>;
}
