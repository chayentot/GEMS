"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Recipe = { id:number; name:string; inputs:[number,number][]; value:number; unlock:number; icon:string; kind:string };
type Shipment = { id:string; materialId:number; amount:number; remainingMs:number };
type GameState = { gold:number; unlocked:boolean[]; levels:number[]; stock:Record<number,number>; sold:number; produced:number; shipments:Shipment[] };
type WorldPayload = {
  gold_balance:number|string; total_produced:number|string; total_shipped:number|string;
  offline_minutes_processed?:number;
  facilities:{facility_id:number;level:number;is_unlocked:boolean}[];
  inventory:{facility_id:number;material_id:number;amount:number|string}[];
  shipments:{id:string;material_id:number;amount:number|string;arrive_at:string}[];
};

const recipes:Recipe[]=[
 {id:1,name:"Garnet Mine",inputs:[],value:1,unlock:0,icon:"⛏️",kind:"EXTRACTION"},
 {id:2,name:"Ore Washer",inputs:[[1,2]],value:2,unlock:50,icon:"💧",kind:"WASHING"},
 {id:3,name:"Crystal Sorter",inputs:[[2,2]],value:4,unlock:120,icon:"🔮",kind:"SORTING"},
 {id:4,name:"Gem Cutter",inputs:[[3,2]],value:6,unlock:220,icon:"💎",kind:"CUTTING"},
 {id:5,name:"Polishing Mill",inputs:[[4,2]],value:8,unlock:350,icon:"⚙️",kind:"POLISHING"},
 {id:6,name:"Crystal Press",inputs:[[5,2]],value:12,unlock:500,icon:"🏗️",kind:"PROCESSING"},
 {id:7,name:"Gem Lab",inputs:[[6,2]],value:18,unlock:700,icon:"🧪",kind:"REFINING"},
 {id:8,name:"Vault Workshop",inputs:[[7,2]],value:25,unlock:950,icon:"🏦",kind:"STORAGE"},
 {id:9,name:"Deep Core Drill",inputs:[[8,2]],value:35,unlock:1250,icon:"🚜",kind:"DEEP MINING"},
 {id:10,name:"Legendary Crystal Forge",inputs:[[9,2]],value:60,unlock:1600,icon:"✨",kind:"MASTER FORGE"}
];
const fmt=(n:number)=>Math.floor(Number(n||0)).toLocaleString();

function mapWorld(payload:WorldPayload):GameState {
 const unlocked=Array(10).fill(false) as boolean[];
 const levels=Array(10).fill(1) as number[];
 payload.facilities?.forEach((f)=>{unlocked[f.facility_id-1]=f.is_unlocked;levels[f.facility_id-1]=f.level;});
 const stock:Record<number,number>={};
 payload.inventory?.forEach((i)=>{stock[i.facility_id*100+i.material_id]=Number(i.amount);});
 return {
  gold:Number(payload.gold_balance||0),unlocked,levels,stock,
  sold:Number(payload.total_shipped||0),produced:Number(payload.total_produced||0),
  shipments:(payload.shipments||[]).map((s)=>({id:s.id,materialId:s.material_id,amount:Number(s.amount),remainingMs:Math.max(0,new Date(s.arrive_at).getTime()-Date.now())}))
 };
}

export default function MiningEmpirePage(){
 const [game,setGame]=useState<GameState>({gold:0,unlocked:[true,false,false,false,false,false,false,false,false,false],levels:Array(10).fill(1),stock:{},sold:0,produced:0,shipments:[]});
 const [authReady,setAuthReady]=useState(false);
 const [selected,setSelected]=useState(1);
 const [message,setMessage]=useState("Connecting to your secure Gemstone Frontier world…");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);

 const refreshWorld=useCallback(async()=>{
  const sb=createClient();
  const {data,error}=await sb.rpc("gem_world_advance");
  if(error)throw error;
  const payload=data as WorldPayload;
  setGame(mapWorld(payload));
  if(Number(payload.offline_minutes_processed||0)>0){
   setMessage("Welcome back! Your mine processed "+fmt(Number(payload.offline_minutes_processed))+" offline minutes (maximum 24 hours).");
  }
 },[]);

 useEffect(()=>{
  let alive=true;
  const sb=createClient();
  void sb.auth.getUser().then(async({data:{user},error})=>{
   if(!alive)return;
   if(error||!user){window.location.href="/GEMS/login/";return;}
   setAuthReady(true);
   try{await refreshWorld();setMessage("Your mining world is synchronized. Production is calculated securely by Supabase.");}
   catch(e){setMessage(e instanceof Error?e.message:"Could not load your mining world.");}
   finally{if(alive)setLoading(false);}
  });
  return()=>{alive=false;};
 },[refreshWorld]);

 useEffect(()=>{
  if(!authReady)return;
  const timer=window.setInterval(()=>{void refreshWorld().catch((e)=>setMessage(e instanceof Error?e.message:"World synchronization failed."));},10000);
  return()=>window.clearInterval(timer);
 },[authReady,refreshWorld]);

 const unlockedCount=game.unlocked.filter(Boolean).length;
 const stored=useMemo(()=>Object.values(game.stock).reduce((sum,n)=>sum+n,0),[game.stock]);
 const activeFactory=recipes[selected-1];
 const inputRows=activeFactory.inputs.map(([id,quantity])=>({
  name:recipes[id-1].name,icon:recipes[id-1].icon,
  amount:game.stock[selected*100+id]||0,required:quantity
 }));
 const activeStored=inputRows.reduce((sum,x)=>sum+x.amount,0);
 const isUnlocked=game.unlocked[selected-1];

 async function upgrade(factory:Recipe){
  const currentLevel=game.levels[factory.id-1]||1;
  const cost=Math.max(100,factory.unlock)*currentLevel;
  if(currentLevel>=10){setMessage("This facility is already at maximum level.");return;}
  if(game.gold<cost){setMessage("You need "+fmt(cost)+" Gold to upgrade this facility.");return;}
  setBusy(true);setMessage("");
  try{const sb=createClient();const {data,error}=await sb.rpc("gem_world_upgrade",{p_facility_id:factory.id});if(error)throw error;setGame(mapWorld(data as WorldPayload));setMessage(factory.name+" upgraded to level "+(currentLevel+1)+". Production capacity has increased.");}
  catch(e){setMessage(e instanceof Error?e.message:"Facility upgrade failed.");}
  finally{setBusy(false);}
 }

 async function unlock(factory:Recipe){
  if(isUnlocked&&factory.id===selected)return;
  if(game.gold<factory.unlock){setMessage("You need "+factory.unlock+" Gold to unlock "+factory.name+".");return;}
  setBusy(true);setMessage("");
  try{
   const sb=createClient();
   const {data,error}=await sb.rpc("gem_world_unlock",{p_facility_id:factory.id});
   if(error)throw error;
   setGame(mapWorld(data as WorldPayload));
   setSelected(factory.id);
   setMessage(factory.name+" unlocked! Supabase has saved your facility and deducted the Gold.");
  }catch(e){setMessage(e instanceof Error?e.message:"Facility unlock failed.");}
  finally{setBusy(false);}
 }

 return <main className="shell empire-shell gem-world-page">
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
    <div className="gem-world-live"><i /> SUPABASE SYNCED</div>
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
    <div className="gem-world-map-top"><div><strong>⛏️ MINING TERRITORY</strong><span>Tap a facility to inspect or unlock it</span></div><div className="gem-world-coords">SECTOR 01 · DEPTH 240M</div></div>
    <div className="gem-world-map">
     <div className="world-terrain terrain-a" /><div className="world-terrain terrain-b" /><div className="world-water" />
     <div className="world-road road-horizontal" /><div className="world-road road-vertical" /><div className="world-rail rail-one" /><div className="world-rail rail-two" />
     <div className="world-decoration deco-crystals">💠 ✦ 💠</div><div className="world-decoration deco-crystals-two">💎 ✧</div><div className="world-decoration deco-plants">🌿 🌱</div><div className="world-decoration deco-rocks">🪨 🪨</div>
     <div className="world-conveyor conveyor-one"><span>🪨</span><span>🪨</span><span>💎</span><b>ORE FLOW →</b></div>
     <div className="world-conveyor conveyor-two"><span>💎</span><span>💠</span><b>GEM FLOW →</b></div>
     {recipes.map((factory,index)=>{
      const unlocked=game.unlocked[index],inputTotal=factory.inputs.reduce((sum,[id])=>sum+(game.stock[factory.id*100+id]||0),0),active=selected===factory.id;
      const positions=["world-node-1","world-node-2","world-node-3","world-node-4","world-node-5","world-node-6","world-node-7","world-node-8","world-node-9","world-node-10"];
      return <button type="button" key={factory.id} className={"world-facility "+positions[index]+(unlocked?" is-unlocked":" is-locked")+(active?" is-selected":"")} onClick={()=>setSelected(factory.id)}>
       <span className="world-facility-icon">{factory.icon}</span><strong>{factory.name}</strong><small>{unlocked?(factory.id===1?"EXTRACTING":"PROCESSING"):"🔒 "+factory.unlock+" GOLD"}</small>
       {unlocked&&<span className="world-facility-level">LV. {game.levels[index]||1}</span>}
       {unlocked&&<span className="world-facility-fill"><i style={{width:Math.min(100,inputTotal)+"%"}} /></span>}
      </button>;
     })}
     <div className="world-gold-station">🪙<strong>GOLD EXCHANGE</strong><small>Auto-sell overflow</small></div>
     <div className="world-map-label">GARNET RIDGE MINING DISTRICT</div>
    </div>
    <div className="gem-world-map-footer"><span><i className="legend-dot online" /> Operating</span><span><i className="legend-dot locked" /> Locked facility</span><span><i className="legend-dot belt" /> Conveyor route</span><span>🚚 {game.shipments.length} shipments moving</span></div>
   </div>
   <aside className="gem-factory-panel">
    <div className="gem-factory-heading"><div><small>FACILITY CONTROL</small><h2>{activeFactory.icon} {activeFactory.name}</h2></div><span className={isUnlocked?"factory-state online":"factory-state locked"}>{isUnlocked?"● ONLINE":"🔒 LOCKED"}</span></div>
    <div className="gem-factory-art"><span>{activeFactory.icon}</span><i /><b>{activeFactory.kind}</b></div>
    <div className="gem-factory-level"><span>Facility level</span><strong>LEVEL {game.levels[selected-1]||1} / 10</strong></div>
    <div className="gem-factory-storage">
     <div><span>INPUT STORAGE</span><strong>{activeFactory.inputs.length?activeStored+" / 100":"RAW MINE"}</strong></div>
     <div className="factory-storage-bar"><i style={{width:(activeFactory.inputs.length?Math.min(100,activeStored):100)+"%"}} /></div>
     {inputRows.length?inputRows.map((row)=><div className="factory-input-row" key={row.name}><span>{row.icon} {row.name}</span><strong>{row.amount} <small>/ batch {row.required}</small></strong></div>):<p className="factory-help">This mine extracts raw Garnet Ore and feeds the conveyor network.</p>}
    </div>
    <div className="gem-factory-recipe"><small>PRODUCTION RECIPE</small><div className="factory-recipe-flow"><span>{activeFactory.inputs.length?activeFactory.inputs.map(([id])=>recipes[id-1].icon).join(" + "):"⛏️"}</span><b>→</b><span>{activeFactory.icon}</span></div><strong>{activeFactory.inputs.length?activeFactory.inputs.map(([id,qty])=>qty+" × "+recipes[id-1].name).join(" + "):"5 raw ore / minute"}</strong></div>
    {isUnlocked?<div className="factory-upgrade-box"><div><strong>⚙️ Upgrade facility</strong><small>Cost: {fmt(Math.max(100,activeFactory.unlock)*(game.levels[selected-1]||1))} Gold · increases production throughput.</small></div><button onClick={()=>upgrade(activeFactory)} disabled={busy||loading||(game.levels[selected-1]||1)>=10||game.gold<Math.max(100,activeFactory.unlock)*(game.levels[selected-1]||1)}>UPGRADE</button></div>:<div className="factory-upgrade-box"><div><strong>Unlock this facility</strong><small>Uses separate in-game Gold only.</small></div><button onClick={()=>unlock(activeFactory)} disabled={busy||loading||game.gold<activeFactory.unlock}>🪙 {fmt(activeFactory.unlock)} GOLD</button></div>}
    <div className="factory-panel-note">Progress, Gold, facilities and inventory are stored in Supabase. Offline production is capped at 24 hours per visit.</div>
   </aside>
  </section>
  <section className="gem-world-bottom">
   <div className="gem-world-bottom-heading"><div><h2>Production network</h2><p>Materials move through unlocked facilities and overflow shipments are sold for game Gold.</p></div><div className="gem-world-controls"><button className="secondary" disabled={busy||loading} onClick={()=>{setLoading(true);void refreshWorld().then(()=>setMessage("Mining world synchronized.")).catch(e=>setMessage(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false));}}>↻ Refresh world</button></div></div>
   <div className="gem-production-list">{recipes.map((factory)=><button key={factory.id} className={"gem-production-item"+(game.unlocked[factory.id-1]?" active":"")} onClick={()=>setSelected(factory.id)}><span>{factory.icon}</span><div><strong>{factory.name}</strong><small>{factory.kind}</small></div><b>{game.unlocked[factory.id-1]?"● ACTIVE":"🔒 LOCKED"}</b></button>)}</div>
  </section>
  {message&&<div className="notice empire-message">{message}</div>}
  <p className="gem-world-disclaimer">Game Gold is separate from GEMS wallet funds and cannot be withdrawn or converted into GEMS. All production and facility unlocks are validated by Supabase.</p>
 </main>;
}
