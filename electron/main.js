// Electron wrapper for the PS-S03 Wi-Fi Diagnostic agent.
// This file intentionally uses CommonJS (not ESM) since the rest of the project uses
// Node's native TS stripping — Electron's main process must be plain JS.
//
// What this does (~30 lines of actual logic):
//   1. Spawns the agent (agent/server.ts) as a child process.
//   2. Spawns the backend (backend/server.ts) as a child process.
//   3. Opens a BrowserWindow pointing at localhost:4100 once both are ready.
//   4. Cleans up child processes on window close.

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NODE = process.execPath.replace("electron.exe", "node.exe").replace(/electron$/i, "node");

let agentProc = null;
let backendProc = null;
let win = null;

function spawnNode(script, label) {
  const proc = spawn(NODE, [script], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env },
  });
  proc.on("error", (err) => console.error(`[${label}] spawn error:`, err));
  proc.on("exit", (code) => console.log(`[${label}] exited with code ${code}`));
  return proc;
}

function waitForPort(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const { createConnection } = require("net");
    const tryConnect = () => {
      const sock = createConnection({ host: "127.0.0.1", port }, () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (++attempts >= maxAttempts) {
          reject(new Error(`Port ${port} did not open after ${maxAttempts} attempts`));
          return;
        }
        setTimeout(tryConnect, 1000);
      });
    };
    tryConnect();
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "NetWatch — Wi-Fi Diagnostic",
    backgroundColor: "#0d1015",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Open external links in the system browser, not the Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.once("ready-to-show", () => win.show());

  win.on("closed", () => {
    win = null;
    if (agentProc) agentProc.kill();
    if (backendProc) backendProc.kill();
  });

  // Wait for agent to be ready, then load
  try {
    await waitForPort(4100);
    win.loadURL("http://localhost:4100");
  } catch (err) {
    console.error("[electron] agent did not start in time:", err);
    win.loadURL("about:blank");
    win.webContents.executeJavaScript(
      `document.body.innerHTML='<div style="font-family:sans-serif;padding:32px;color:#ff6b6b"><h2>Agent failed to start</h2><p>${err.message}</p></div>'`
    );
    win.show();
  }
}

app.whenReady().then(() => {
  // Spawn the two Node processes before opening the window
  backendProc = spawnNode("backend/server.ts", "backend");
  agentProc   = spawnNode("agent/server.ts",   "agent");

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (agentProc)   agentProc.kill();
  if (backendProc) backendProc.kill();
  if (process.platform !== "darwin") app.quit();
});
