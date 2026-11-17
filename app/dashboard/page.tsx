"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import GemArt from "@/components/gem-art";
import ProfileMenu from "@/components/profile-menu";

type Gemstone={id:string;code:string;name:string};
type Inventory={id:string;gemstone_id:string;level:number;gemstone_units_balance:number;is_active:boolean;is_unlocked:boolean;gemstones:Gemstone};
type Wallet={gems_balance:number;diamonds_balance:number};
const order=["GARNET","MOONSTONE","BLACK_OPAL","AQUAMARINE","TOPAZ","AMETHYST","EMERALD","SAPPHIRE","RUBY","DIAMOND"];
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});

export default function Dashboard(){
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [inventory,setInventory]=useState<Inventory[]>([]);const [status,setStatus]=useState("Loading your collection…");
 async function load(){
  const sb=createClient();const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  const [w,i]=await Promise.all([
   sb.from("wallets").select("gems_balance,diamonds_balance").eq("user_id",user.id).maybeSingle(),
   sb.from("player_gemstones").select("id,gemstone_id,level,gemstone_units_balance,is_active,is_unlocked,gemstones(id,code,name)").eq("user_id",user.id)
  ]);
  if(w.error||i.error){setStatus(w.error?.message||i.error?.message||"Unable to load account.");return;}
  setWallet(w.data as Wallet);setInventory(((i.data??[]) as unknown as Inventory[]).filter(x=>x.is_unlocked||x.gemstones?.code==="GARNET").sort((a,b)=>order.indexOf(a.gemstones?.code)-order.indexOf(b.gemstones?.code)));setStatus("");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{
  const sb=createClient();let channel:ReturnType<typeof sb.channel>|undefined;let active=true;
  void (async()=>{
   const {data:{user}}=await sb.auth.getUser();if(!active||!user)return;
   channel=sb.channel("gems-player-dashboard-"+user.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"wallets",filter:"user_id=eq."+user.id},()=>{void load();})
    .on("postgres_changes",{event:"*",schema:"public",table:"player_gemstones",filter:"user_id=eq."+user.id},()=>{void load();})
    .subscribe();
  })();
  return ()=>{active=false;if(channel)void sb.removeChannel(channel);};
 },[]);
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/" aria-current="page">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/tycoon/">Gems Tycoon</Link><Link href="/referral/">Referral</Link><Link href="/market/">Market</Link><ProfileMenu /></nav></header>
  <div className="row"><div><h1>My Dashboard</h1><p className="muted">Your wallet and gemstone collection at a glance.</p></div><Link href="/mining/"><button>Go to Mining</button></Link></div>
  {status&&<div className="notice">{status}</div>}
  <section className="grid section">
   <div className="panel"><div className="muted">GEMS balance</div><div className="stat">{fmt(wallet?.gems_balance??0)} GEMS</div><div className="small">₱1 accounting value per GEMS</div></div>
   <div className="panel"><div className="muted">Diamonds balance</div><div className="stat">{fmt(wallet?.diamonds_balance??0)}</div><div className="small">Separate wallet balance</div></div>
   <div className="panel"><div className="muted">Gemstones collected</div><div className="stat">{inventory.length} / 10</div><div className="small">Your owned gemstones</div></div>
  </section>
  <section className="section"><div className="row"><h2>My Collection</h2><Link href="/mining/">Manage mining →</Link></div>
   {inventory.length===0?<div className="panel muted">No gemstones found on this account.</div>:<div className="grid">
    {inventory.map(item=><article className="panel gem-card" key={item.id}>
     <div className="gem-picture"><GemArt code={item.gemstones?.code??"GARNET"} size={112}/></div>
     <h3>{item.gemstones?.name??"Gemstone"}</h3><div className="small">Level {item.level} / 10</div>
     <div className="collection-units">{Number(item.gemstone_units_balance||0).toLocaleString(undefined,{maximumFractionDigits:2})} <span className="small">units</span></div>
     <span className={item.is_active?"status-active":"status-inactive"}>{item.is_active?"Ready for mining":"Inactive"}</span>
    </article>)}
   </div>}
  </section>
 </main>;
}
