import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import History from "./pages/History.tsx";
import Tickets from "./pages/Tickets.tsx";
import Settings from "./pages/Settings.tsx";
import ISPAgentView from "./pages/ISPAgentView.tsx";

import Landing from "./pages/Landing.tsx";

import RootLayout from "./RootLayout.tsx";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <Landing />,
      },
      {
        path: "/dashboard",
        element: <App />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "history", element: <History /> },
          { path: "tickets", element: <Tickets /> },
          { path: "isp", element: <ISPAgentView /> },
          { path: "settings", element: <Settings /> },
        ],
      },
    ],
  },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </React.StrictMode>,
);
