import styles from "./page.module.css";

export default function TycoonMenuPage() {
  return (
    <main className={styles.stage}>
      <div
        className={styles.canvas}
        role="img"
        aria-label="Blank GEMS Tycoon layout grid, 17 columns by 25 rows, each cell 60 by 60 pixels"
      />
    </main>
  );
}
