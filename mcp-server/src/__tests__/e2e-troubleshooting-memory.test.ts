import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ parsed: unknown; raw: string; isError?: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const textContent = (result.content as Array<{ type: string; text: string }>).find(
    (content) => content.type === "text"
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

async function readResource(client: Client, uri: string): Promise<unknown> {
  const result = await client.readResource({ uri });
  const text = (result.contents as Array<{ mimeType?: string; text?: string }>)[0]?.text;
  assert(text, `Resource '${uri}' returned no text payload`);
  return JSON.parse(text);
}

async function runTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "planview-mcp-"));
  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: {
      ...process.env,
      PLANVIEW_DB: path.join(tmpDir, "planview.db"),
      PLANVIEW_ARTIFACTS_DIR: path.join(tmpDir, "artifacts"),
    },
  });

  const client = new Client({ name: "troubleshooting-memory-test", version: "1.0.0" });
  const now = "2026-03-23T02:00:00.000Z";

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name);
    for (const expectedTool of [
      "get_diagram_metadata",
      "update_diagram_node_metadata",
      "update_diagram_edge_metadata",
      "create_troubleshooting_session",
      "list_troubleshooting_sessions",
      "get_troubleshooting_session",
      "update_troubleshooting_session",
      "append_session_timeline_entry",
      "append_session_comment",
      "append_session_command",
      "link_session_to_entities",
      "extract_knowledge_pattern",
      "list_knowledge_patterns",
      "search_troubleshooting_memory",
      "list_artifacts",
      "get_artifact_metadata",
      "attach_artifact",
    ]) {
      assert(toolNames.includes(expectedTool), `Missing tool: ${expectedTool}`);
    }

    const { parsed: createdDiagram } = await callTool(client, "create_diagram", {
      name: "Checkout Platform",
      description: "Troubleshooting memory for checkout flows",
      mermaidCode: "flowchart LR\n",
    });
    const diagramId = (createdDiagram as { id: string }).id;
    assert(diagramId);

    await callTool(client, "add_node_to_diagram", {
      id: diagramId,
      nodeId: "checkout_api",
      label: "Checkout API",
      shapeType: "service",
      description: "Handles customer checkout traffic",
    });
    await callTool(client, "add_node_to_diagram", {
      id: diagramId,
      nodeId: "orders_db",
      label: "Orders DB",
      shapeType: "database",
      description: "Stores orders",
    });
    await callTool(client, "add_edge_to_diagram", {
      id: diagramId,
      source: "checkout_api",
      target: "orders_db",
      label: "SQL",
    });

    const { parsed: metadataBefore } = await callTool(client, "get_diagram_metadata", { id: diagramId });
    assert.equal((metadataBefore as { nodeCount: number }).nodeCount, 2);
    assert.equal((metadataBefore as { edgeCount: number }).edgeCount, 1);
    const edgeId = ((metadataBefore as { edges: Array<{ id: string }> }).edges[0] ?? {}).id;
    assert(edgeId, "Edge ID should be discoverable from diagram metadata");

    const { parsed: nodeUpdate } = await callTool(client, "update_diagram_node_metadata", {
      diagramId,
      nodeId: "checkout_api",
      metadata: {
        title: "Checkout API",
        description: "Handles customer checkout traffic",
        tags: ["checkout", "critical"],
        owner: "checkout-team@planview.dev",
        documentationLinks: [],
        dashboardLinks: [
          {
            id: "checkout-dashboard",
            label: "Checkout Dashboard",
            url: "https://dash.example.dev/checkout",
            kind: "dashboard",
          },
        ],
        logLinks: [],
        traceLinks: [],
        runbookLinks: [],
        knownFailureModes: ["DB saturation"],
        notesMarkdown: "Keep this metadata durable across app and MCP edits.",
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
    });
    const revisionAfterNodeUpdate = (nodeUpdate as { revision: number }).revision;
    assert(revisionAfterNodeUpdate >= 2);

    const { parsed: edgeUpdate } = await callTool(client, "update_diagram_edge_metadata", {
      diagramId,
      edgeId,
      expectedRevision: revisionAfterNodeUpdate,
      metadata: {
        relationshipType: "dependency",
        protocol: "postgres",
        authAssumptions: "IRSA-backed IAM auth",
        dependencyNotes: "Checkout API hard-depends on orders DB writes",
        knownFailureModes: ["Connection exhaustion"],
        evidenceReferences: [],
        notesMarkdown: "Primary operational dependency.",
        commentsMarkdown: "",
        createdAt: now,
        updatedAt: "2026-03-23T02:01:00.000Z",
      },
    });
    const revisionAfterEdgeUpdate = (edgeUpdate as { revision: number }).revision;
    assert(revisionAfterEdgeUpdate > revisionAfterNodeUpdate);

    const { parsed: createdSession } = await callTool(client, "create_troubleshooting_session", {
      id: "checkout_503_session",
      diagramId,
      title: "Checkout 503s",
      summary: "Customers see intermittent 503 responses during checkout",
      status: "open",
      linkedNodeIds: ["checkout_api"],
      linkedEdgeIds: [edgeId],
      notesMarkdown: "Started from latency and error-rate alerts.",
      hypotheses: ["Orders DB connection pool saturation"],
      aiTranscriptReferences: [],
      resolutionSummary: "",
      createdAt: now,
      updatedAt: now,
    });
    const sessionId = (createdSession as { id: string }).id;
    assert.equal(sessionId, "checkout_503_session");

    await callTool(client, "append_session_timeline_entry", {
      sessionId,
      entry: {
        kind: "observation",
        title: "Alert fired",
        body: "p95 checkout latency and 503s exceeded threshold",
        author: "oncall",
        occurredAt: "2026-03-23T02:03:00.000Z",
      },
    });
    await callTool(client, "append_session_comment", {
      sessionId,
      comment: {
        author: "incident-bot",
        body: "Recent deploy increased connection usage",
      },
    });
    await callTool(client, "append_session_command", {
      sessionId,
      command: {
        command: "kubectl logs deploy/checkout-api",
        summary: "Inspect checkout API logs",
        outputExcerpt: "too many clients already",
        status: "ran",
      },
    });
    const artifactBody = Buffer.from("checkout timeline evidence").toString("base64");
    const { parsed: attachedArtifact } = await callTool(client, "attach_artifact", {
      ownerType: "session",
      ownerId: sessionId,
      diagramId,
      label: "incident-log.txt",
      fileName: "incident-log.txt",
      mimeType: "text/plain",
      contentBase64: artifactBody,
    });
    const artifactId = (attachedArtifact as { artifactId: string }).artifactId;
    assert(artifactId);

    await callTool(client, "link_session_to_entities", {
      sessionId,
      linkedNodeIds: ["checkout_api", "orders_db"],
      linkedEdgeIds: [edgeId],
    });

    await callTool(client, "update_troubleshooting_session", {
      id: sessionId,
      status: "resolved",
      resolutionSummary: "Rolled back the deploy and increased the DB pool size.",
      notesMarkdown: "Verified fix via dashboard and logs.",
    });

    const { parsed: extractedPattern } = await callTool(client, "extract_knowledge_pattern", {
      sessionId,
      pattern: {
        title: "Checkout DB pool exhaustion",
        summary: "Checkout returns 503 when DB pool saturation occurs.",
        symptom: "Customer-facing 503s under peak traffic",
        resolution: "Rollback connection-heavy deploy and scale DB pool.",
        tags: ["checkout", "postgres", "503"],
      },
    });
    const patternId = (extractedPattern as { id: string }).id;
    assert(patternId);

    const { parsed: listedSessions } = await callTool(client, "list_troubleshooting_sessions", {
      diagramId,
      nodeId: "checkout_api",
    });
    assert.equal((listedSessions as Array<unknown>).length, 1);

    const { parsed: sessionAfterUpdates } = await callTool(client, "get_troubleshooting_session", {
      id: sessionId,
    });
    const finalSession = sessionAfterUpdates as {
      status: string;
      timelineEntries: unknown[];
      comments: unknown[];
      commands: unknown[];
      artifacts: unknown[];
      reusablePatternId?: string;
      linkedNodeIds: string[];
    };
    assert.equal(finalSession.status, "resolved");
    assert.equal(finalSession.timelineEntries.length, 1);
    assert.equal(finalSession.comments.length, 1);
    assert.equal(finalSession.commands.length, 1);
    assert.equal(finalSession.artifacts.length, 1);
    assert.equal(finalSession.reusablePatternId, patternId);
    assert.deepEqual(finalSession.linkedNodeIds.sort(), ["checkout_api", "orders_db"]);

    const { parsed: listedPatterns } = await callTool(client, "list_knowledge_patterns", {});
    assert((listedPatterns as Array<{ id: string }>).some((pattern) => pattern.id === patternId));
    const { parsed: artifactMetadata } = await callTool(client, "get_artifact_metadata", { artifactId });
    assert.equal((artifactMetadata as { artifactId: string }).artifactId, artifactId);
    const { parsed: listedArtifacts } = await callTool(client, "list_artifacts", { ownerType: "session", ownerId: sessionId });
    assert((listedArtifacts as Array<{ artifactId: string }>).some((artifact) => artifact.artifactId === artifactId));

    const { parsed: searchResults } = await callTool(client, "search_troubleshooting_memory", {
      q: "503",
      diagramId,
      nodeId: "checkout_api",
    });
    const hits = searchResults as Array<{ type: string; id: string }>;
    assert(hits.some((hit) => hit.type === "session" && hit.id === sessionId));
    assert(hits.some((hit) => hit.type === "pattern" && hit.id === patternId));

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri);
    assert(resourceUris.includes("planview://diagrams"));
    assert(resourceUris.includes("planview://investigations"));
    assert(resourceUris.includes("planview://patterns"));
    assert(resourceUris.includes("planview://artifacts"));

    const diagramResource = await readResource(client, `planview://diagrams/${diagramId}`);
    assert.equal((diagramResource as { id: string }).id, diagramId);
    const investigationsResource = await readResource(client, "planview://investigations");
    assert(
      (investigationsResource as Array<{ id: string }>).some((session) => session.id === sessionId)
    );
    const patternsResource = await readResource(client, "planview://patterns");
    assert(
      (patternsResource as Array<{ id: string }>).some((pattern) => pattern.id === patternId)
    );
    const patternResource = await readResource(client, `planview://patterns/${patternId}`);
    assert.equal((patternResource as { id: string }).id, patternId);
    const artifactResource = await readResource(client, `planview://artifacts/${artifactId}`);
    assert.equal((artifactResource as { artifactId: string }).artifactId, artifactId);

    console.log("✅ Troubleshooting memory MCP E2E test passed");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((error) => {
  console.error("❌ Troubleshooting memory MCP E2E test failed:", error);
  process.exit(1);
});
