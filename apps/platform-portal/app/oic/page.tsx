import Link from "next/link";

export default function OicPendingPage() {
  return (
    <main className="page-shell pending-shell">
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="Oi Smart Solutions home">
          <span className="oi-mark" aria-hidden="true"><i /><i /></span>
          <span>Oi <span className="wordmark-light">Smart Solutions</span></span>
        </Link>
        <span className="topbar-label">OIC · CONSOLE</span>
      </header>
      <section className="pending-content">
        <div className="eyebrow"><span className="eyebrow-line" /> OI INTELLIGENCE CORE</div>
        <h1>Console installation<br />pending<span className="title-period">.</span></h1>
        <p>The OIC Console is not installed yet. The OIC API runs independently and its current readiness is shown on the platform launcher.</p>
        <Link className="back-link" href="/">← <span>Back to Mega Platform</span></Link>
      </section>
      <footer className="footer"><span>OI SMART SOLUTIONS</span><span>OIC CONSOLE · NOT YET INSTALLED</span></footer>
    </main>
  );
}
