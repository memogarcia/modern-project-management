import assert from "node:assert/strict";
import {
  createEmptyEdgeMetadata,
  createEmptyNodeMetadata,
  type DiagramEdgeRecord,
  type DiagramNodeRecord,
} from "../../../shared/planview/domain.js";
import {
  flowToMermaid,
  MermaidParseError,
  mermaidToFlow,
  validateMermaidDocument,
} from "../../../shared/planview/mermaid.js";

const NOW = "2026-03-23T00:00:00.000Z";

function makeArchNode(
  id: string,
  label: string,
  shapeType: string,
  metadata = createEmptyNodeMetadata(label, NOW, `${label} description`)
): DiagramNodeRecord {
  return {
    id,
    type: "archNode",
    position: { x: 0, y: 0 },
    data: {
      label,
      shapeType,
      description: metadata.description,
      metadata,
    },
  };
}

function testFlowchartRoundTripIsDeterministic() {
  const apiMetadata = {
    ...createEmptyNodeMetadata("Checkout API", NOW, "Serves checkout traffic"),
    tags: ["checkout", "critical"],
    owner: "platform@planview.dev",
    notesMarkdown: "Preserve this metadata on Mermaid round-trip.",
  };
  const dbMetadata = {
    ...createEmptyNodeMetadata("Orders DB", NOW, "Primary order store"),
    knownFailureModes: ["Connection exhaustion"],
  };
  const edgeMetadata = {
    ...createEmptyEdgeMetadata(NOW),
    relationshipType: "dependency",
    protocol: "postgres",
    authAssumptions: "IRSA-backed IAM auth",
    dependencyNotes: "Checkout API requires read/write access to orders",
    knownFailureModes: ["Pool saturation"],
  };

  const nodes: DiagramNodeRecord[] = [
    makeArchNode("checkout_api", "Checkout API", "service", apiMetadata),
    makeArchNode("orders_db", "Orders DB", "database", dbMetadata),
  ];
  const edges: DiagramEdgeRecord[] = [
    {
      id: "edge-checkout-db",
      source: "checkout_api",
      target: "orders_db",
      type: "smoothstep",
      data: {
        label: "SQL",
        metadata: edgeMetadata,
      },
    },
  ];

  const mermaid = flowToMermaid(nodes, edges);
  assert.match(mermaid, /^flowchart LR/m);
  assert.match(mermaid, /checkout_api -->\|SQL\| orders_db/);

  const parsed = mermaidToFlow(mermaid, { nodes, edges });
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.nodes.length, 2);
  assert.equal(parsed.edges.length, 1);
  assert.deepEqual(parsed.nodes.find((node) => node.id === "checkout_api")?.data.metadata, apiMetadata);
  assert.deepEqual(parsed.edges[0].data?.metadata, edgeMetadata);
  assert.equal(parsed.edges[0].id, "edge-checkout-db");
  assert.equal(flowToMermaid(parsed.nodes, parsed.edges), mermaid);
}

function testSubgraphParsingPreservesExistingMetadata() {
  const gatewayMetadata = {
    ...createEmptyNodeMetadata("Gateway", NOW, "Public ingress"),
    dashboardLinks: [
      {
        id: "gateway-dashboard",
        label: "Gateway Dashboard",
        url: "https://dash.example.dev/gateway",
        kind: "dashboard" as const,
      },
    ],
  };
  const apiMetadata = {
    ...createEmptyNodeMetadata("API", NOW, "Internal API"),
    logLinks: [
      {
        id: "api-logs",
        label: "API Logs",
        url: "https://logs.example.dev/api",
        kind: "logs" as const,
      },
    ],
  };
  const dbMetadata = {
    ...createEmptyNodeMetadata("Orders DB", NOW, "Persistent storage"),
    runbookLinks: [
      {
        id: "db-runbook",
        label: "DB Runbook",
        url: "https://docs.example.dev/orders-db",
        kind: "runbook" as const,
      },
    ],
  };
  const edgeMetadata = {
    ...createEmptyEdgeMetadata(NOW),
    protocol: "https",
    notesMarkdown: "Keep this edge metadata when Mermaid is edited.",
  };

  const existingNodes: DiagramNodeRecord[] = [
    makeArchNode("gateway", "Gateway", "gateway", gatewayMetadata),
    makeArchNode("api", "API", "service", apiMetadata),
    makeArchNode("orders_db", "Orders DB", "database", dbMetadata),
  ];
  const existingEdges: DiagramEdgeRecord[] = [
    {
      id: "edge-gateway-api",
      source: "gateway",
      target: "api",
      type: "smoothstep",
      data: {
        label: "HTTPS",
        metadata: edgeMetadata,
      },
    },
    {
      id: "edge-api-db",
      source: "api",
      target: "orders_db",
      type: "smoothstep",
      data: {
        label: "SQL",
        metadata: createEmptyEdgeMetadata(NOW),
      },
    },
  ];

  const mermaid = `flowchart LR
    subgraph platform["Platform"]
        gateway["Gateway"]
        api["API"]
    end
    subgraph data["Data"]
        orders_db[("Orders DB")]
    end

    gateway -->|HTTPS| api
    api -->|SQL| orders_db
`;

  const parsed = mermaidToFlow(mermaid, { nodes: existingNodes, edges: existingEdges });
  assert.equal(parsed.subgraphs.length, 2);
  assert.deepEqual(
    parsed.subgraphs.map((subgraph) => subgraph.label),
    ["Platform", "Data"]
  );
  assert.deepEqual(
    [...(parsed.subgraphs.find((subgraph) => subgraph.label === "Platform")?.nodeIds ?? [])].sort(),
    ["api", "gateway"]
  );
  assert.deepEqual(parsed.nodes.find((node) => node.id === "api")?.data.metadata, apiMetadata);
  assert.deepEqual(parsed.edges.find((edge) => edge.id === "edge-gateway-api")?.data?.metadata, edgeMetadata);
  assert.equal(validateMermaidDocument(mermaid).length, 0);
}

function testErRoundTripPreservesTableIds() {
  const nodes: DiagramNodeRecord[] = [
    {
      id: "users_table",
      type: "databaseSchemaNode",
      position: { x: 0, y: 0 },
      data: {
        label: "users",
        schema: [
          { name: "id", type: "uuid", constraint: "primary" as const },
          { name: "email", type: "text" },
        ],
      },
    },
    {
      id: "orders_table",
      type: "databaseSchemaNode",
      position: { x: 400, y: 0 },
      data: {
        label: "orders",
        schema: [
          { name: "id", type: "uuid", constraint: "primary" as const },
          { name: "user_id", type: "uuid", constraint: "foreign" as const },
        ],
      },
    },
  ];
  const edges: DiagramEdgeRecord[] = [
    {
      id: "edge-users-orders",
      source: "users_table",
      target: "orders_table",
      type: "smoothstep",
      data: {
        label: "places",
        metadata: createEmptyEdgeMetadata(NOW),
      },
    },
  ];

  const mermaid = flowToMermaid(nodes, edges);
  assert.match(mermaid, /^erDiagram/m);
  assert.match(mermaid, /users \|\|--o\{ orders : "places"/);

  const parsed = mermaidToFlow(mermaid, { nodes, edges });
  assert.equal(parsed.nodes.length, 2);
  assert.equal(parsed.edges[0].id, "edge-users-orders");
  assert.equal(flowToMermaid(parsed.nodes, parsed.edges), mermaid);
}

function testUnsupportedMermaidFailsWithoutMutatingExistingGraph() {
  const existingNodes: DiagramNodeRecord[] = [
    makeArchNode("api", "API", "service"),
  ];
  const existingEdges: DiagramEdgeRecord[] = [];
  const snapshot = JSON.stringify({ nodes: existingNodes, edges: existingEdges });
  const invalidMermaid = `flowchart LR
    api["API"]
    click api "https://example.dev/docs"
`;

  assert.throws(
    () => mermaidToFlow(invalidMermaid, { nodes: existingNodes, edges: existingEdges }),
    (error: unknown) => {
      assert(error instanceof MermaidParseError);
      assert(error.diagnostics.some((diagnostic) => diagnostic.message.includes("Unsupported flowchart syntax")));
      return true;
    }
  );
  assert.equal(JSON.stringify({ nodes: existingNodes, edges: existingEdges }), snapshot);
  assert(validateMermaidDocument(invalidMermaid).length > 0);
}

try {
  testFlowchartRoundTripIsDeterministic();
  testSubgraphParsingPreservesExistingMetadata();
  testErRoundTripPreservesTableIds();
  testUnsupportedMermaidFailsWithoutMutatingExistingGraph();
  console.log("✅ Mermaid round-trip and failure-safety tests passed");
} catch (error) {
  console.error("❌ Mermaid round-trip test failed:", error);
  process.exit(1);
}
