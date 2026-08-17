import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

export default function RootLayout() {
  const location = useLocation();

  // We only want to animate the top-level route changes (Landing <-> Dashboard)
  // Inside the dashboard, we don't necessarily want huge crossfades for every tab click,
  // so we key by the root path segment.
  const routeKey = location.pathname.startsWith("/dashboard") ? "dashboard" : "landing";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="h-full w-full"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
