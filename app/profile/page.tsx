"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Wallet={gems_balance:number;diamonds_balance:number};
type Tx={id:string;transaction_type:string;amount:number;description:string|null;created_at:string};
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});

export default function ProfilePage(){
 const [email,setEmail]=useState("");const [username,setUsername]=useState("");
 const [wallet,setWallet]=useState<Wallet|null>(null);const [transactions,setTransactions]=useState<Tx[]>([]);
 const [status,setStatus]=useState("Loading profile…");const [busy,setBusy]=useState(false);
 const [rechargeAmount,setRechargeAmount]=useState("100");const [reference,setReference]=useState("");
 const [withdrawAmount,setWithdrawAmount]=useState("150");const [payoutDetails,setPayoutDetails]=useState("");
 async function load(){
  const sb=createClient();const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  setEmail(user.email??"");setUsername(String(user.user_metadata?.username??""));
  const [w,t]=await Promise.all([
   sb.from("wallets").select("gems_balance,diamonds_balance").eq("user_id",user.id).maybeSingle(),
   sb.from("wallet_transactions").select("id,transaction_type,amount,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50)
  ]);
  if(w.error||t.error){setStatus(w.error?.message||t.error?.message||"Unable to load profile.");return;}
  setWallet(w.data as Wallet);setTransactions((t.data??[]) as Tx[]);setStatus("");
 }
 useEffect(()=>{void load();},[]);
 async function rpc(name:string,args:Record<string,unknown>){
  setBusy(true);setStatus("");
  try{const sb=createClient();const {error}=await sb.rpc(name,args);if(error)throw error;setStatus("Your request was submitted successfully. Recharge and withdrawal requests require administrator review.");await load();}
  catch(e){setStatus(e instanceof Error?e.message:"Request failed.");}
  finally{setBusy(false);}
 }
 async function logout(){const sb=createClient();await sb.auth.signOut();window.location.href="/GEMS/login/";}
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/market/">Market</Link><Link href="/profile/" aria-current="page">Profile</Link></nav></header>
  <div className="row"><div><h1>My Profile</h1><p className="muted">Account details, wallet services and transaction records.</p></div><button className="secondary" onClick={logout}>Sign out</button></div>
  {status&&<div className="notice">{status}</div>}
  <section className="grid section">
   <div className="panel"><div className="muted">Email address</div><strong>{email||"—"}</strong><div className="small">Registered account</div></div>
   <div className="panel"><div className="muted">Username</div><strong>{username||"Not set"}</strong><div className="small">Player display name</div></div>
   <div className="panel"><div className="muted">GEMS wallet</div><div className="stat">{fmt(wallet?.gems_balance??0)}</div><div className="small">GEMS · ₱1 accounting value each</div></div>
   <div className="panel"><div className="muted">Diamonds wallet</div><div className="stat">{fmt(wallet?.diamonds_balance??0)}</div><div className="small">Separate balance</div></div>
  </section>
  <section className="grid section">
   <div className="panel"><h2>Recharge GEMS</h2><p className="small">Recharge fee: 0%. Your GEMS are credited after an administrator verifies your payment.</p>
    <label>Amount in PHP</label><input type="number" min="1" step="1" value={rechargeAmount} onChange={e=>setRechargeAmount(e.target.value)}/>
    <label>Payment reference</label><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Enter your payment reference"/>
    <button disabled={busy||Number(rechargeAmount)<1||!reference.trim()} onClick={()=>rpc("create_recharge_request",{p_php_amount:Number(rechargeAmount),p_payment_reference:reference.trim()})}>Submit recharge request</button>
   </div>
   <div className="panel"><h2>Withdraw GEMS</h2><p className="small">Minimum 150 GEMS · 6% fee · estimated payout is 94% of the requested amount. Admin approval required.</p>
    <label>GEMS amount</label><input type="number" min="150" step="1" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)}/>
    <div className="notice">Estimated PHP payout: <strong>₱{fmt(Math.max(0,Number(withdrawAmount)||0)*0.94)}</strong></div>
    <label>Payout details</label><textarea value={payoutDetails} onChange={e=>setPayoutDetails(e.target.value)} placeholder="Enter payout method and account details"/>
    <button disabled={busy||Number(withdrawAmount)<150||Number(withdrawAmount)>(wallet?.gems_balance??0)||!payoutDetails.trim()} onClick={()=>rpc("request_withdrawal",{p_gems_amount:Number(withdrawAmount),p_payout_details:payoutDetails.trim()})}>Submit withdrawal request</button>
   </div>
  </section>
  <section className="panel section"><h2>Transaction history</h2>
   {transactions.length===0?<p className="muted">No transactions recorded yet.</p>:<div className="transaction-list">{transactions.map(t=><div className="item row" key={t.id}><div><strong>{t.transaction_type.replaceAll("_"," ")}</strong><div className="small">{t.description??""}</div><div className="small">{new Date(t.created_at).toLocaleString()}</div></div><strong className={t.amount>=0?"success":"error"}>{t.amount>0?"+":""}{fmt(t.amount)} GEMS</strong></div>)}</div>}
  </section>
 </main>;
}
