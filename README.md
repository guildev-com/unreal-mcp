# Unreal MCP

Remote control for Unreal Engine via Model Context Protocol (MCP). Allows AI assistants like Windsurf to control PIE (Play In Editor) and execute console commands.

## Architecture

```
Windsurf (MCP stdio) → HTTP API → CLI Server → WebSocket ← UE Plugin
```

- **CLI Server** (`index.ts`): Hosts WebSocket (port 8081) + HTTP API (port 4000) + interactive CLI
- **MCP Server** (`mcp-stdio.ts`): Stdio transport for Windsurf, calls CLI server via HTTP
- **UE Plugin**: Connects to WebSocket, executes commands, streams logs

## Setup

### 1. Install & Build MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Install UE Plugin

Copy the `Plugins/MCP` folder to your Unreal project's `Plugins` directory, then rebuild.

### 3. Configure Windsurf

Add to `~/.codeium/windsurf/mcp_config.json` (or `%USERPROFILE%\.codeium\windsurf\mcp_config.json` on Windows):

```json
{
  "mcpServers": {
    "unreal": {
      "command": "node",
      "args": ["C:\\path\\to\\unreal-mcp\\mcp-server\\dist\\mcp-stdio.js"]
    }
  }
}
```

### 4. Run

1. Start CLI server: `npm start` (keep running)
2. Open Unreal Editor (plugin auto-connects)
3. Restart Windsurf

## MCP Tools

| Tool            | Description                    |
| --------------- | ------------------------------ |
| `ue_status`     | Check UE connection status     |
| `ue_play`       | Start PIE mode                 |
| `ue_stop`       | Stop PIE mode                  |
| `ue_pie_status` | Get current PIE status         |
| `ue_exec`       | Execute any UE console command |
| `ue_logs`       | Get recent UE logs             |

## CLI Commands

When running `npm start`:

| Command  | Description                   |
| -------- | ----------------------------- |
| `play`   | Start PIE                     |
| `stop`   | Stop PIE                      |
| `status` | Get PIE status                |
| `<any>`  | Send as console command to UE |

## Configuration

- **WebSocket Port**: 8081 (change in `index.ts` and `MCPSubsystem.h`)
- **HTTP API Port**: 4000 (change in `index.ts` and `mcp-stdio.ts`)

## Notes

- Remove or disable the plugin for release builds
- The CLI server must be running for Windsurf MCP integration to work
- Logs are stored in memory (last 100 entries)
