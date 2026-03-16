/**
 * End-to-end test: exercises Matrix-like operations via task priority in the unified project model.
 *
 * Run:  npx tsx src/__tests__/e2e-matrix.test.ts
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
  const tmpDir = path.join(__dirname, `../../.test-matrix-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: { ...process.env, PLANVIEW_DB: path.join(tmpDir, "test.db") },
  });

  const client = new Client({ name: "matrix-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Create a project ─────────────────────────────────
    const { parsed: createResult } = await callTool(client, "create_project", {
      name: "Matrix Test Project",
    });
    const projectId = (createResult as { id: string }).id;
    console.log(`✔ Created project: ${projectId}`);

    // Get columns
    const { parsed: proj } = await callTool(client, "get_project", { id: projectId });
    const columns = (proj as { columns: Array<{ id: string }> }).columns;
    const backlogId = columns[0].id;

    // Create an epic
    const { parsed: epicResult } = await callTool(client, "create_kanban_epic", {
      projectId,
      name: "Test Epic",
    });
    const epicId = (epicResult as { epicId: string }).epicId;

    // ── Step 2: Create tasks with different priorities ────────────
    const priorities = ["critical", "high", "medium", "low"] as const;
    const taskIds: string[] = [];

    for (const priority of priorities) {
      const { parsed: result } = await callTool(client, "create_kanban_task", {
        projectId,
        epicId,
        columnId: backlogId,
        name: `${priority} task`,
        priority,
      });
      taskIds.push((result as { taskId: string }).taskId);
    }
    console.log(`✔ Created ${taskIds.length} tasks with different priorities`);

    // ── Step 3: Filter by priority (matrix quadrant simulation) ──
    for (const priority of priorities) {
      const { parsed: filtered } = await callTool(client, "list_kanban_tasks", {
        projectId,
        priority,
      });
      const tasks = filtered as Array<{ priority: string }>;
      assert.equal(tasks.length, 1, `Should have exactly 1 ${priority} task`);
      assert.equal(tasks[0].priority, priority);
    }
    console.log("✔ Filtering tasks by priority works for all 4 levels");

    // ── Step 4: Update priority (moving between matrix quadrants) ─
    await callTool(client, "update_kanban_task", {
      projectId,
      taskId: taskIds[3], // low → critical
      priority: "critical",
    });

    const { parsed: criticalTasks } = await callTool(client, "list_kanban_tasks", {
      projectId,
      priority: "critical",
    });
    assert.equal((criticalTasks as unknown[]).length, 2, "Should now have 2 critical tasks");
    console.log("✔ Updating priority works (simulates matrix quadrant move)");

    // ── Step 5: Filter by tags (cross-dimension filtering) ───────
    await callTool(client, "update_kanban_task", {
      projectId,
      taskId: taskIds[0],
      tags: ["urgent", "frontend"],
    });
    await callTool(client, "update_kanban_task", {
      projectId,
      taskId: taskIds[1],
      tags: ["urgent", "backend"],
    });

    const { parsed: urgentTasks } = await callTool(client, "list_kanban_tasks", {
      projectId,
      tag: "urgent",
    });
    assert.equal((urgentTasks as unknown[]).length, 2, "Should find 2 urgent-tagged tasks");
    console.log("✔ Tag-based filtering works");

    // ── Step 6: Verify full project has all tasks ─────────────────
    const { parsed: fullProject } = await callTool(client, "get_project", { id: projectId });
    const allTasks = (fullProject as { tasks: unknown[] }).tasks;
    assert.equal(allTasks.length, 4, "Should have all 4 tasks");
    console.log("✔ Full project contains all 4 tasks");

    // Cleanup
    await callTool(client, "delete_project", { id: projectId });

    console.log("\n✅ All Matrix E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Matrix E2E test failed:", err);
  process.exit(1);
});
