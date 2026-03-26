import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  closePlanViewDb,
  createPlanViewProject,
  createPlanViewTroubleshootingSession,
  deletePlanViewProject,
  deletePlanViewProjectTask,
  getPlanViewProjectById,
  listPlanViewProjects,
  listPlanViewProjectTasks,
  savePlanViewDiagram,
  updatePlanViewProject,
  upsertPlanViewProjectTask,
} from "../../../shared/planview/database.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "planview-project-storage-"));
process.env.PLANVIEW_DB = path.join(tmpDir, "planview.db");
process.env.PLANVIEW_ARTIFACTS_DIR = path.join(tmpDir, "artifacts");

async function run() {
  const project = createPlanViewProject({
    id: "spring_launch",
    name: "Spring launch",
    description: "Roadmap for the public beta launch",
    createdAt: "2026-03-24T01:00:00.000Z",
  });
  assert.equal(project.columns.length, 5);
  assert.equal(project.columns[0]?.id, "backlog");

  savePlanViewDiagram({
    id: "launch_diagram",
    projectId: project.id,
    name: "Launch system",
    description: "Linked architecture context",
    mermaidCode: "graph TD\n",
    nodes: [],
    edges: [],
    createdAt: "2026-03-24T01:05:00.000Z",
  });

  createPlanViewTroubleshootingSession({
    id: "launch_risk_review",
    diagramId: "launch_diagram",
    projectId: project.id,
    title: "Launch risk review",
    summary: "Pre-launch readiness check",
    status: "open",
    linkedNodeIds: [],
    linkedEdgeIds: [],
    notesMarkdown: "",
    hypotheses: [],
    aiTranscriptReferences: [],
    resolutionSummary: "",
    createdAt: "2026-03-24T01:06:00.000Z",
    updatedAt: "2026-03-24T01:06:00.000Z",
  });

  const foundationTask = upsertPlanViewProjectTask(project.id, {
    id: "foundation_scope",
    columnId: "todo",
    name: "Lock launch scope",
    description: "Finalize what ships in the beta",
    priority: "high",
    assignee: "product",
    startDate: "2026-04-01",
    dueDate: "2026-04-05",
    progress: 35,
    tags: ["launch", "scope"],
    links: [{ label: "Launch brief", url: "https://example.com/launch-brief", type: "doc" }],
    dependencies: [],
    metadata: { isMilestone: false },
  });
  assert.equal(foundationTask.tags.length, 2);

  const milestoneTask = upsertPlanViewProjectTask(project.id, {
    id: "beta_milestone",
    columnId: "review",
    name: "Beta go/no-go",
    description: "Executive launch decision",
    priority: "critical",
    assignee: "ops",
    startDate: "2026-04-10",
    dueDate: "2026-04-10",
    progress: 0,
    tags: ["milestone"],
    links: [],
    dependencies: [{ dependsOnTaskId: foundationTask.id, type: "finish-to-start" }],
    metadata: { isMilestone: true },
  });
  assert.equal(milestoneTask.dependencies.length, 1);

  const projectAfterTasks = getPlanViewProjectById(project.id);
  assert(projectAfterTasks);
  assert.equal(projectAfterTasks?.taskCount, 2);
  assert.equal(projectAfterTasks?.scheduledTaskCount, 2);
  assert.equal(projectAfterTasks?.dependencyCount, 1);
  assert.equal(projectAfterTasks?.diagramCount, 1);
  assert.equal(projectAfterTasks?.openSessionCount, 1);
  assert.deepEqual(projectAfterTasks?.linkedDiagramIds, ["launch_diagram"]);
  assert.deepEqual(projectAfterTasks?.linkedTroubleshootingSessionIds, ["launch_risk_review"]);

  const renamed = updatePlanViewProject(project.id, {
    name: "Spring launch v2",
  });
  assert.equal(renamed.name, "Spring launch v2");

  const tasks = listPlanViewProjectTasks(project.id);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[1]?.dependencies[0]?.dependsOnTaskId, foundationTask.id);

  assert.equal(deletePlanViewProjectTask(project.id, foundationTask.id), true);
  const projectAfterDelete = getPlanViewProjectById(project.id);
  assert(projectAfterDelete);
  assert.equal(projectAfterDelete?.taskCount, 1);
  assert.equal(projectAfterDelete?.tasks[0]?.dependencies.length, 0);

  assert.equal(listPlanViewProjects()[0]?.name, "Spring launch v2");
  assert.equal(deletePlanViewProject(project.id), true);
  assert.equal(getPlanViewProjectById(project.id), null);
}

run()
  .then(() => {
    console.log("✅ Storage project Gantt tests passed");
  })
  .catch((error) => {
    console.error("❌ Storage project Gantt test failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    closePlanViewDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
