"use client";

import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ProfileMenu from "@/components/profile-menu";
import styles from "./page.module.css";

type Summary={referral_code:string;level1_count:number;level2_count:number;level3_count:number;total_earned:number};
type Commission={id:string;source_user_id:string;referral_level:number;spend_amount:number;commission_amount:number;source_type:string;source_description:string|null;source_units_spent:number|null;created_at:string};
const fmt=(n:number)=>Number(n||0).toFixed(2);

type MovingStone={id:number;distance:number};
const STAR_ROUTE=[{x:485,y:245},{x:485,y:305},{x:965,y:305},{x:5,y:545},{x:5,y:1505},{x:485,y:1505},{x:485,y:665},{x:965,y:665},{x:965,y:2405},{x:485,y:2405},{x:485,y:1565},{x:5,y:1565},{x:5,y:2405}];
const STAR_ROUTE_LENGTH=STAR_ROUTE.slice(1).reduce((total,p,i)=>total+Math.hypot(p.x-STAR_ROUTE[i].x,p.y-STAR_ROUTE[i].y),0);
function starStonePosition(distance:number){let remaining=distance;for(let i=1;i<STAR_ROUTE.length;i++){const from=STAR_ROUTE[i-1],to=STAR_ROUTE[i],length=Math.hypot(to.x-from.x,to.y-from.y);if(remaining<=length){const ratio=length===0?0:remaining/length;return{x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio};}remaining-=length;}return STAR_ROUTE[STAR_ROUTE.length-1];}

export default function ReferralPage(){
 const [summary,setSummary]=useState<Summary|null>(null);const [starStoneCount,setStarStoneCount]=useState(0);const [movingStones,setMovingStones]=useState<MovingStone[]>([]);const lastFrame=useRef(0);const lastSpawn=useRef(0);const nextStoneId=useRef(1);const [link,setLink]=useState("");const [commissions,setCommissions]=useState<Commission[]>([]);const [status,setStatus]=useState("Loading referral details…");
 async function load(){
  const sb=createClient();const {data:{user},error}=await sb.auth.getUser();if(error||!user){window.location.href="/GEMS/login/";return;}
  const [s,c]=await Promise.all([sb.rpc("get_my_referral_summary"),sb.from("referral_commissions").select("id,source_user_id,referral_level,spend_amount,commission_amount,source_type,source_description,source_units_spent,created_at").eq("beneficiary_id",user.id).order("created_at",{ascending:false}).limit(50)]);
  if(s.error||c.error){setStatus((s.error||c.error)!.message);return;}
  const data=(s.data??null) as Summary|null;setSummary(data);setLink(data?.referral_code?window.location.origin+"/GEMS/login/?ref="+encodeURIComponent(data.referral_code):"");setCommissions((c.data??[]) as Commission[]);setStatus("");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{lastFrame.current=performance.now();lastSpawn.current=lastFrame.current;const timer=window.setInterval(()=>{const now=performance.now();const delta=Math.min((now-lastFrame.current)/1000,0.1);lastFrame.current=now;const shouldSpawn=now-lastSpawn.current>=1000;if(shouldSpawn)lastSpawn.current=now;setMovingStones(previous=>{const advanced=previous.map(stone=>({...stone,distance:stone.distance+60*delta})).filter(stone=>stone.distance<STAR_ROUTE_LENGTH);if(shouldSpawn)advanced.push({id:nextStoneId.current++,distance:0});return advanced;});if(shouldSpawn)setStarStoneCount(count=>count+1);},50);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{const sb=createClient();let channel:ReturnType<typeof sb.channel>|undefined;let active=true;void(async()=>{const {data:{user}}=await sb.auth.getUser();if(!active||!user)return;channel=sb.channel("referral-live-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"referral_commissions",filter:"beneficiary_id=eq."+user.id},()=>{void load();}).subscribe();})();return()=>{active=false;if(channel)void sb.removeChannel(channel);};},[]);
 async function copy(){if(!link)return;await navigator.clipboard.writeText(link);setStatus("Referral link copied. Share it with new players.");}
 return <main className="shell">
  <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><nav className="row"><Link href="/dashboard/">Dashboard</Link><Link href="/mining/">Mining</Link><Link href="/tycoon/">Gems Tycoon</Link><Link href="/referral/" aria-current="page">Referral</Link><Link href="/market/">Market</Link><ProfileMenu /></nav></header>
  <div><h1>Gems Tycoon</h1><p className="muted">Invite players and earn GEMS when your referral network unlocks or upgrades gemstones in Mining.</p></div>
  {status&&<div className="notice">{status}</div>}
  <section className={styles.stage} aria-label="Gems Tycoon grid">
   <div className={styles.canvas} aria-label="1020 by 2400 pixel grid with one yellow test area and eight blue 5 by 5 zones">
    <div className={styles.highlight} aria-label="Star Stone generator producing one stone every second">
     <div className={styles.starStone} role="img" aria-label="50 by 50 pixel Star Stone">
      <svg viewBox="0 0 50 50" width="50" height="50" aria-hidden="true">
       <defs>
        <linearGradient id="starStoneFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9fbff"/><stop offset="42%" stopColor="#58c9ff"/><stop offset="100%" stopColor="#1761d8"/></linearGradient>
        <linearGradient id="starStoneEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#55aaff"/></linearGradient>
       </defs>
       <path d="M25 2 39 11 47 26 36 43 18 48 4 34 3 17Z" fill="url(#starStoneFill)" stroke="url(#starStoneEdge)" strokeWidth="2"/>
       <path d="M25 2 25 25 39 11Z" fill="#e8fcff" opacity=".82"/>
       <path d="M25 25 47 26 36 43Z" fill="#0e48b5" opacity=".58"/>
       <path d="M25 2 25 25 4 34 3 17Z" fill="#8ce4ff" opacity=".52"/>
       <path d="m25 10 3.2 9.1 9.6.3-7.6 5.8 2.8 9.2-8-5.5-8 5.5 2.8-9.2-7.6-5.8 9.6-.3Z" fill="#fff8c9" stroke="#ffffff" strokeWidth=".8"/>
      </svg>
     </div>
     <span className={styles.starStoneName}>STAR STONE</span>
     <span className={styles.starStoneCount}>{starStoneCount.toLocaleString()} produced</span>
     <span className={styles.starStoneRate}>+1 every second</span>
    </div>
    <div className={styles.blueZone + " " + styles.blue1} />
    <div className={styles.blueZone + " " + styles.blue2} />
    <div className={styles.blueZone + " " + styles.blue3} />
    <div className={styles.blueZone + " " + styles.blue4} />
    <div className={styles.blueZone + " " + styles.blue5} />
    <div className={styles.blueZone + " " + styles.blue6} />
    <div className={styles.blueZone + " " + styles.blue7} />
    <div className={styles.blueZone + " " + styles.blue8} />
    <div className={styles.redZone + " " + styles.red1} />
    <div className={styles.redZone + " " + styles.red2} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray1} />
    <div className={styles.grayZone + " " + styles.grayHorizontal + " " + styles.gray2} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray3} />
    <div className={styles.grayZone + " " + styles.grayHorizontal + " " + styles.gray4} />
    <div className={styles.grayZone + " " + styles.grayHorizontal + " " + styles.gray5} />
    <div className={styles.grayZone + " " + styles.grayHorizontal + " " + styles.gray6} />
    <div className={styles.grayZone + " " + styles.grayHorizontal + " " + styles.gray7} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray8} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray9} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray10} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray11} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray12} />
    <div className={styles.grayZone + " " + styles.grayVertical + " " + styles.gray13} />
    <div className={styles.conveyorSeparator} aria-label="Solid separator between conveyor rows 10 and 11" />
    {movingStones.map(stone=>{const position=starStonePosition(stone.distance);return <div key={stone.id} className={styles.movingStarStone} style={{left:position.x,top:position.y}} aria-label={"Star Stone "+stone.id+" moving on conveyor"}><svg viewBox="0 0 50 50" width="50" height="50" aria-hidden="true"><defs><linearGradient id="movingStoneFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e9fbff"/><stop offset="45%" stopColor="#58c9ff"/><stop offset="100%" stopColor="#1761d8"/></linearGradient></defs><path d="M25 2 39 11 47 26 36 43 18 48 4 34 3 17Z" fill="url(#movingStoneFill)" stroke="#d9f7ff" strokeWidth="2"/><path d="M25 2 25 25 39 11Z" fill="#e8fcff" opacity=".82"/><path d="M25 25 47 26 36 43Z" fill="#0e48b5" opacity=".58"/><path d="m25 10 3.2 9.1 9.6.3-7.6 5.8 2.8 9.2-8-5.5-8 5.5 2.8-9.2-7.6-5.8 9.6-.3Z" fill="#fff8c9" stroke="#fff" strokeWidth=".8"/></svg></div>;})}
   </div>
  </section>
  
 </main>;
}
