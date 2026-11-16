"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function ProfileMenu() {
 const [busy,setBusy]=useState(false);
 async function logout(){
  if(busy)return;
  setBusy(true);
  const sb=createClient();
  await sb.auth.signOut();
  window.location.href="/GEMS/login/";
 }
 return <div className="profile-menu">
  <details>
   <summary>Profile <span className="profile-menu-arrow">⌄</span></summary>
   <div className="profile-menu-dropdown">
    <Link href="/profile/">Account overview</Link>
    <Link href="/profile/#recharge">Recharge GEMS</Link>
    <Link href="/profile/#withdraw">Withdraw GEMS</Link>
    <Link href="/profile/#transactions">Transaction history</Link>
    <button type="button" className="profile-menu-logout" disabled={busy} onClick={()=>void logout()}>{busy?"Signing out…":"Log out"}</button>
   </div>
  </details>
 </div>;
}
