"use client";

const colors:Record<string,string>={GARNET:"#c83b54",MOONSTONE:"#b8c8dc",BLACK_OPAL:"#6e5bb5",AQUAMARINE:"#39c8c5",TOPAZ:"#e9ad45",AMETHYST:"#a779dc",EMERALD:"#39b879",SAPPHIRE:"#3988dc",RUBY:"#e34451",DIAMOND:"#dce9f4"};

export default function GemArt({code,size=92}:{code:string;size?:number}) {
  const color=colors[code]||"#b8c8dc";
  const id="gem-"+code.toLowerCase().replace(/[^a-z0-9]/g,"-");
  return <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={code+" gemstone"} style={{display:"block",filter:"drop-shadow(0 8px 12px #0007)"}}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff"/><stop offset="35%" stopColor={color}/><stop offset="100%" stopColor="#101a2c"/></linearGradient>
      <linearGradient id={id+"shine"} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".8"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></linearGradient>
    </defs>
    <path d="M25 10 75 10 94 34 50 92 6 34Z" fill={"url(#"+id+")"} stroke="#fff" strokeOpacity=".8" strokeWidth="2.5"/>
    <path d="M25 10 37 34 6 34 M75 10 63 34 94 34 M37 34 50 92 63 34 M25 10 75 10 63 34 37 34Z" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2"/>
    <path d="M25 10 37 34 50 18 75 10 63 34Z" fill={"url(#"+id+"shine)"}/>
    <path d="M6 34 37 34 50 92Z" fill="#fff" opacity=".12"/>
  </svg>;
}
