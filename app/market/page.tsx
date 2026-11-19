"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";

type Gemstone = { id:string; code:string; name:string; units_per_gems:number; is_available:boolean };
type Inventory = { id:string; gemstone_id:string; level:number; gemstone_units_balance:number; gemstones:Gemstone };
type Wallet = { gems_balance:number };
const order=["GARNET","MOONSTONE","BLACK_OPAL","AQUAMARINE","TOPAZ","AMETHYST","EMERALD","SAPPHIRE","RUBY","DIAMOND"];
const colors:Record<string,string>={GARNET:"#c83b54",MOONSTONE:"#b8c8dc",BLACK_OPAL:"#6e5bb5",AQUAMARINE:"#39c8c5",TOPAZ:"#e9ad45",AMETHYST:"#a779dc",EMERALD:"#39b879",SAPPHIRE:"#3988dc",RUBY:"#e34451",DIAMOND:"#dce9f4"};
const fmt=(n:number)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:8});

function GemArt({code}:{code:string}) {
 const c=colors[code]||"#b8c8dc";
 return <svg viewBox="0 0 80 80" width="66" height="66" aria-label={code+" gemstone"} role="img">
  <defs><linearGradient id={"g-"+code} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".9"/><stop offset="45%" stopColor={c}/><stop offset="100%" stopColor="#17233c"/></linearGradient></defs>
  <path d="M19 12 L61 12 L75 31 L40 72 L5 31 Z" fill={"url(#g-"+code+")"} stroke="#ffffff" strokeOpacity=".7" strokeWidth="2"/>
  <path d="M19 12 L29 31 L5 31 M61 12 L51 31 L75 31 M29 31 L40 72 L51 31 M19 12 L61 12 L51 31 L29 31 Z" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5"/>
  <path d="M19 12 L29 31 L40 15 L61 12 L51 31 Z" fill="#fff" opacity=".22"/>
 </svg>;
}

export default function MarketPage() {
 const [email,setEmail]=useState("");
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [catalog,setCatalog]=useState<Gemstone[]>([]);
 const [inventory,setInventory]=useState<Inventory[]>([]);
 const [buyGem,setBuyGem]=useState("");
 const [buyAmount,setBuyAmount]=useState("1");
 const [sellInventory,setSellInventory]=useState("");
 const [sellUnits,setSellUnits]=useState("");
 const [status,setStatus]=useState("Loading market…");
 const [busy,setBusy]=useState(false);
 const [activeTab,setActiveTab]=useState<"buy"|"sell"|"rates">("buy");

 async function load() {
  const supabase=createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){window.location.href="/GEMS/login/";return;}
  setEmail(user.email??"");
  const [w,g,i]=await Promise.all([
   supabase.from("wallets").select("gems_balance").eq("user_id",user.id).maybeSingle(),
   supabase.from("gemstones").select("id,code,name,units_per_gems,is_available").eq("is_available",true),
   supabase.from("player_gemstones").select("id,gemstone_id,level,gemstone_units_balance,gemstones(id,code,name,units_per_gems,is_available)").eq("user_id",user.id)
  ]);
  const err=w.error||g.error||i.error;
  if(err){setStatus(err.message);return;}
  const gems=((g.data??[]) as Gemstone[]).sort((a,b)=>order.indexOf(a.code)-order.indexOf(b.code));
  const owned=(i.data??[]) as unknown as Inventory[];
  setWallet(w.data as Wallet);setCatalog(gems);setInventory(owned);
  if(!buyGem&&gems[0])setBuyGem(gems[0].id);
  if(!sellInventory&&owned[0])setSellInventory(owned[0].id);
  setStatus("");
 }
 useEffect(()=>{load();},[]);
 const selectedBuy=catalog.find(g=>g.id===buyGem);
 const selectedSell=inventory.find(g=>g.id===sellInventory);
 const buyUnits=useMemo(()=>Math.max(0,Number(buyAmount)||0)*(selectedBuy?.units_per_gems||0)*0.95,[buyAmount,selectedBuy]);
 const sellNet=useMemo(()=>Math.max(0,Number(sellUnits)||0)/(selectedSell?.gemstones?.units_per_gems||1)*0.95,[sellUnits,selectedSell]);

 async function trade(fn:"market_buy_gemstone"|"market_sell_gemstone",args:Record<string,unknown>) {
  setBusy(true);setStatus("");
  try {
   const supabase=createClient();
   const {data,error}=await supabase.rpc(fn,args);
   if(error)throw error;
   const result=data as Record<string,unknown>|null;
   setStatus(fn==="market_buy_gemstone"
    ? "Purchase successful. "+fmt(Number(result?.gemstone_units_received))+" gemstone units added to your collection."
    : "Sale successful. "+fmt(Number(result?.gems_received))+" GEMS added to your wallet.");
   await load();
  } catch(e) {setStatus(e instanceof Error?e.message:"Market transaction failed.");}
  finally {setBusy(false);}
 }

 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/tycoon/">Gems Tycoon</Link><Link href="/tycoon2/">Gems Tycoon 2</Link><Link href="/tycoon3/">Gems Tycoon 3</Link><Link href="/referral/">Referral</Link><Link href="/market/" aria-current="page">Market</Link><ProfileMenu /></nav></header>
  <div><h1>GEMS Market</h1><p className="muted">Buy and sell gemstone units, or review the current platform exchange rates.</p></div>
  <section className="panel section row"><div><div className="muted">Available GEMS</div><div className="stat">{fmt(wallet?.gems_balance??0)} GEMS</div></div><div className="small">A 5% market fee applies to both buying and selling.</div></section>
  {status&&<div className="notice section">{status}</div>}
  <div className="profile-tabs" role="tablist" aria-label="Market sections">
   <button type="button" role="tab" aria-selected={activeTab==="buy"} className={activeTab==="buy"?"profile-tab active":"profile-tab"} onClick={()=>setActiveTab("buy")}>Buy Gemstone</button>
   <button type="button" role="tab" aria-selected={activeTab==="sell"} className={activeTab==="sell"?"profile-tab active":"profile-tab"} onClick={()=>setActiveTab("sell")}>Sell Gemstone</button>
   <button type="button" role="tab" aria-selected={activeTab==="rates"} className={activeTab==="rates"?"profile-tab active":"profile-tab"} onClick={()=>setActiveTab("rates")}>Market Exchange Rate</button>
  </div>
  {activeTab==="buy"&&<section className="section"><div className="panel">
   <h2>Buy gemstone units</h2><p className="small">Choose a gemstone and the amount of GEMS to spend. Units are added directly to your gemstone collection. The 5% market fee is deducted from the units received.</p>
   <label>Gemstone</label><select value={buyGem} onChange={e=>setBuyGem(e.target.value)}>{catalog.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
   {selectedBuy&&<div className="row section"><GemArt code={selectedBuy.code}/><div><strong>{selectedBuy.name}</strong><div className="small">Base rate: {fmt(selectedBuy.units_per_gems)} units per GEMS</div></div></div>}
   <label>GEMS to spend</label><input type="number" min="0.00000001" step="0.00000001" value={buyAmount} onChange={e=>setBuyAmount(e.target.value)}/>
   <div className="item"><div className="row"><span className="small">Gemstone units you receive (after fee)</span><strong>{fmt(buyUnits)}</strong></div><div className="row"><span className="small">5% fee (unit equivalent)</span><span className="small">{fmt(Math.max(0,Number(buyAmount)||0)*(selectedBuy?.units_per_gems||0)*0.05)}</span></div></div>
   <button disabled={busy||!selectedBuy||Number(buyAmount)<=0||Number(buyAmount)>(wallet?.gems_balance??0)} onClick={()=>trade("market_buy_gemstone",{p_gemstone_id:buyGem,p_gems_amount:Number(buyAmount)})}>{busy?"Please wait…":"Buy gemstone"}</button>
  </div></section>}
  {activeTab==="sell"&&<section className="section"><div className="panel">
   <h2>Sell gemstone units</h2><p className="small">Choose a gemstone from your collection. The net GEMS after the 5% market fee will be credited to your wallet.</p>
   <label>Your gemstone</label><select value={sellInventory} onChange={e=>setSellInventory(e.target.value)}>{inventory.map(g=><option key={g.id} value={g.id}>{g.gemstones?.name??"Gemstone"} — {Number(g.gemstone_units_balance||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} units</option>)}</select>
   {selectedSell&&<div className="row section"><GemArt code={selectedSell.gemstones?.code??""}/><div><strong>{selectedSell.gemstones?.name}</strong><div className="small">Available: {Number(selectedSell.gemstone_units_balance||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} units</div></div></div>}
   <div className="row"><label>Units to sell</label><button type="button" className="secondary" disabled={busy||!selectedSell||selectedSell.gemstone_units_balance<=0} onClick={()=>{if(selectedSell)setSellUnits(String(Math.floor(selectedSell.gemstone_units_balance)))}}>Max</button></div><input type="number" min="1" step="1" max={selectedSell?.gemstone_units_balance??0} value={sellUnits} onChange={e=>setSellUnits(e.target.value)}/>
   <div className="item"><div className="row"><span className="small">GEMS you receive (after fee)</span><strong>{fmt(sellNet)}</strong></div><div className="row"><span className="small">5% fee</span><span className="small">{fmt(Math.max(0,Number(sellUnits)||0)/(selectedSell?.gemstones?.units_per_gems||1)*0.05)} GEMS</span></div></div>
   <button disabled={busy||!selectedSell||Number(sellUnits)<=0||Number(sellUnits)>selectedSell.gemstone_units_balance||sellNet<=0} onClick={()=>trade("market_sell_gemstone",{p_player_gemstone_id:sellInventory,p_gemstone_units:Number(sellUnits)})}>{busy?"Please wait…":"Sell gemstone"}</button>
  </div></section>}
  {activeTab==="rates"&&<section className="panel section"><h2>Market exchange rates</h2><p className="small">Base conversion rates used by the market. A 5% fee is applied to each buy or sell transaction.</p>
   <div className="grid">{catalog.map(g=><div className="item row" key={g.id}><div className="row"><GemArt code={g.code}/><strong>{g.name}</strong></div><span className="small">1 GEMS = {fmt(g.units_per_gems)} units</span></div>)}</div>
   <p className="small section">The fee is deducted from the gemstone units received when buying, and from the GEMS payout when selling. Mining earnings and level-up requirements remain unchanged.</p>
  </section>}
 </main>;
}
