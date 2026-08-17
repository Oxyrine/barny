import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import History from "./pages/History.tsx";
import Tickets from "./pages/Tickets.tsx";
import Settings from "./pages/Settings.tsx";
import ISPAgentView from "./pages/ISPAgentView.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "history", element: <History /> },
      { path: "tickets", element: <Tickets /> },
      { path: "isp", element: <ISPAgentView /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
