"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import GemArt from "@/components/gem-art";

type Gemstone={id:string;code:string;name:string;earning_units_per_minute:number[];level_up_cost_units:number[];unlock_cost_units:number;requires_gemstone_id:string|null;units_per_gems:number};
type Inventory={id:string;gemstone_id:string;level:number;is_active:boolean;is_unlocked:boolean;gemstone_units_balance:number;gemstones:Gemstone};
type Session={id:string;player_gemstone_id:string;started_at:string;ends_at:string;last_collected_at:string;is_active:boolean};
const order=["GARNET","MOONSTONE","BLACK_OPAL","AQUAMARINE","TOPAZ","AMETHYST","EMERALD","SAPPHIRE","RUBY","DIAMOND"];
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});

export default function MiningPage(){
 const [email,setEmail]=useState("");const [catalog,setCatalog]=useState<Gemstone[]>([]);
 const [inventory,setInventory]=useState<Inventory[]>([]);const [sessions,setSessions]=useState<Session[]>([]);
 const [status,setStatus]=useState("Loading mining assets…");const [busy,setBusy]=useState("");
 async function load(){
  const sb=createClient();const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  setEmail(user.email??"");
  const [g,i,s]=await Promise.all([
   sb.from("gemstones").select("id,code,name,earning_units_per_minute,level_up_cost_units,unlock_cost_units,requires_gemstone_id,units_per_gems").eq("is_available",true),
   sb.from("player_gemstones").select("id,gemstone_id,level,is_active,is_unlocked,gemstone_units_balance,gemstones(id,code,name,earning_units_per_minute,level_up_cost_units,unlock_cost_units,requires_gemstone_id,units_per_gems)").eq("user_id",user.id),
   sb.from("mining_sessions").select("id,player_gemstone_id,started_at,ends_at,last_collected_at,is_active").eq("user_id",user.id).eq("is_active",true)
  ]);
  const error=g.error||i.error||s.error;if(error){setStatus(error.message);return;}
  setCatalog(((g.data??[]) as Gemstone[]).sort((a,b)=>order.indexOf(a.code)-order.indexOf(b.code)));
  setInventory(((i.data??[]) as unknown as Inventory[]).sort((a,b)=>order.indexOf(a.gemstones?.code)-order.indexOf(b.gemstones?.code)));
  setSessions((s.data??[]) as Session[]);setStatus("");
 }
 useEffect(()=>{void load();},[]);
 async function action(label:string,fn:string,args:Record<string,unknown>){
  setBusy(label);setStatus("");
  try{const sb=createClient();const {data,error}=await sb.rpc(fn,args);if(error)throw error;
   if(fn==="collect_mining")setStatus("Collected "+fmt(Number(data))+" gemstone units.");
   else if(fn==="start_mining")setStatus("Mining started. Your gemstone can earn for up to 24 hours.");
   else setStatus("Gemstone updated successfully.");
   await load();
  }catch(e){setStatus(e instanceof Error?e.message:"Mining action failed.");}
  finally{setBusy("");}
 }
 const owned=new Map(inventory.map(x=>[x.gemstone_id,x]));
 const active=new Map(sessions.map(x=>[x.player_gemstone_id,x]));
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/" aria-current="page">Mining</Link><Link href="/market/">Market</Link><Link href="/profile/">Profile</Link><span className="small">{email}</span></nav></header>
  <h1>Gemstone Mining</h1><p className="muted">Manage all 10 gemstones, start a 24-hour mining cycle, collect units, unlock new gemstones and level up.</p>
  {status&&<div className="notice">{status}</div>}
  <div className="grid section">
   {catalog.map(g=>{
    const item=owned.get(g.id);const session=item?active.get(item.id):undefined;
    const rate=item?(g.earning_units_per_minute?.[item.level-1]??0):0;
    const cost=item?(g.level_up_cost_units?.[item.level-1]??0):0;
    const previous=g.requires_gemstone_id?catalog.find(x=>x.id===g.requires_gemstone_id):undefined;
    const previousItem=g.requires_gemstone_id?owned.get(g.requires_gemstone_id):undefined;
    const canUnlock=!item&&(g.requires_gemstone_id?Boolean(previousItem&&previousItem.gemstone_units_balance>=g.unlock_cost_units):false);
    return <article className="panel mining-card" key={g.id}>
     <div className="row mining-heading"><GemArt code={g.code} size={88}/><div className="mining-name"><h3>{g.name}</h3><span className={item?"status-active":"status-locked"}>{unlocked&&item?"Owned · Level "+item.level:"Locked"}</span></div></div>
     {unlocked&&item?<>
      <div className="mining-rate"><strong>{fmt(rate)}</strong><span className="small"> units / minute</span></div>
      <div className="small">Your balance: <strong>{fmt(item.gemstone_units_balance)} units</strong></div>
      {session?<div className="notice mining-session"><strong>Mining in progress</strong><div className="small">Started: {new Date(session.started_at).toLocaleString()}</div><div className="small">Cycle ends: {new Date(session.ends_at).toLocaleString()}</div><button disabled={!!busy} onClick={()=>action(item.id,"collect_mining",{p_player_gemstone_id:item.id})}>{busy===item.id?"Please wait…":"Collect units"}</button></div>
      :<div className="notice mining-session"><strong>Not currently mining</strong><p className="small">Start a new cycle. You can collect at any time, up to 24 hours.</p><button disabled={!!busy} onClick={()=>action(item.id,"start_mining",{p_player_gemstone_id:item.id})}>{busy===item.id?"Starting…":"▶ Start Mining"}</button></div>}
      <div className="small">Next level-up: {item.level>=10?"Maximum level reached":fmt(cost)+" units"}</div>
      {item.level<10&&<button className="secondary section" disabled={!!busy||item.gemstone_units_balance<cost} onClick={()=>action(item.id,"level_up_gemstone",{p_player_gemstone_id:item.id})}>Level up to {item.level+1}</button>}
     </>:<div className="locked-details">
       {g.requires_gemstone_id?<><p className="small">Unlock with {fmt(g.unlock_cost_units)} {g.name} units.</p><p className="small">{item?fmt(item.gemstone_units_balance)+" "+g.name+" units available":"Buy "+g.name+" units in the Market first."}</p></>:<p className="small">Starter Garnet is free for new players.</p>}
       {canUnlock&&<button disabled={!!busy} onClick={()=>action(g.id,"purchase_gemstone",{p_gemstone_id:g.id})}>{busy===g.id?"Unlocking…":"Unlock with "+g.name+" units"}</button>}
      </div>}
    </article>;
   })}
  </div>
  <p className="small section">Mining rates and level-up requirements follow your original confirmed GEMS table. Each cycle runs for a maximum of 24 hours.</p>
 </main>;
}
