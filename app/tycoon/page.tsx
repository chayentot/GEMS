"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";
import styles from "./page.module.css";

type Summary={referral_code:string;level1_count:number;level2_count:number;level3_count:number;total_earned:number};
type Commission={id:string;source_user_id:string;referral_level:number;spend_amount:number;commission_amount:number;source_type:string;source_description:string|null;source_units_spent:number|null;created_at:string};
const fmt=(n:number)=>Number(n||0).toFixed(2);

export default function ReferralPage(){
 const [summary,setSummary]=useState<Summary|null>(null);const [link,setLink]=useState("");const [commissions,setCommissions]=useState<Commission[]>([]);const [status,setStatus]=useState("Loading referral details…");
 async function load(){
  const sb=createClient();const {data:{user},error}=await sb.auth.getUser();if(error||!user){window.location.href="/GEMS/login/";return;}
  const [s,c]=await Promise.all([sb.rpc("get_my_referral_summary"),sb.from("referral_commissions").select("id,source_user_id,referral_level,spend_amount,commission_amount,source_type,source_description,source_units_spent,created_at").eq("beneficiary_id",user.id).order("created_at",{ascending:false}).limit(50)]);
  if(s.error||c.error){setStatus((s.error||c.error)!.message);return;}
  const data=(s.data??null) as Summary|null;setSummary(data);setLink(data?.referral_code?window.location.origin+"/GEMS/login/?ref="+encodeURIComponent(data.referral_code):"");setCommissions((c.data??[]) as Commission[]);setStatus("");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{const sb=createClient();let channel:ReturnType<typeof sb.channel>|undefined;let active=true;void(async()=>{const {data:{user}}=await sb.auth.getUser();if(!active||!user)return;channel=sb.channel("referral-live-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"referral_commissions",filter:"beneficiary_id=eq."+user.id},()=>{void load();}).subscribe();})();return()=>{active=false;if(channel)void sb.removeChannel(channel);};},[]);
 async function copy(){if(!link)return;await navigator.clipboard.writeText(link);setStatus("Referral link copied. Share it with new players.");}
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/tycoon/">Gems Tycoon</Link><Link href="/referral/" aria-current="page">Referral</Link><Link href="/market/">Market</Link><ProfileMenu /></nav></header>
  <div><h1>Gems Tycoon</h1><p className="muted">Invite players and earn GEMS when your referral network unlocks or upgrades gemstones in Mining.</p></div>
  {status&&<div className="notice">{status}</div>}
  <section className={styles.stage} aria-label="Gems Tycoon grid">
   <div className={styles.canvas} aria-label="Blank 1020 by 1500 pixel grid with 60 by 60 pixel cells" />
  </section>
  <section className="panel section"><h2>Referral earnings history</h2>{commissions.length===0?<p className="small muted">No referral commissions yet. You earn when someone in your referral network successfully unlocks or upgrades a gemstone in Mining.</p>:<div className="transaction-list">{commissions.map(c=><div className="item row" key={c.id}><div><strong>Level {c.referral_level} commission</strong><div className="small">{c.source_description??(c.source_type==="market_buy"?"Historical Market purchase":"Mining action")} · Player {c.source_user_id.slice(0,8)} · {fmt(Number(c.source_units_spent??0))} units · GEMS equivalent: {fmt(Number(c.spend_amount))} · {new Date(c.created_at).toLocaleString()}</div></div><strong className="success">+{fmt(Number(c.commission_amount))} GEMS</strong></div>)}</div>}</section>
 </main>;
}
