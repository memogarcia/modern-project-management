/**
 * End-to-end test: creates a complex microservices architecture diagram
 * through the MCP server using the stdio transport.
 *
 * Run:  npx tsx src/__tests__/e2e-complex-diagram.test.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────

/** Call a tool and return the parsed JSON text content */
async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ parsed: unknown; raw: string; isError?: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const textContent = (result.content as Array<{ type: string; text: string }>).find(
    (c) => c.type === "text"
  );
  assert(textContent, `Tool '${name}' returned no text content`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent.text);
  } catch {
    parsed = textContent.text;
  }
  return { parsed, raw: textContent.text, isError: !!result.isError };
}

// ── Main test ────────────────────────────────────────────────────────

async function runTest() {
  // Use a temp directory for diagram storage so tests are isolated
  const tmpDir = path.join(__dirname, `../../.test-data-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: { ...process.env, PLANVIEW_DB: path.join(tmpDir, "test.db") },
  });

  const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Verify tools are available ────────────────────────
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    console.log("Available tools:", toolNames.join(", "));

    for (const expected of [
      "list_diagrams",
      "get_diagram",
      "create_diagram",
      "update_diagram",
      "delete_diagram",
      "add_node_to_diagram",
      "add_edge_to_diagram",
    ]) {
      assert(toolNames.includes(expected), `Missing tool: ${expected}`);
    }
    console.log("✔ All expected tools registered\n");

    // ── Step 2: Create a complex microservices diagram ────────────
    const initialMermaid = `graph TD`;

    const { parsed: createResult } = await callTool(client, "create_diagram", {
      name: "E-Commerce Platform",
      description:
        "Complex microservices architecture for an e-commerce platform with API gateway, services, databases, caches, and message queues",
      mermaidCode: initialMermaid,
    });

    const diagramId = (createResult as { id: string }).id;
    assert(diagramId, "Diagram ID should be returned");
    console.log(`✔ Created diagram: ${diagramId}`);

    // ── Step 3: Add all nodes (services, databases, caches, etc.) ─
    const nodes = [
      { nodeId: "client_web", label: "Web App", shapeType: "client", description: "React SPA" },
      { nodeId: "client_mobile", label: "Mobile App", shapeType: "client", description: "iOS / Android" },
      { nodeId: "api_gateway", label: "API Gateway", shapeType: "gateway", description: "Kong / NGINX" },
      { nodeId: "auth_service", label: "Auth Service", shapeType: "service", description: "JWT + OAuth2" },
      { nodeId: "user_service", label: "User Service", shapeType: "service" },
      { nodeId: "product_service", label: "Product Service", shapeType: "service" },
      { nodeId: "order_service", label: "Order Service", shapeType: "service" },
      { nodeId: "payment_service", label: "Payment Service", shapeType: "service" },
      { nodeId: "notification_svc", label: "Notification Service", shapeType: "service" },
      { nodeId: "search_service", label: "Search Service", shapeType: "service", description: "Elasticsearch" },
      { nodeId: "inventory_fn", label: "Inventory Check", shapeType: "function", description: "Lambda" },
      { nodeId: "user_db", label: "User DB", shapeType: "database", description: "PostgreSQL" },
      { nodeId: "product_db", label: "Product DB", shapeType: "database", description: "PostgreSQL" },
      { nodeId: "order_db", label: "Order DB", shapeType: "database", description: "PostgreSQL" },
      { nodeId: "redis_cache", label: "Redis Cache", shapeType: "cache", description: "Session + Product cache" },
      { nodeId: "event_bus", label: "Event Bus", shapeType: "queue", description: "Kafka" },
      { nodeId: "s3_storage", label: "Object Storage", shapeType: "storage", description: "S3 / MinIO" },
      { nodeId: "cdn_cloud", label: "CDN", shapeType: "cloud", description: "CloudFront" },
    ] as const;

    for (const node of nodes) {
      const { parsed } = await callTool(client, "add_node_to_diagram", {
        id: diagramId,
        ...node,
      });
      const msg = (parsed as { message: string }).message;
      assert(msg.includes(node.nodeId), `Node '${node.nodeId}' not acknowledged`);
    }
    console.log(`✔ Added ${nodes.length} nodes\n`);

    // ── Step 4: Add edges (connections between services) ──────────
    const edges = [
      // Client → Gateway
      { source: "client_web", target: "cdn_cloud", label: "HTTPS" },
      { source: "client_mobile", target: "api_gateway", label: "HTTPS" },
      { source: "cdn_cloud", target: "api_gateway", label: "Origin" },

      // Gateway → Services
      { source: "api_gateway", target: "auth_service", label: "Auth" },
      { source: "api_gateway", target: "user_service", label: "REST" },
      { source: "api_gateway", target: "product_service", label: "REST" },
      { source: "api_gateway", target: "order_service", label: "REST" },
      { source: "api_gateway", target: "search_service", label: "REST" },

      // Service → Database
      { source: "auth_service", target: "user_db", label: "SQL" },
      { source: "user_service", target: "user_db", label: "SQL" },
      { source: "product_service", target: "product_db", label: "SQL" },
      { source: "order_service", target: "order_db", label: "SQL" },

      // Cache layer
      { source: "auth_service", target: "redis_cache", label: "Session" },
      { source: "product_service", target: "redis_cache", label: "Cache" },

      // Event-driven flows
      { source: "order_service", target: "event_bus", label: "OrderPlaced" },
      { source: "event_bus", target: "payment_service", label: "Subscribe" },
      { source: "event_bus", target: "notification_svc", label: "Subscribe" },
      { source: "event_bus", target: "inventory_fn", label: "Trigger" },

      // Payment → Notification
      { source: "payment_service", target: "notification_svc", label: "PaymentResult" },

      // Static assets
      { source: "product_service", target: "s3_storage", label: "Images" },
      { source: "cdn_cloud", target: "s3_storage", label: "Static" },

      // Search indexing
      { source: "product_service", target: "search_service", label: "Index" },
    ];

    for (const edge of edges) {
      const { parsed } = await callTool(client, "add_edge_to_diagram", {
        id: diagramId,
        ...edge,
      });
      const msg = (parsed as { message: string }).message;
      assert(
        msg.includes(edge.source) && msg.includes(edge.target),
        `Edge ${edge.source} -> ${edge.target} not acknowledged`
      );
    }
    console.log(`✔ Added ${edges.length} edges\n`);

    // ── Step 5: Retrieve and validate the full diagram ────────────
    const { parsed: fullDiagram } = await callTool(client, "get_diagram", {
      id: diagramId,
    });
    const diagram = fullDiagram as {
      id: string;
      name: string;
      description: string;
      mermaidCode: string;
    };

    assert.equal(diagram.id, diagramId);
    assert.equal(diagram.name, "E-Commerce Platform");
    assert(diagram.description.includes("microservices"));

    // Validate all nodes are present in mermaid code
    for (const node of nodes) {
      assert(
        diagram.mermaidCode.includes(node.nodeId),
        `Mermaid code missing node '${node.nodeId}'`
      );
    }

    // Validate edges are present
    for (const edge of edges) {
      assert(
        diagram.mermaidCode.includes(`${edge.source} -->`) &&
        diagram.mermaidCode.includes(edge.target),
        `Mermaid code missing edge ${edge.source} -> ${edge.target}`
      );
    }

    console.log("✔ Full diagram validated — all nodes and edges present");
    console.log(`  Mermaid code length: ${diagram.mermaidCode.length} chars`);
    console.log(
      `  Lines: ${diagram.mermaidCode.split("\n").length}\n`
    );

    // ── Step 6: Update diagram metadata ───────────────────────────
    const { parsed: updateResult } = await callTool(client, "update_diagram", {
      id: diagramId,
      name: "E-Commerce Platform v2",
      description: "Updated microservices architecture with payment and notification flows",
    });
    assert.equal(
      (updateResult as { message: string }).message,
      "Diagram updated"
    );
    console.log("✔ Diagram metadata updated");

    // Verify update persisted
    const { parsed: updatedDiagram } = await callTool(client, "get_diagram", {
      id: diagramId,
    });
    assert.equal((updatedDiagram as { name: string }).name, "E-Commerce Platform v2");
    console.log("✔ Update verified\n");

    // ── Step 7: List diagrams and verify ours is there ────────────
    const { parsed: listResult } = await callTool(client, "list_diagrams", {});
    const list = listResult as Array<{ id: string; name: string }>;
    const found = list.find((d) => d.id === diagramId);
    assert(found, "Diagram should appear in list");
    assert.equal(found.name, "E-Commerce Platform v2");
    console.log("✔ Diagram appears in list\n");

    // ── Step 8: Read the resource endpoint ────────────────────────
    const resourceResult = await client.readResource({
      uri: "archdiagram://diagrams",
    });
    const resourceText = (
      resourceResult.contents as Array<{ text: string }>
    )[0].text;
    const resourceList = JSON.parse(resourceText) as Array<{ id: string }>;
    assert(
      resourceList.some((d) => d.id === diagramId),
      "Diagram should appear in resource listing"
    );
    console.log("✔ Resource endpoint returns diagram\n");

    // ── Step 9: Delete and verify ─────────────────────────────────
    const { raw: deleteMsg } = await callTool(client, "delete_diagram", {
      id: diagramId,
    });
    assert(deleteMsg.includes("deleted"), "Delete should confirm removal");
    console.log("✔ Diagram deleted");

    const { isError } = await callTool(client, "get_diagram", {
      id: diagramId,
    });
    assert(isError, "Getting deleted diagram should return error");
    console.log("✔ Confirmed diagram no longer exists\n");

    // ── Step 10: Print the generated mermaid code ─────────────────
    console.log("═══ Generated Mermaid Code ═══");
    console.log(diagram.mermaidCode);
    console.log("══════════════════════════════\n");

    console.log("🎉 All E2E tests passed!\n");
  } finally {
    // Cleanup
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
