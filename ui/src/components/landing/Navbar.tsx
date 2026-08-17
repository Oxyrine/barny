import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export function Navbar() {
  const links = [
    { label: "Platform", path: "#" },
    { label: "How it works", path: "#" },
    { label: "AI Defense", path: "#" },
    { label: "Connections", path: "#" },
    { label: "Insights", path: "#" },
  ];

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 w-full pt-6 px-6 sm:px-12 pointer-events-none"
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between pointer-events-auto">
        
        {/* Left: Minimalist Logo */}
        <Link to="/" className="flex items-center">
          <span className="text-xl font-medium tracking-widest text-white">LORIX</span>
        </Link>

        {/* Center: Rounded Pill Menu */}
        <div className="hidden lg:flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0a0a]/80 p-1.5 backdrop-blur-xl shadow-2xl">
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className="rounded-full px-5 py-2 text-sm text-[#888888] transition-colors hover:text-white hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Sleek CTA */}
        <div className="flex items-center">
          <Link
            to="/dashboard"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
          >
            Join the wait
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
