import express from "express";
import bodyParser from "body-parser";
import { WebSocketServer, WebSocket } from "ws";
import readline from "readline";

type UEMessage = {
  type: "log" | "info" | "error" | "meta";
  payload: any;
  ts?: string;
};

type CommandMessage = {
  type: "command";
  payload: {
    command: string; // text to execute inside Unreal (Exec)
    id?: string; // optional id to correlate responses
  };
};

const WS_PORT = 8081;
const API_PORT = 4000;

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<WebSocket>();

wss.on("connection", (socket, req) => {
  console.log(`UE connected from ${req.socket.remoteAddress}`);
  clients.add(socket);

  socket.on("message", (data) => {
    try {
      const text = data.toString();
      // Expect JSON messages from UE
      const obj = JSON.parse(text) as UEMessage;
      const time = obj.ts ?? new Date().toISOString();
      console.log(`[UE ${time}] ${obj.type.toUpperCase()}:`, obj.payload);
    } catch (err) {
      // If message not JSON, print raw
      console.log("[UE RAW]:", data.toString());
    }
  });

  socket.on("close", () => {
    console.log("UE disconnected");
    clients.delete(socket);
  });

  socket.on("error", (err) => {
    console.error("UE socket error:", err);
    clients.delete(socket);
  });
});

function broadcastCommand(command: string, id?: string) {
  const msg: CommandMessage = {
    type: "command",
    payload: {
      command,
      id,
    },
  };
  const text = JSON.stringify(msg);
  for (const c of clients) {
    if (c.readyState === c.OPEN) {
      c.send(text);
    }
  }
  console.log(`[MCP] Sent command to ${clients.size} client(s):`, command);
}

// Simple REST API so other tools / AI can POST commands
const app = express();
app.use(bodyParser.json());

app.post("/command", (req, res) => {
  const command = req.body?.command;
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "missing 'command' string in body" });
  }
  broadcastCommand(command, req.body?.id);
  res.json({ status: "ok", sentTo: clients.size });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", wsClients: clients.size });
});

app.listen(API_PORT, () => {
  console.log(`MCP API listening on http://localhost:${API_PORT}`);
  console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);
});

// Optional interactive CLI to type commands to UE
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.setPrompt("mcp> ");
rl.prompt();

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    rl.prompt();
    return;
  }
  if (trimmed === "clients") {
    console.log("Connected clients:", clients.size);
    rl.prompt();
    return;
  }
  if (trimmed === "exit" || trimmed === "quit") {
    console.log("Exiting MCP server...");
    process.exit(0);
  }
  // Broadcast input line as command
  broadcastCommand(trimmed);
  rl.prompt();
});
