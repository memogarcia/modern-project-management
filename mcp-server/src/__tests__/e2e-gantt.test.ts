/**
 * End-to-end test: exercises Gantt-like operations via the unified project model.
 *
 * Run:  npx tsx src/__tests__/e2e-gantt.test.ts
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
  const tmpDir = path.join(__dirname, `../../.test-gantt-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: { ...process.env, DIAGRAMS_DIR: tmpDir },
  });

  const client = new Client({ name: "gantt-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Create a project ─────────────────────────────────
    const { parsed: createResult } = await callTool(client, "create_project", {
      name: "Gantt Test Project",
      description: "Testing Gantt-like operations",
    });
    const projectId = (createResult as { id: string }).id;
    console.log(`✔ Created project: ${projectId}`);

    // Get columns
    const { parsed: proj } = await callTool(client, "get_project", { id: projectId });
    const columns = (proj as { columns: Array<{ id: string; name: string }> }).columns;
    const backlogId = columns[0].id;
    const inProgressId = columns[2].id;

    // Create an epic
    const { parsed: epicResult } = await callTool(client, "create_kanban_epic", {
      projectId,
      name: "Release 1.0",
    });
    const epicId = (epicResult as { epicId: string }).epicId;

    // ── Step 2: Create tasks with date ranges (Gantt data) ───────
    const { parsed: t1 } = await callTool(client, "create_kanban_task", {
      projectId,
      epicId,
      columnId: backlogId,
      name: "Design API",
      startDate: "2025-04-01",
      dueDate: "2025-04-10",
      progress: 0,
    });
    const task1Id = (t1 as { taskId: string }).taskId;

    const { parsed: t2 } = await callTool(client, "create_kanban_task", {
      projectId,
      epicId,
      columnId: backlogId,
      name: "Implement Backend",
      startDate: "2025-04-11",
      dueDate: "2025-04-25",
      progress: 0,
    });
    const task2Id = (t2 as { taskId: string }).taskId;

    const { parsed: t3 } = await callTool(client, "create_kanban_task", {
      projectId,
      epicId,
      columnId: backlogId,
      name: "Write Tests",
      startDate: "2025-04-20",
      dueDate: "2025-04-30",
      progress: 0,
    });
    const task3Id = (t3 as { taskId: string }).taskId;
    console.log("✔ Created 3 tasks with date ranges");

    // ── Step 3: Update progress (simulating Gantt interactions) ──
    await callTool(client, "update_kanban_task", {
      projectId,
      taskId: task1Id,
      progress: 50,
    });
    await callTool(client, "move_kanban_task", {
      projectId,
      taskId: task1Id,
      columnId: inProgressId,
    });
    console.log("✔ Updated task progress and moved to In Progress");

    // ── Step 4: Verify task dates survive round-trip ──────────────
    const { parsed: projectData } = await callTool(client, "get_project", { id: projectId });
    const tasks = (projectData as { tasks: Array<{ id: string; startDate?: string; dueDate?: string; progress: number }> }).tasks;
    const task1 = tasks.find((t) => t.id === task1Id);
    assert(task1);
    assert.equal(task1.startDate, "2025-04-01");
    assert.equal(task1.dueDate, "2025-04-10");
    assert.equal(task1.progress, 50);
    console.log("✔ Task dates and progress survive round-trip");

    // ── Step 5: Update date range (rescheduling) ─────────────────
    await callTool(client, "update_kanban_task", {
      projectId,
      taskId: task2Id,
      startDate: "2025-04-15",
      dueDate: "2025-04-30",
    });
    const { parsed: pd2 } = await callTool(client, "get_project", { id: projectId });
    const task2Updated = (pd2 as { tasks: Array<{ id: string; startDate?: string; dueDate?: string }> }).tasks.find((t) => t.id === task2Id);
    assert(task2Updated);
    assert.equal(task2Updated.startDate, "2025-04-15");
    assert.equal(task2Updated.dueDate, "2025-04-30");
    console.log("✔ Task rescheduling works");

    // ── Step 6: List tasks filtered by epic ───────────────────────
    const { parsed: epicTasks } = await callTool(client, "list_kanban_tasks", {
      projectId,
      epicId,
    });
    assert.equal((epicTasks as unknown[]).length, 3);
    console.log("✔ list_kanban_tasks by epic returns 3 tasks");

    // Cleanup
    await callTool(client, "delete_project", { id: projectId });

    console.log("\n✅ All Gantt E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Gantt E2E test failed:", err);
  process.exit(1);
});
