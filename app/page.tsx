import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar"><div className="brand">💎 GEMS MINING</div><Link href="/login">Player Login</Link></header>
      <section className="panel" style={{padding:"clamp(24px,6vw,60px)"}}>
        <p className="muted">YOUR GEMSTONE JOURNEY STARTS HERE</p>
        <h1>Mine gemstones.<br/><span style={{color:"var(--gold)"}}>Earn GEMS.</span></h1>
        <p className="muted" style={{maxWidth:650,lineHeight:1.7}}>
          Manage your gemstone collection, mining cycles and GEMS wallet from one account.
          Mining rewards are calculated by secure database functions.
        </p>
        <div className="row" style={{justifyContent:"flex-start",marginTop:24}}>
          <Link href="/login"><button>Get Started</button></Link>
          <Link href="/login" className="muted">Already have an account? Sign in</Link>
        </div>
      </section>
      <section className="grid section">
        <div className="panel"><h3>⛏️ Automatic mining</h3><p className="small">A mining cycle can run for up to 24 hours. Collect your available reward when you are ready.</p></div>
        <div className="panel"><h3>💰 GEMS wallet</h3><p className="small">View your balance and transaction history. One GEMS is valued at ₱1 for the platform's accounting.</p></div>
        <div className="panel"><h3>🔐 Account security</h3><p className="small">Supabase authentication, row-level security and database-side transaction checks.</p></div>
      </section>
      <p className="small section">Important: GEMS is an internal platform token in this starter. Real-money recharge and withdrawals require a configured payment/payout provider, legal review and operational approval before launch.</p>
    </main>
  );
}
