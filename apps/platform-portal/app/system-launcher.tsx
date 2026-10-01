"use client";

import { useEffect, useState } from "react";

type OicState = "checking" | "online" | "offline";

export function SystemLauncher() {
  const [oicState, setOicState] = useState<OicState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/oic-status", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((body: { available?: boolean }) => setOicState(body.available ? "online" : "offline"))
      .catch(() => setOicState("offline"));
    return () => controller.abort();
  }, []);

  return (
    <div className="system-grid">
      <article className="system-card responix-card">
        <div className="card-topline"><span className="system-index">01</span><span className="system-kind">CUSTOMER EXPERIENCE</span></div>
        <div className="card-content">
          <h2>Responix</h2>
          <p>Customer Experience &amp; Automation</p>
        </div>
        <a className="open-link" href={process.env.NEXT_PUBLIC_RESPONIX_URL ?? "http://localhost:3001"}>
          <span>Open System</span><span className="arrow" aria-hidden="true">↗</span>
        </a>
      </article>

      <article className="system-card oic-card">
        <div className="card-topline"><span className="system-index">02</span><span className="system-kind">INTELLIGENCE</span></div>
        <div className="card-content">
          <h2>OIC</h2>
          <p>Oi Intelligence Core</p>
        </div>
        <div className="oic-card-bottom">
          <a className="open-link" href="/oic"><span>Open System</span><span className="arrow" aria-hidden="true">↗</span></a>
          <span className={`status status-${oicState}`} aria-live="polite">
            <i aria-hidden="true" /> OIC API {oicState === "checking" ? "CHECKING" : oicState.toUpperCase()}
          </span>
        </div>
      </article>
    </div>
  );
}
