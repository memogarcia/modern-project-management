/**
 * End-to-end test: exercises project session MCP tools.
 *
 * Run:  npx tsx src/__tests__/e2e-sessions.test.ts
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
  const tmpDir = path.join(__dirname, `../../.test-sessions-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: { ...process.env, PLANVIEW_DB: path.join(tmpDir, "test.db") },
  });

  const client = new Client({ name: "sessions-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Create a project ─────────────────────────────────
    const { parsed: createResult } = await callTool(client, "create_project", {
      name: "Session Test Project",
    });
    const projectId = (createResult as { id: string }).id;
    assert(projectId);
    console.log(`✔ Created project: ${projectId}`);

    // Get project for column IDs
    const { parsed: project } = await callTool(client, "get_project", { id: projectId });
    const columns = (project as { columns: Array<{ id: string }> }).columns;

    // Create an epic + task for linking
    const { parsed: epicResult } = await callTool(client, "create_kanban_epic", {
      projectId,
      name: "Test Epic",
    });
    const epicId = (epicResult as { epicId: string }).epicId;

    const { parsed: taskResult } = await callTool(client, "create_kanban_task", {
      projectId,
      epicId,
      columnId: columns[0].id,
      name: "Test Task",
    });
    const taskId = (taskResult as { taskId: string }).taskId;
    console.log(`✔ Created epic and task for session linking`);

    // ── Step 2: Add a session ────────────────────────────────────
    const { parsed: sessionResult } = await callTool(client, "add_project_session", {
      projectId,
      title: "Morning Focus",
      notes: "Working on auth module",
    });
    const sessionId = (sessionResult as { sessionId: string }).sessionId;
    assert(sessionId, "Session ID should be returned");
    console.log(`✔ Created session: ${sessionId}`);

    // ── Step 3: Update session ───────────────────────────────────
    const { parsed: updateResult } = await callTool(client, "update_project_session", {
      projectId,
      sessionId,
      title: "Morning Deep Work",
      notes: "Focused on auth and tests",
    });
    assert.equal((updateResult as { title: string }).title, "Morning Deep Work");
    console.log("✔ Updated session title and notes");

    // ── Step 4: Link task to session ─────────────────────────────
    const { parsed: linkResult } = await callTool(client, "add_task_to_project_session", {
      projectId,
      sessionId,
      taskId,
    });
    assert.equal((linkResult as { taskCount: number }).taskCount, 1);
    console.log("✔ Linked task to session");

    // ── Step 5: Verify session data in project ───────────────────
    const { parsed: projectAfterSession } = await callTool(client, "get_project", { id: projectId });
    const sessions = (projectAfterSession as { sessions: Array<{ id: string; taskIds: string[] }> }).sessions;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, sessionId);
    assert.equal(sessions[0].taskIds.length, 1);
    console.log("✔ Session data persisted in project");

    // ── Step 6: Unlink task from session ─────────────────────────
    const { parsed: unlinkResult } = await callTool(client, "remove_task_from_project_session", {
      projectId,
      sessionId,
      taskId,
    });
    assert.equal((unlinkResult as { taskCount: number }).taskCount, 0);
    console.log("✔ Unlinked task from session");

    // ── Step 7: Add a second session ─────────────────────────────
    const { parsed: session2Result } = await callTool(client, "add_project_session", {
      projectId,
      title: "Afternoon Sprint",
      taskIds: [taskId],
    });
    const session2Id = (session2Result as { sessionId: string }).sessionId;
    console.log(`✔ Created second session with pre-linked task`);

    // ── Step 8: Delete task cleans session references ─────────────
    await callTool(client, "delete_kanban_task", { projectId, taskId });
    const { parsed: projectAfterDelete } = await callTool(client, "get_project", { id: projectId });
    const sessionsAfterDelete = (projectAfterDelete as { sessions: Array<{ taskIds: string[] }> }).sessions;
    const session2 = sessionsAfterDelete.find((s: { taskIds: string[] }) => sessionsAfterDelete.indexOf(s) === 1);
    // The second session should have its taskIds cleaned
    if (session2) {
      assert.equal(session2.taskIds.length, 0, "Deleted task should be removed from session taskIds");
    }
    console.log("✔ Deleting task cleans session taskIds");

    // ── Step 9: Remove session ───────────────────────────────────
    await callTool(client, "remove_project_session", { projectId, sessionId });
    const { parsed: projectAfterRemove } = await callTool(client, "get_project", { id: projectId });
    const sessionsAfterRemove = (projectAfterRemove as { sessions: unknown[] }).sessions;
    assert.equal(sessionsAfterRemove.length, 1, "Should have 1 session remaining");
    console.log("✔ Removed first session");

    // ── Step 10: Error handling ──────────────────────────────────
    const { isError: notFoundError } = await callTool(client, "add_project_session", {
      projectId: "nonexistent",
      title: "Nope",
    });
    assert(notFoundError, "Should error for nonexistent project");
    console.log("✔ Error handling for nonexistent project");

    // Cleanup
    await callTool(client, "delete_project", { id: projectId });

    console.log("\n✅ All Sessions E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Sessions E2E test failed:", err);
  process.exit(1);
});
