#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const HTTP_API = "http://localhost:4000";

async function sendCommand(command: string): Promise<any> {
  const res = await fetch(`${HTTP_API}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  return res.json();
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${HTTP_API}/health`);
    const data = (await res.json()) as { ueConnected?: boolean };
    return data.ueConnected === true;
  } catch {
    return false;
  }
}

const server = new McpServer({ name: "unreal-mcp", version: "1.0.0" });

server.tool("ue_status", "Check UE connection status", {}, async () => {
  const connected = await checkHealth();
  return {
    content: [
      { type: "text", text: connected ? "UE connected" : "UE not connected" },
    ],
  };
});

server.tool("ue_play", "Start PIE", {}, async () => {
  try {
    await sendCommand("pie.play");
    return { content: [{ type: "text", text: "PIE starting" }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

server.tool("ue_stop", "Stop PIE", {}, async () => {
  try {
    await sendCommand("pie.stop");
    return { content: [{ type: "text", text: "PIE stopping" }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

server.tool("ue_pie_status", "Get PIE status", {}, async () => {
  try {
    const result = await sendCommand("pie.status");
    return { content: [{ type: "text", text: result.message || "unknown" }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

server.tool(
  "ue_exec",
  "Execute UE console command",
  { command: z.string() },
  async ({ command }) => {
    try {
      await sendCommand(command);
      return { content: [{ type: "text", text: `Sent: ${command}` }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
  }
);

server.tool("ue_logs", "Get recent UE logs", {}, async () => {
  try {
    const res = await fetch(`${HTTP_API}/logs`);
    const data = (await res.json()) as { logs: string[] };
    const logs = data.logs.slice(-20).join("\n") || "No logs";
    return { content: [{ type: "text", text: logs }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {});
