import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  closePlanViewDb,
  createPlanViewTroubleshootingSession,
  deletePlanViewDiagramPerspective,
  extractPlanViewKnowledgePattern,
  getPlanViewDiagramById,
  getPlanViewTroubleshootingSessionById,
  listPlanViewDiagrams,
  listPlanViewArtifacts,
  listPlanViewDiagramPerspectives,
  listPlanViewKnowledgePatterns,
  listPlanViewTroubleshootingSessions,
  getPlanViewArtifactById,
  savePlanViewArtifactFile,
  savePlanViewDiagram,
  searchPlanViewTroubleshootingMemory,
  upsertPlanViewDiagramPerspective,
  updatePlanViewEdgeMetadata,
  updatePlanViewNodeMetadata,
  updatePlanViewTroubleshootingSession,
  appendPlanViewSessionCommand,
  appendPlanViewSessionComment,
  appendPlanViewTimelineEntry,
} from "../../../shared/planview/database.js";
import {
  createEmptyEdgeMetadata,
  createEmptyNodeMetadata,
  type DiagramEdgeRecord,
  type DiagramNodeRecord,
} from "../../../shared/planview/domain.js";
import { flowToMermaid } from "../../../shared/planview/mermaid.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "planview-storage-"));
process.env.PLANVIEW_DB = path.join(tmpDir, "planview.db");
process.env.PLANVIEW_ARTIFACTS_DIR = path.join(tmpDir, "artifacts");

const NOW = "2026-03-23T01:00:00.000Z";

async function run() {
  const checkoutNodeMetadata = {
    ...createEmptyNodeMetadata("Checkout API", NOW, "Handles customer checkout requests"),
    owner: "checkout-team@planview.dev",
    tags: ["checkout", "critical"],
    knownFailureModes: ["DB pool exhaustion"],
  };
  const databaseNodeMetadata = {
    ...createEmptyNodeMetadata("Orders DB", NOW, "Primary database for orders"),
    documentationLinks: [
      {
        id: "orders-schema",
        label: "Orders Schema",
        url: "https://docs.example.dev/orders-schema",
        kind: "documentation" as const,
      },
    ],
  };
  const initialEdgeMetadata = {
    ...createEmptyEdgeMetadata(NOW),
    relationshipType: "dependency",
    protocol: "postgres",
    dependencyNotes: "Checkout API blocks hard on orders DB availability",
    knownFailureModes: ["Connection storm"],
  };

  const nodes: DiagramNodeRecord[] = [
    {
      id: "checkout_api",
      type: "archNode",
      position: { x: 0, y: 0 },
      data: {
        label: "Checkout API",
        shapeType: "service",
        description: checkoutNodeMetadata.description,
        metadata: checkoutNodeMetadata,
      },
    },
    {
      id: "orders_db",
      type: "archNode",
      position: { x: 320, y: 0 },
      data: {
        label: "Orders DB",
        shapeType: "database",
        description: databaseNodeMetadata.description,
        metadata: databaseNodeMetadata,
      },
    },
  ];
  const edges: DiagramEdgeRecord[] = [
    {
      id: "edge-checkout-db",
      source: "checkout_api",
      target: "orders_db",
      type: "smoothstep",
      data: {
        label: "SQL",
        metadata: initialEdgeMetadata,
      },
    },
  ];

  const createdDiagram = savePlanViewDiagram({
    id: "checkout_system",
    projectId: null,
    name: "Checkout System",
    description: "Diagram-first troubleshooting memory for checkout incidents",
    mermaidCode: flowToMermaid(nodes, edges),
    nodes,
    edges,
    createdAt: NOW,
  });
  assert.equal(createdDiagram.revision, 1);
  assert.equal(listPlanViewDiagrams()[0]?.nodeCount, 2);

  const onboardingPerspective = upsertPlanViewDiagramPerspective("checkout_system", {
    id: "onboarding_view",
    title: "Onboarding view",
    description: "The core checkout request path.",
    kind: "onboarding",
    nodeIds: ["checkout_api", "orders_db"],
    edgeIds: ["edge-checkout-db"],
    createdAt: NOW,
  });
  assert.equal(onboardingPerspective.kind, "onboarding");

  const customPerspective = upsertPlanViewDiagramPerspective("checkout_system", {
    id: "db_focus",
    title: "DB focus",
    description: "Only the blocking write dependency.",
    kind: "custom",
    nodeIds: ["checkout_api", "orders_db"],
    edgeIds: ["edge-checkout-db"],
    createdAt: "2026-03-23T01:00:30.000Z",
  });
  assert.equal(customPerspective.id, "db_focus");
  assert.equal(listPlanViewDiagramPerspectives("checkout_system").length, 2);

  const hydratedDiagram = getPlanViewDiagramById("checkout_system");
  assert(hydratedDiagram);
  assert.equal(hydratedDiagram?.perspectives.length, 2);
  assert(hydratedDiagram?.perspectives.some((perspective) => perspective.id === "onboarding_view"));

  assert.equal(deletePlanViewDiagramPerspective("checkout_system", "db_focus"), true);
  assert.equal(listPlanViewDiagramPerspectives("checkout_system").length, 1);

  const updatedNodeMetadata = {
    ...checkoutNodeMetadata,
    updatedAt: "2026-03-23T01:05:00.000Z",
    dashboardLinks: [
      {
        id: "checkout-dashboard",
        label: "Checkout Dashboard",
        url: "https://dash.example.dev/checkout",
        kind: "dashboard" as const,
      },
    ],
    lastVerifiedAt: undefined,
  };
  const afterNodeUpdate = updatePlanViewNodeMetadata(
    "checkout_system",
    "checkout_api",
    updatedNodeMetadata,
    createdDiagram.revision
  );
  assert.equal(afterNodeUpdate.revision, 2);
  assert.deepEqual(
    afterNodeUpdate.nodes.find((node) => node.id === "checkout_api")?.data.metadata,
    updatedNodeMetadata
  );

  assert.throws(
    () =>
      updatePlanViewEdgeMetadata(
        "checkout_system",
        "edge-checkout-db",
        {
          ...initialEdgeMetadata,
          updatedAt: "2026-03-23T01:06:00.000Z",
          authAssumptions: "IAM auth",
        },
        1
      ),
    (error: unknown) => {
      const planViewError = error as { code?: string };
      assert.equal(planViewError.code, "diagram_revision_conflict");
      return true;
    }
  );

  const updatedEdgeMetadata = {
    ...initialEdgeMetadata,
    updatedAt: "2026-03-23T01:07:00.000Z",
    authAssumptions: "IRSA-backed IAM database auth",
    evidenceReferences: [
      {
        id: "db-log-link",
        label: "Pool Saturation Log",
        url: "https://logs.example.dev/checkout/db-pool",
        kind: "logs" as const,
      },
    ],
  };
  const afterEdgeUpdate = updatePlanViewEdgeMetadata(
    "checkout_system",
    "edge-checkout-db",
    updatedEdgeMetadata,
    afterNodeUpdate.revision
  );
  assert.equal(afterEdgeUpdate.revision, 3);

  const session = createPlanViewTroubleshootingSession({
    id: "incident_503_checkout",
    diagramId: "checkout_system",
    projectId: null,
    systemScope: "checkout",
    title: "Checkout 503 spike",
    summary: "Customers intermittently see 503 responses during checkout",
    status: "open",
    linkedNodeIds: ["checkout_api"],
    linkedEdgeIds: ["edge-checkout-db"],
    notesMarkdown: "Started from error budget burn alert.",
    hypotheses: ["DB connection pool exhausted"],
    aiTranscriptReferences: [],
    resolutionSummary: "",
    createdAt: "2026-03-23T01:10:00.000Z",
    updatedAt: "2026-03-23T01:10:00.000Z",
  });
  assert.equal(session.linkedNodeIds[0], "checkout_api");

  appendPlanViewTimelineEntry("incident_503_checkout", {
    kind: "observation",
    title: "Alert fired",
    body: "Checkout latency and 503s exceeded threshold.",
    author: "oncall",
    occurredAt: "2026-03-23T01:12:00.000Z",
  });
  appendPlanViewSessionComment("incident_503_checkout", {
    author: "platform-bot",
    body: "Recent deploy increased DB connection pressure.",
  });
  appendPlanViewSessionCommand("incident_503_checkout", {
    command: "kubectl logs deploy/checkout-api",
    summary: "Inspect API error logs",
    outputExcerpt: "too many clients already",
    status: "ran",
  });

  const artifact = await savePlanViewArtifactFile({
    ownerType: "session",
    diagramId: "checkout_system",
    ownerId: "incident_503_checkout",
    label: "db-pool-error.log",
    fileName: "db-pool-error.log",
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("too many clients already"),
  });
  assert(fs.existsSync(path.join(process.env.PLANVIEW_ARTIFACTS_DIR!, artifact.relativePath)));
  assert.equal(listPlanViewArtifacts({ ownerType: "session", ownerId: "incident_503_checkout" }).length, 1);
  const hydratedArtifact = getPlanViewArtifactById(artifact.artifactId);
  assert(hydratedArtifact);
  assert.equal(hydratedArtifact?.ownerType, "session");
  assert.equal(hydratedArtifact?.ownerId, "incident_503_checkout");
  assert(fs.existsSync(hydratedArtifact!.absolutePath));

  const resolvedSession = updatePlanViewTroubleshootingSession("incident_503_checkout", {
    status: "resolved",
    resolutionSummary: "Scaled the connection pool and rolled back the offending deploy.",
    notesMarkdown: "Confirmed saturation via logs and database metrics.",
  });
  assert.equal(resolvedSession.status, "resolved");
  assert(resolvedSession.resolvedAt);

  const pattern = extractPlanViewKnowledgePattern("incident_503_checkout", {
    title: "Checkout DB pool exhaustion",
    summary: "Checkout API returns 503 when the orders DB pool saturates.",
    symptom: "Customer-facing 503s during peak order traffic",
    resolution: "Rollback connection-heavy deploy and scale the DB pool.",
    tags: ["checkout", "postgres", "503"],
    linkedNodeIds: ["checkout_api"],
    linkedEdgeIds: ["edge-checkout-db"],
  });
  assert.equal(pattern.sourceSessionId, "incident_503_checkout");
  assert.equal(listPlanViewKnowledgePatterns().length, 1);

  const hydrated = getPlanViewTroubleshootingSessionById("incident_503_checkout");
  assert(hydrated);
  assert.equal(hydrated?.timelineEntries.length, 1);
  assert.equal(hydrated?.comments.length, 1);
  assert.equal(hydrated?.commands.length, 1);
  assert.equal(hydrated?.artifacts.length, 1);
  assert.equal(hydrated?.reusablePatternId, pattern.id);

  assert.equal(listPlanViewTroubleshootingSessions({ diagramId: "checkout_system" }).length, 1);
  assert.equal(listPlanViewTroubleshootingSessions({ nodeId: "checkout_api" }).length, 1);
  assert.equal(listPlanViewTroubleshootingSessions({ edgeId: "edge-checkout-db" }).length, 1);

  const searchHits = searchPlanViewTroubleshootingMemory({
    q: "503",
    diagramId: "checkout_system",
    nodeId: "checkout_api",
  });
  assert(searchHits.some((hit) => hit.type === "session" && hit.id === "incident_503_checkout"));
  assert(searchHits.some((hit) => hit.type === "pattern" && hit.id === pattern.id));

  const commandSearchHits = searchPlanViewTroubleshootingMemory({
    q: "too many clients already",
    diagramId: "checkout_system",
  });
  assert(commandSearchHits.some((hit) => hit.type === "session" && hit.id === "incident_503_checkout"));
}

run()
  .then(() => {
    console.log("✅ Storage metadata and troubleshooting persistence tests passed");
  })
  .catch((error) => {
    console.error("❌ Storage persistence test failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    closePlanViewDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
