#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./db.js";
import { registerResources } from "./resources.js";
import { registerArtifactTools } from "./tools/artifacts.js";
import { registerDiagramTools } from "./tools/diagrams.js";
import { registerTroubleshootingTools } from "./tools/troubleshooting.js";

getDb();

const server = new McpServer({
  name: "planview",
  version: "2.0.0",
});

registerDiagramTools(server);
registerTroubleshootingTools(server);
registerArtifactTools(server);
registerResources(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PlanView MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
