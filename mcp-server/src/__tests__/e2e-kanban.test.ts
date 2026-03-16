/**
 * End-to-end test: exercises Project MCP tools (kanban operations).
 *
 * Run:  npx tsx src/__tests__/e2e-kanban.test.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function runTest() {
  const tmpDir = path.join(__dirname, `../../.test-kanban-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: { ...process.env, PLANVIEW_DB: path.join(tmpDir, "test.db") },
  });

  const client = new Client({ name: "kanban-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Verify project tools are registered ──────────────
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    const expectedTools = [
      "list_projects",
      "get_project",
      "create_project",
      "update_project",
      "delete_project",
      "add_kanban_column",
      "update_kanban_column",
      "reorder_kanban_columns",
      "delete_kanban_column",
      "list_kanban_epics",
      "get_kanban_epic",
      "create_kanban_epic",
      "update_kanban_epic",
      "delete_kanban_epic",
      "create_kanban_task",
      "update_kanban_task",
      "move_kanban_task",
      "delete_kanban_task",
      "list_kanban_tasks",
      "add_link_to_kanban_task",
      "add_project_session",
      "update_project_session",
      "remove_project_session",
      "add_task_to_project_session",
      "remove_task_from_project_session",
      "link_diagram_to_project",
      "unlink_diagram_from_project",
    ];
    for (const expected of expectedTools) {
      assert(toolNames.includes(expected), `Missing tool: ${expected}`);
    }
    console.log(`✔ All ${expectedTools.length} project tools registered\n`);

    // ── Step 2: Create a project with default columns ────────────
    const { parsed: createResult } = await callTool(client, "create_project", {
      name: "Sprint Alpha",
      description: "First sprint of project Alpha",
    });
    const projectId = (createResult as { id: string }).id;
    const columnCount = (createResult as { columnCount: number }).columnCount;
    assert(projectId, "Project ID should be returned");
    assert.equal(columnCount, 5, "Should have 5 default columns");
    console.log(`✔ Created project: ${projectId} with ${columnCount} default columns`);

    // ── Step 3: Get project and verify default columns ───────────
    const { parsed: project } = await callTool(client, "get_project", { id: projectId });
    const p = project as { columns: Array<{ id: string; name: string; position: number }>; sessions: unknown[]; diagramIds: string[] };
    assert.equal(p.columns.length, 5);
    assert.equal(p.columns[0].name, "Backlog");
    assert.equal(p.columns[4].name, "Done");
    assert(Array.isArray(p.sessions), "Should have sessions array");
    assert(Array.isArray(p.diagramIds), "Should have diagramIds array");
    console.log("✔ Get project returns 5 default columns, sessions, and diagramIds");

    // ── Step 4: Verify list_projects ─────────────────────────────
    const { parsed: listResult } = await callTool(client, "list_projects", {});
    const projects = listResult as Array<{ id: string }>;
    assert(projects.length >= 1, "Should list at least 1 project");
    assert(projects.some((pr) => pr.id === projectId));
    console.log("✔ list_projects returns the created project");

    // ── Step 5: Update project ───────────────────────────────────
    await callTool(client, "update_project", { id: projectId, name: "Sprint Alpha v2" });
    const { parsed: updated } = await callTool(client, "get_project", { id: projectId });
    assert.equal((updated as { name: string }).name, "Sprint Alpha v2");
    console.log("✔ update_project works");

    // ── Step 6: Add a custom column ──────────────────────────────
    const { parsed: addColResult } = await callTool(client, "add_kanban_column", {
      projectId,
      name: "QA",
      color: "#9333ea",
    });
    const qaColumnId = (addColResult as { columnId: string }).columnId;
    assert(qaColumnId, "Column ID should be returned");
    console.log(`✔ Added column: QA (${qaColumnId})`);

    // ── Step 7: Create an epic ───────────────────────────────────
    const { parsed: epicResult } = await callTool(client, "create_kanban_epic", {
      projectId,
      name: "Core Features",
      description: "Core feature set",
      color: "#3b82f6",
    });
    const epicId = (epicResult as { epicId: string }).epicId;
    assert(epicId, "Epic ID should be returned");
    console.log(`✔ Created epic: ${epicId}`);

    // ── Step 8: Create a task ────────────────────────────────────
    const backlogColumnId = p.columns[0].id;
    const { parsed: taskResult } = await callTool(client, "create_kanban_task", {
      projectId,
      epicId,
      columnId: backlogColumnId,
      name: "Implement login",
      priority: "high",
      tags: ["auth"],
      startDate: "2025-04-01",
      dueDate: "2025-04-15",
    });
    const taskId = (taskResult as { taskId: string }).taskId;
    assert(taskId, "Task ID should be returned");
    console.log(`✔ Created task: ${taskId}`);

    // ── Step 9: Move task to In Progress ──────────────────────────
    const inProgressColumnId = p.columns[2].id;
    await callTool(client, "move_kanban_task", {
      projectId,
      taskId,
      columnId: inProgressColumnId,
    });
    console.log("✔ Moved task to In Progress");

    // ── Step 10: Filter tasks ────────────────────────────────────
    const { parsed: filteredTasks } = await callTool(client, "list_kanban_tasks", {
      projectId,
      priority: "high",
    });
    assert((filteredTasks as unknown[]).length >= 1, "Should find filtered tasks");
    console.log("✔ list_kanban_tasks with priority filter works");

    // ── Step 11: Add a link to task ──────────────────────────────
    await callTool(client, "add_link_to_kanban_task", {
      projectId,
      taskId,
      label: "PR #42",
      url: "https://github.com/example/repo/pull/42",
      type: "github-pr",
    });
    console.log("✔ add_link_to_kanban_task works");

    // ── Step 12: Delete task ─────────────────────────────────────
    await callTool(client, "delete_kanban_task", { projectId, taskId });
    console.log("✔ delete_kanban_task works");

    // ── Step 13: Delete project ──────────────────────────────────
    await callTool(client, "delete_project", { id: projectId });
    const { isError } = await callTool(client, "get_project", { id: projectId });
    assert(isError, "Deleted project should not be found");
    console.log("✔ delete_project works");

    console.log("\n✅ All Kanban E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Kanban E2E test failed:", err);
  process.exit(1);
});
