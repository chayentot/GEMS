"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [username,setUsername] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } }
        });
        if (error) throw error;
        setMessage("Account created. Check your email if email confirmation is enabled, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dashboard/`;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">💎 GEMS MINING</Link><Link href="/">Home</Link></header>
    <section className="panel" style={{maxWidth:520,margin:"40px auto"}}>
      <h1>{mode === "login" ? "Welcome back" : "Create account"}</h1>
      <p className="muted">Use your email and password to access your player account.</p>
      <div className="row section">
        <button className={mode==="login" ? "" : "secondary"} onClick={()=>{setMode("login");setMessage("");}}>Sign in</button>
        <button className={mode==="signup" ? "" : "secondary"} onClick={()=>{setMode("signup");setMessage("");}}>Register</button>
      </div>
      <form onSubmit={submit} className="section">
        {mode==="signup" && <><label>Username</label><input value={username} onChange={e=>setUsername(e.target.value)} required minLength={3} maxLength={24} placeholder="Your player name"/></>}
        <label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
        <label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==="login"?"current-password":"new-password"}/>
        <button disabled={busy} type="submit">{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
      </form>
      {message && <div className="notice">{message}</div>}
      <p className="small">Use a unique password. Email confirmation settings are controlled in your Supabase project.</p>
    </section>
  </main>;
}
