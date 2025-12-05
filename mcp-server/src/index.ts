import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import readline from "readline";

const WS_PORT = 8081;
const HTTP_PORT = 4000;

let wss: WebSocketServer | null = null;
let ueSocket: WebSocket | null = null;
let ueConnected = false;
const recentLogs: string[] = [];
const MAX_LOGS = 100;

function setUEConnection(socket: WebSocket | null) {
  ueSocket = socket;
  ueConnected = socket !== null;
}

function getUEConnected() {
  return ueConnected;
}

function sendCommand(command: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ueSocket || ueSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("UE not connected"));
      return;
    }
    ueSocket.send(JSON.stringify({ type: "command", payload: { command } }));
    resolve({ success: true, message: "sent" });
  });
}

function startWSServer() {
  if (wss) return;

  wss = new WebSocketServer({ port: WS_PORT });
  console.log(`[MCP] WebSocket server on ws://localhost:${WS_PORT}`);

  wss.on("connection", (socket) => {
    console.log("[UE] connected");
    setUEConnection(socket);

    socket.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.type === "log") {
          console.log(`[UE] ${data.payload}`);
          recentLogs.push(data.payload);
          if (recentLogs.length > MAX_LOGS) recentLogs.shift();
        }

        if (data.type === "response") {
          console.log(`[UE] Response: ${data.command} → ${data.message}`);
        }
      } catch {}
    });

    socket.on("close", () => {
      console.log("[UE] disconnected");
      setUEConnection(null);
    });
  });
}

function startHTTPServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && req.url === "/health") {
      res.end(JSON.stringify({ status: "ok", ueConnected: getUEConnected() }));
      return;
    }

    if (req.method === "GET" && req.url === "/logs") {
      res.end(JSON.stringify({ logs: recentLogs }));
      return;
    }

    if (req.method === "POST" && req.url === "/command") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", async () => {
        try {
          const { command } = JSON.parse(body);
          const result = await sendCommand(command);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
      return;
    }

    res.end(JSON.stringify({ ok: true }));
  });

  server.listen(HTTP_PORT, () => {
    console.log(`[MCP] HTTP API running on http://localhost:${HTTP_PORT}`);
  });
}

async function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.setPrompt("mcp> ");
  rl.prompt();

  rl.on("line", async (line) => {
    const cmd = line.trim();
    if (!cmd) return rl.prompt();

    if (!getUEConnected()) {
      console.log("UE not connected");
      return rl.prompt();
    }

    const result = await sendCommand(cmd);
    console.log(`Sent: ${cmd}`);

    rl.prompt();
  });
}

// MAIN (CLI MODE)
startWSServer();
startHTTPServer();
startCLI();
