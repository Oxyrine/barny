// Override at build/dev time with VITE_BACKEND_URL if the ISP backend isn't on localhost:4000
// (e.g. a packaged build, or a demo machine with a different port layout).
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";
