import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

interface TicketPayload {
  severity: string;
  churnRisk: boolean;
}

export default function Landing() {
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    active: 0,
    critical: 0,
    atRisk: 0,
    uptime: 99.9
  });

  useEffect(() => {
    fetch("http://localhost:4000/agent/queue")
      .then(res => res.json())
      .then((data: TicketPayload[]) => {
        const critical = data.filter(t => t.severity === "Critical").length;
        const atRisk = data.filter(t => t.churnRisk).length;
        setStats({
          active: data.length,
          critical,
          atRisk,
          uptime: 99.9
        });
      })
      .catch(err => console.error("Failed to fetch stats:", err));
  }, []);

  useEffect(() => {
    // Number animation logic
    const duration = 2000;
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);
    let observers: IntersectionObserver[] = [];

    const easeOutExpo = (t: number) => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    numRefs.current.forEach((el) => {
      if (!el) return;
      const targetVal = parseFloat(el.getAttribute("data-val") || "0");
      const isFloat = targetVal % 1 !== 0;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            let frame = 0;
            const counter = setInterval(() => {
              frame++;
              const progress = easeOutExpo(frame / totalFrames);
              const currentVal = targetVal * progress;

              if (isFloat) {
                el.innerText = currentVal.toFixed(1);
              } else {
                el.innerText = Math.round(currentVal).toString();
              }

              if (frame === totalFrames) {
                clearInterval(counter);
                el.innerText = targetVal.toString();
              }
            }, frameRate);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [stats]); // Re-run animation when stats load

  return (
    <div className={`landing-wrapper ${menuOpen ? "menu-open" : ""}`}>
      <div className="bg">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      <div className="page">
        {/* Header */}
        <header className="header anim" style={{ "--d": "0s" } as React.CSSProperties}>

          <nav className="nav-pill desktop-only">
            <Link to="/" className="active">Home</Link>
            <Link to="/dashboard/tickets">Tickets</Link>
            <Link to="/dashboard/history">History</Link>
            <Link to="/dashboard/isp">ISP View</Link>
          </nav>
          
          <Link to="/dashboard" className="btn-signin desktop-only">Dashboard</Link>

          <button 
            className="burger mobile-only" 
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </header>

        {/* Hero */}
        <div className="hero">
          <div className="trust-row anim" style={{ "--d": "0.15s" } as React.CSSProperties}>
            <div className="avatars">
              <div className="avatar a1">
                <i>✦</i>
              </div>
              <div className="avatar a2">
                <i>●</i>
              </div>
              <div className="avatar a3">
                <i>▲</i>
              </div>
            </div>
            <div className="trust-pill">
              Trusted by 10,000+ Teams
            </div>
          </div>

          <h1 className="headline text-center">
            <span className="anim" style={{ "--d": "0.3s" } as React.CSSProperties}>Intelligence</span>
            <span className="anim" style={{ "--d": "0.45s" } as React.CSSProperties}>Designed To Evolve</span>
          </h1>

          <p className="subhead anim" style={{ "--d": "0.6s" } as React.CSSProperties}>
            A unified interface for managing complex data flows. Transform noise into clear signals with real-time adaptive systems.
          </p>

          <Link to="/dashboard" className="btn-cta anim" style={{ "--d": "0.75s" } as React.CSSProperties}>
            Get Started Free
          </Link>
        </div>

        {/* Stats */}
        <div className="stats desktop-break">
          <div className="stat-col anim" style={{ "--d": "0.9s" } as React.CSSProperties}>
            <div className="stat-val">
              <span className="icon">✦</span>
              <span className="num" data-val={stats.active} ref={(el) => (numRefs.current[0] = el)}>0</span>
            </div>
            <span className="stat-label">Active Tickets</span>
          </div>

          <div className="stat-col anim" style={{ "--d": "1s" } as React.CSSProperties}>
            <div className="stat-val">
              <span className="icon">●</span>
              <span className="num" data-val={stats.critical} ref={(el) => (numRefs.current[1] = el)}>0</span>
            </div>
            <span className="stat-label">Critical Issues</span>
          </div>

          <div className="stat-col anim" style={{ "--d": "1.1s" } as React.CSSProperties}>
            <div className="stat-val">
              <span className="icon">▲</span>
              <span className="num" data-val={stats.atRisk} ref={(el) => (numRefs.current[2] = el)}>0</span>
            </div>
            <span className="stat-label">At-Risk Networks</span>
          </div>

          <div className="stat-col anim" style={{ "--d": "1.2s" } as React.CSSProperties}>
            <div className="stat-val">
              <span className="icon">◈</span>
              <span className="num" data-val={stats.uptime} ref={(el) => (numRefs.current[3] = el)}>0</span>
              <span className="suffix">%</span>
            </div>
            <span className="stat-label">System Uptime</span>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`mobile-overlay ${!menuOpen ? "hidden" : ""}`} 
        onClick={() => setMenuOpen(false)}
      ></div>
      <div className={`mobile-menu ${!menuOpen ? "hidden" : ""}`}>
        <nav className="mobile-nav">
          <Link to="/" onClick={() => setMenuOpen(false)}>
            Home
            <div className="active-dot"></div>
          </Link>
          <Link to="/dashboard/tickets" onClick={() => setMenuOpen(false)}>Tickets</Link>
          <Link to="/dashboard/history" onClick={() => setMenuOpen(false)}>History</Link>
          <Link to="/dashboard/isp" onClick={() => setMenuOpen(false)}>ISP View</Link>
          <Link to="/dashboard" className="btn-signin" onClick={() => setMenuOpen(false)}>Dashboard</Link>
        </nav>
      </div>
    </div>
  );
}
