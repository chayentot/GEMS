import Link from "next/link";
import styles from "./page.module.css";

const stones = [
  "Star Crystal",
  "Nebulite",
  "Sol Crystal",
  "Meteorite Gem",
  "Eternyx",
  "Lunarium",
  "Voidstone",
  "Prismora",
  "Divinestone",
  "Genesis Core",
];

export default function TycoonMenuPage() {
  return (
    <main className={styles.stage}>
      <div className={styles.canvas}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandMark}>✦</span> GEMS TYCOON</div>
          <nav className={styles.siteNav} aria-label="Main navigation">
            <Link href="/dashboard/">Dashboard</Link>
            <Link href="/mining/">Mining</Link>
            <Link href="/tycoon/" aria-current="page">Gems Tycoon</Link>
            <Link href="/referral/">Referral</Link>
            <Link href="/market/">Market</Link>
            <Link href="/profile/">Profile</Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>A COSMIC MINING ADVENTURE</p>
          <h1>GEMS <span>TYCOON</span></h1>
          <p className={styles.tagline}>Mine. Build. Discover.</p>
          <div className={styles.crystalStage} aria-label="Star Crystal emblem">
            <div className={styles.crystalGlow} />
            <div className={styles.crystal}>✦</div>
            <div className={styles.crystalName}>STAR CRYSTAL</div>
          </div>
          <p className={styles.intro}>Begin with a single crystal. Build your way toward the rarest stone in the universe.</p>
        </section>

        <nav className={styles.menu} aria-label="Game menu">
          <a className={styles.primaryButton} href="#start">▶ <span>START GAME</span></a>
          <a className={styles.menuButton} href="#collection">◇ <span>STONE COLLECTION</span></a>
          <a className={styles.menuButton} href="#how-to-play">☷ <span>HOW TO PLAY</span></a>
        </nav>

        <section className={styles.previewPanel} id="start">
          <div className={styles.panelHeading}>
            <span>YOUR JOURNEY</span>
            <span className={styles.status}>COMING SOON</span>
          </div>
          <h2>Your mining empire<br />starts here.</h2>
          <p>The game world and factory gameplay will be added after the menu design is approved.</p>
        </section>

        <section className={styles.collection} id="collection">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>THE COSMIC COLLECTION</p><h2>10 legendary stones</h2></div>
            <span className={styles.count}>10 STONES</span>
          </div>
          <div className={styles.stoneList}>
            {stones.map((stone, index) => (
              <div className={styles.stoneRow} key={stone}>
                <span className={styles.stoneNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.stoneIcon}>{index === 9 ? "✹" : "✦"}</span>
                <span className={styles.stoneName}>{stone}</span>
                <span className={styles.lock}>{index === 0 ? "FIRST" : "LOCKED"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.howTo} id="how-to-play">
          <p className={styles.eyebrow}>THE GOAL</p>
          <h2>Reach the Genesis Core.</h2>
          <p>Discover all ten cosmic stones and work toward the ultimate material.</p>
        </section>

        <footer className={styles.footer}>
          <span>GEMS TYCOON</span>
          <span>1360 × 2000 GAME CANVAS</span>
        </footer>
      </div>
    </main>
  );
}
