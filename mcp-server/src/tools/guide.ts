import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildPlanViewGuide, GUIDE_TOPICS, type GuideTopic } from "../guide.js";
import { registerJsonTool } from "../toolkit.js";

export function registerGuideTools(server: McpServer): void {
  registerJsonTool(
    server,
    "get_planview_guide",
    {
      title: "Get PlanView Guide",
      description:
        "Start here when you need workflow help. Explains which tools to call, which IDs to discover first, what each metadata field means, and includes sample payloads for diagrams, investigations, artifacts, and patterns.",
      inputSchema: {
        topic: z
          .enum(GUIDE_TOPICS)
          .optional()
          .describe(
            "Optional focus area: `all`, `diagrams`, `metadata`, `investigations`, `artifacts`, or `patterns`."
          ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    ({ topic }: { topic?: GuideTopic }) => buildPlanViewGuide(topic ?? "all")
  );
}
