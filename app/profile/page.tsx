"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Wallet={gems_balance:number;diamonds_balance:number};
type Tx={id:string;transaction_type:string;amount:number;description:string|null;created_at:string};
type ReferralSummary={referral_code:string;level1_count:number;level2_count:number;level3_count:number;total_earned:number};
type ReferralCommission={id:string;source_user_id:string;referral_level:number;spend_amount:number;commission_amount:number;created_at:string};
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});
type ProfileTab="overview"|"recharge"|"withdraw"|"transactions";

export default function ProfilePage(){
 const [email,setEmail]=useState("");const [username,setUsername]=useState("");
 const [wallet,setWallet]=useState<Wallet|null>(null);const [transactions,setTransactions]=useState<Tx[]>([]);
 const [referral,setReferral]=useState<ReferralSummary|null>(null);const [referralLink,setReferralLink]=useState("");const [commissions,setCommissions]=useState<ReferralCommission[]>([]);
 const [status,setStatus]=useState("Loading profile…");const [busy,setBusy]=useState(false);
 const [activeTab,setActiveTab]=useState<ProfileTab>("overview");
 const [rechargeAmount,setRechargeAmount]=useState("100");const [reference,setReference]=useState("");
 const [withdrawAmount,setWithdrawAmount]=useState("150");const [payoutDetails,setPayoutDetails]=useState("");
 async function load(){
  const sb=createClient();const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  setEmail(user.email??"");setUsername(String(user.user_metadata?.username??""));
  const [w,t,r,c]=await Promise.all([
   sb.from("wallets").select("gems_balance,diamonds_balance").eq("user_id",user.id).maybeSingle(),
   sb.from("wallet_transactions").select("id,transaction_type,amount,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50),
   sb.rpc("get_my_referral_summary"),
   sb.from("referral_commissions").select("id,source_user_id,referral_level,spend_amount,commission_amount,created_at").eq("beneficiary_id",user.id).order("created_at",{ascending:false}).limit(50)
  ]);
  const err=w.error||t.error||r.error||c.error;
  if(err){setStatus(err.message);return;}
  setWallet(w.data as Wallet);setTransactions((t.data??[]) as Tx[]);
  setReferral((r.data??null) as ReferralSummary|null);
  const code=(r.data as ReferralSummary|null)?.referral_code;
  setReferralLink(code?window.location.origin+"/GEMS/login/?ref="+encodeURIComponent(code):"");
  setCommissions((c.data??[]) as ReferralCommission[]);setStatus("");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
  const syncTab=()=>{const tab=window.location.hash.replace("#","") as ProfileTab;setActiveTab(["overview","recharge","withdraw","transactions"].includes(tab)?tab:"overview");};
  syncTab();window.addEventListener("hashchange",syncTab);return ()=>window.removeEventListener("hashchange",syncTab);
 },[]);
 function showTab(tab:ProfileTab){setActiveTab(tab);window.history.replaceState(null,"",tab==="overview"?"/GEMS/profile/":"#"+tab);}
 useEffect(()=>{
  const sb=createClient();let channel:ReturnType<typeof sb.channel>|undefined;let active=true;
  void (async()=>{
   const {data:{user}}=await sb.auth.getUser();
   if(!active||!user)return;
   channel=sb.channel("profile-live-"+user.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"wallets",filter:"user_id=eq."+user.id},()=>{void load();})
    .on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions",filter:"user_id=eq."+user.id},()=>{void load();})
    .on("postgres_changes",{event:"*",schema:"public",table:"recharge_orders",filter:"user_id=eq."+user.id},()=>{void load();})
    .on("postgres_changes",{event:"*",schema:"public",table:"withdrawal_requests",filter:"user_id=eq."+user.id},()=>{void load();})
    .on("postgres_changes",{event:"*",schema:"public",table:"referral_commissions",filter:"beneficiary_id=eq."+user.id},()=>{void load();})
    .subscribe();
  })();
  return ()=>{active=false;if(channel)void sb.removeChannel(channel);};
 },[]);
 async function rpc(name:string,args:Record<string,unknown>){
  setBusy(true);setStatus("");
  try{const sb=createClient();const {error}=await sb.rpc(name,args);if(error)throw error;setStatus("Your request was submitted successfully. Recharge and withdrawal requests require administrator review.");await load();return true;}
  catch(e){setStatus(e instanceof Error?e.message:"Request failed.");return false;}
  finally{setBusy(false);}
 }
 async function submitRecharge(){
  const amount=Number(rechargeAmount);const ref=reference.trim();
  if(!Number.isFinite(amount)||amount<1||!ref||busy)return;
  const yes=window.confirm("Confirm recharge request?\n\nAmount: ₱"+fmt(amount)+"\nGEMS to request: "+fmt(amount)+"\nPayment reference: "+ref+"\n\nSubmit this request for administrator verification?");
  if(!yes)return;
  if(await rpc("create_recharge_request",{p_php_amount:amount,p_payment_reference:ref}))setReference("");
 }
 async function submitWithdrawal(){
  const amount=Number(withdrawAmount);const details=payoutDetails.trim();
  if(!Number.isFinite(amount)||amount<150||amount>Number(wallet?.gems_balance??0)||!details||busy)return;
  const fee=amount*0.06;const payout=amount-fee;
  const yes=window.confirm("Confirm withdrawal request?\n\nGEMS to withdraw: "+fmt(amount)+"\nWithdrawal fee (6%): "+fmt(fee)+" GEMS\nEstimated payout: ₱"+fmt(payout)+"\nPayout details: "+details+"\n\nSubmit this request for administrator approval?");
  if(!yes)return;
  if(await rpc("request_withdrawal",{p_gems_amount:amount,p_payout_details:details}))setPayoutDetails("");
 }
 async function copyReferralLink(){
  if(!referral?.referral_code)return;
  const url=window.location.origin+"/GEMS/login/?ref="+encodeURIComponent(referral.referral_code);
  await navigator.clipboard.writeText(url);
  setStatus("Referral link copied. Share it with a new player.");
 }
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/tycoon/">Gems Tycoon</Link><Link href="/tycoon2/">Gems Tycoon</Link><Link href="/referral/">Referral</Link><Link href="/market/">Market</Link><ProfileMenu /></nav></header>
  <div><h1>My Profile</h1><p className="muted">Account details, wallet services and transaction records.</p></div>
  {status&&<div className="notice">{status}</div>}
  <div className="profile-tabs" role="tablist" aria-label="Profile sections">
   <button type="button" role="tab" aria-selected={activeTab==="overview"} className={activeTab==="overview"?"profile-tab active":"profile-tab"} onClick={()=>showTab("overview")}>Account overview</button>
   <button type="button" role="tab" aria-selected={activeTab==="recharge"} className={activeTab==="recharge"?"profile-tab active":"profile-tab"} onClick={()=>showTab("recharge")}>Recharge GEMS</button>
   <button type="button" role="tab" aria-selected={activeTab==="withdraw"} className={activeTab==="withdraw"?"profile-tab active":"profile-tab"} onClick={()=>showTab("withdraw")}>Withdraw GEMS</button>
   <button type="button" role="tab" aria-selected={activeTab==="transactions"} className={activeTab==="transactions"?"profile-tab active":"profile-tab"} onClick={()=>showTab("transactions")}>Transaction history</button>
  </div>
  {activeTab==="overview"&&<section className="grid section">
   <div className="panel"><div className="muted">Email address</div><strong>{email||"—"}</strong><div className="small">Registered account</div></div>
   <div className="panel"><div className="muted">Username</div><strong>{username||"Not set"}</strong><div className="small">Player display name</div></div>
   <div className="panel"><div className="muted">GEMS wallet</div><div className="stat">{fmt(wallet?.gems_balance??0)}</div><div className="small">GEMS · ₱1 accounting value each</div></div>
  </section>}
  {activeTab==="recharge"&&<section className="section"><div className="panel"><h2>Recharge GEMS</h2><p className="small">Recharge fee: 0%. Your GEMS are credited after an administrator verifies your payment.</p>
   <label>Amount in PHP</label><input type="number" min="1" step="1" value={rechargeAmount} onChange={e=>setRechargeAmount(e.target.value)}/>
   <label>Payment reference</label><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Enter your payment reference"/>
   <button disabled={busy||Number(rechargeAmount)<1||!reference.trim()} onClick={()=>void submitRecharge()}>{busy?"Please wait…":"Submit recharge request"}</button>
  </div></section>}
  {activeTab==="withdraw"&&<section className="section"><div className="panel"><h2>Withdraw GEMS</h2><p className="small">Minimum 150 GEMS · 6% fee · estimated payout is 94% of the requested amount. Admin approval required.</p>
   <div className="notice">Available balance: <strong>{fmt(wallet?.gems_balance??0)} GEMS</strong></div>
   <label>GEMS amount</label><input type="number" min="150" step="1" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)}/>
   <div className="notice">Estimated PHP payout: <strong>₱{fmt(Math.max(0,Number(withdrawAmount)||0)*0.94)}</strong></div>
   <label>Payout details</label><textarea value={payoutDetails} onChange={e=>setPayoutDetails(e.target.value)} placeholder="Enter payout method and account details"/>
   <button disabled={busy||Number(withdrawAmount)<150||Number(withdrawAmount)>(wallet?.gems_balance??0)||!payoutDetails.trim()} onClick={()=>void submitWithdrawal()}>{busy?"Please wait…":"Submit withdrawal request"}</button>
  </div></section>}
  {activeTab==="transactions"&&<section className="panel section"><h2>Transaction history</h2>
   {transactions.length===0?<p className="muted">No transactions recorded yet.</p>:<div className="transaction-list">{transactions.map(t=><div className="item row" key={t.id}><div><strong>{t.transaction_type.replaceAll("_"," ")}</strong><div className="small">{t.description??""}</div><div className="small">{new Date(t.created_at).toLocaleString()}</div></div><strong className={t.amount>=0?"success":"error"}>{t.amount>0?"+":""}{fmt(t.amount)} GEMS</strong></div>)}</div>}
  </section>}
 </main>;
}
