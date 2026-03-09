/**
 * End-to-end test: exercises all Matrix board MCP tools.
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
    env: { ...process.env, DIAGRAMS_DIR: tmpDir },
  });

  const client = new Client({ name: "matrix-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Verify all matrix tools are registered ───────────
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    for (const expected of [
      "list_matrix_boards",
      "get_matrix_board",
      "create_matrix_board",
      "update_matrix_board",
      "delete_matrix_board",
      "add_matrix_task",
      "update_matrix_task",
      "remove_matrix_task",
    ]) {
      assert(toolNames.includes(expected), `Missing tool: ${expected}`);
    }
    console.log("✔ All matrix tools registered\n");

    // ── Step 2: List boards (empty) ───────────────────────────────
    const { parsed: emptyList } = await callTool(client, "list_matrix_boards", {});
    assert(Array.isArray(emptyList), "list_matrix_boards should return an array");
    assert.equal((emptyList as unknown[]).length, 0, "Should start with no boards");
    console.log("✔ Empty board list returned");

    // ── Step 3: Create a matrix board with initial tasks ──────────
    const { parsed: createResult } = await callTool(client, "create_matrix_board", {
      name: "Q2 Priorities",
      tasks: [
        { title: "Fix critical production bug", quadrant: "do-first" },
        { title: "Plan architecture review", quadrant: "schedule" },
        { title: "Review team PRs", quadrant: "delegate" },
        { title: "Update old blog posts", quadrant: "drop" },
      ],
    });
    const boardId = (createResult as { id: string }).id;
    const taskCount = (createResult as { taskCount: number }).taskCount;
    assert(boardId, "Board ID should be returned");
    assert.equal(taskCount, 4, "Should have 4 tasks");
    console.log(`✔ Created matrix board: ${boardId} with ${taskCount} tasks`);

    // ── Step 4: Get the board and validate ────────────────────────
    const { parsed: board } = await callTool(client, "get_matrix_board", { id: boardId });
    const b = board as {
      id: string;
      name: string;
      tasks: Array<{ id: string; title: string; quadrant: string }>;
    };
    assert.equal(b.id, boardId);
    assert.equal(b.name, "Q2 Priorities");
    assert.equal(b.tasks.length, 4);
    assert(b.tasks.some((t) => t.quadrant === "do-first"), "Should have a do-first task");
    assert(b.tasks.some((t) => t.quadrant === "schedule"), "Should have a schedule task");
    assert(b.tasks.some((t) => t.quadrant === "delegate"), "Should have a delegate task");
    assert(b.tasks.some((t) => t.quadrant === "drop"), "Should have a drop task");
    console.log("✔ Board retrieved and all quadrants validated");

    // ── Step 5: Update board name ─────────────────────────────────
    await callTool(client, "update_matrix_board", { id: boardId, name: "Q2 Priorities (Updated)" });
    const { parsed: updatedBoard } = await callTool(client, "get_matrix_board", { id: boardId });
    assert.equal((updatedBoard as { name: string }).name, "Q2 Priorities (Updated)");
    console.log("✔ Board name updated");

    // ── Step 6: Add a task ────────────────────────────────────────
    const { parsed: addResult } = await callTool(client, "add_matrix_task", {
      boardId,
      title: "Refactor auth module",
      quadrant: "schedule",
    });
    const newTaskId = (addResult as { taskId: string }).taskId;
    assert(newTaskId, "New task ID should be returned");
    console.log(`✔ Added task: ${newTaskId}`);

    // ── Step 7: Verify task was added ────────────────────────────
    const { parsed: boardAfterAdd } = await callTool(client, "get_matrix_board", { id: boardId });
    const baa = boardAfterAdd as { tasks: Array<{ id: string; quadrant: string }> };
    assert.equal(baa.tasks.length, 5, "Should now have 5 tasks");
    const newTask = baa.tasks.find((t) => t.id === newTaskId);
    assert(newTask, "New task should appear in board");
    assert.equal(newTask.quadrant, "schedule");
    console.log("✔ Task confirmed in board with correct quadrant");

    // ── Step 8: Update the task ───────────────────────────────────
    const { parsed: updateTaskResult } = await callTool(client, "update_matrix_task", {
      boardId,
      taskId: newTaskId,
      title: "Refactor auth module (urgent)",
      quadrant: "do-first",
    });
    const updatedTask = (updateTaskResult as { task: { title: string; quadrant: string } }).task;
    assert.equal(updatedTask.title, "Refactor auth module (urgent)");
    assert.equal(updatedTask.quadrant, "do-first");
    console.log("✔ Task title and quadrant updated");

    // ── Step 9: Remove the task ───────────────────────────────────
    const { parsed: removeResult } = await callTool(client, "remove_matrix_task", {
      boardId,
      taskId: newTaskId,
    });
    const taskCountAfter = (removeResult as { taskCount: number }).taskCount;
    assert.equal(taskCountAfter, 4, "Should be back to 4 tasks");
    console.log("✔ Task removed (back to 4)");

    // ── Step 10: List boards confirms presence ────────────────────
    const { parsed: listResult } = await callTool(client, "list_matrix_boards", {});
    const list = listResult as Array<{ id: string; taskCount: number }>;
    assert(list.length >= 1, "Should have at least 1 board");
    const listed = list.find((x) => x.id === boardId);
    assert(listed, "Created board should appear in list");
    assert.equal(listed.taskCount, 4, "Should have 4 tasks");
    console.log("✔ Board appears in list with correct task count");

    // ── Step 11: Test matrix-boards resource ──────────────────────
    const { resources } = await client.listResources();
    const matrixResource = resources.find((r) => r.uri === "archdiagram://matrix-boards");
    assert(matrixResource, "Matrix boards resource should be registered");

    const resource = await client.readResource({ uri: "archdiagram://matrix-boards" });
    const resourceText = (resource.contents[0] as { text: string }).text;
    const resourceData = JSON.parse(resourceText) as Array<{ id: string }>;
    assert(resourceData.some((x) => x.id === boardId), "Board should appear in resource listing");
    console.log("✔ Matrix resource endpoint returns board");

    // ── Step 12: Error cases ──────────────────────────────────────
    const { isError: notFoundError } = await callTool(client, "get_matrix_board", { id: "nonexistent-id" });
    assert(notFoundError, "Getting non-existent board should return error");

    const { isError: badTaskError } = await callTool(client, "remove_matrix_task", {
      boardId,
      taskId: "nonexistent-task-id",
    });
    assert(badTaskError, "Removing non-existent task should return error");

    const { isError: updateBadBoardError } = await callTool(client, "update_matrix_task", {
      boardId: "bad-board-id",
      taskId: "any",
      title: "nope",
    });
    assert(updateBadBoardError, "Updating task on non-existent board should return error");
    console.log("✔ Error cases handled correctly");

    // ── Step 13: Delete the board ─────────────────────────────────
    await callTool(client, "delete_matrix_board", { id: boardId });
    const { isError: deletedError } = await callTool(client, "get_matrix_board", { id: boardId });
    assert(deletedError, "Getting deleted board should return error");
    console.log("✔ Board deleted and confirmed gone");

    console.log("\n🎉 All Matrix E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
