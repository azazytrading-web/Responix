import { SystemLauncher } from "./system-launcher";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Oi Smart Solutions home">
          <span className="oi-mark" aria-hidden="true"><i /><i /></span>
          <span>Oi <span className="wordmark-light">Smart Solutions</span></span>
        </a>
        <span className="topbar-label">MEGA PLATFORM</span>
      </header>

      <section className="launcher" aria-labelledby="page-title">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR SYSTEMS <span className="eyebrow-count">02</span></div>
        <h1 id="page-title">Mega Platform<span className="title-period">.</span></h1>
        <p className="intro">One place to enter your Oi systems.</p>
        <SystemLauncher />
      </section>

      <footer className="footer"><span>OI SMART SOLUTIONS</span><span>INDEPENDENT SYSTEMS · ONE PLATFORM</span></footer>
    </main>
  );
}
