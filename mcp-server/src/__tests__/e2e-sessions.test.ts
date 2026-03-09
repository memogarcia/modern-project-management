/**
 * End-to-end test: exercises all Session MCP tools.
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
    env: { ...process.env, DIAGRAMS_DIR: tmpDir },
  });

  const client = new Client({ name: "sessions-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    console.log("✔ Connected to MCP server\n");

    // ── Step 1: Verify all session tools are registered ──────────
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    for (const expected of [
      "list_sessions",
      "get_session",
      "create_session",
      "update_session",
      "delete_session",
      "add_session_task",
      "remove_session_task",
      "add_session_link",
      "remove_session_link",
    ]) {
      assert(toolNames.includes(expected), `Missing tool: ${expected}`);
    }
    console.log("✔ All session tools registered\n");

    // ── Step 2: List sessions (empty) ────────────────────────────
    const { parsed: emptyList } = await callTool(client, "list_sessions", {});
    assert(Array.isArray(emptyList), "list_sessions should return an array");
    assert.equal((emptyList as unknown[]).length, 0, "Should start with no sessions");
    console.log("✔ Empty session list returned");

    // ── Step 3: Create a session ──────────────────────────────────
    const { parsed: createResult } = await callTool(client, "create_session", {
      title: "Deep Work: Auth Module",
      notes: "Implementing JWT-based authentication",
      tasks: ["Design token schema", "Write middleware"],
      links: [
        { label: "Auth PR", url: "https://github.com/org/repo/pull/10", type: "github" },
      ],
    });
    const sessionId = (createResult as { id: string }).id;
    assert(sessionId, "Session ID should be returned");
    console.log(`✔ Created session: ${sessionId}`);

    // ── Step 4: Get the session and validate ─────────────────────
    const { parsed: session } = await callTool(client, "get_session", { id: sessionId });
    const s = session as {
      id: string;
      title: string;
      notes: string;
      tasks: string[];
      links: Array<{ label: string; type: string }>;
      pomodorosCompleted: number;
    };
    assert.equal(s.id, sessionId);
    assert.equal(s.title, "Deep Work: Auth Module");
    assert.equal(s.notes, "Implementing JWT-based authentication");
    assert.equal(s.tasks.length, 2);
    assert.equal(s.tasks[0], "Design token schema");
    assert.equal(s.links.length, 1);
    assert.equal(s.links[0].type, "github");
    assert.equal(s.pomodorosCompleted, 0);
    console.log("✔ Session retrieved and validated");

    // ── Step 5: Update session meta ───────────────────────────────
    const { parsed: updateResult } = await callTool(client, "update_session", {
      id: sessionId,
      title: "Deep Work: Auth Module v2",
      notes: "Refactored JWT implementation",
    });
    assert(!(updateResult as { isError?: boolean }).isError, "Update should succeed");
    const { parsed: updatedSession } = await callTool(client, "get_session", { id: sessionId });
    const us = updatedSession as { title: string; notes: string };
    assert.equal(us.title, "Deep Work: Auth Module v2");
    assert.equal(us.notes, "Refactored JWT implementation");
    console.log("✔ Session title and notes updated");

    // ── Step 6: Add a task ────────────────────────────────────────
    const { parsed: addTaskResult } = await callTool(client, "add_session_task", {
      id: sessionId,
      task: "Write unit tests",
    });
    const taskCount = (addTaskResult as { taskCount: number }).taskCount;
    assert.equal(taskCount, 3, "Should now have 3 tasks");
    console.log("✔ Task added (3 total)");

    // ── Step 7: Remove a task ─────────────────────────────────────
    const { parsed: removeTaskResult } = await callTool(client, "remove_session_task", {
      id: sessionId,
      index: 0,
    });
    const taskCountAfter = (removeTaskResult as { taskCount: number }).taskCount;
    assert.equal(taskCountAfter, 2, "Should now have 2 tasks after removal");
    console.log("✔ Task removed (2 remaining)");

    // ── Step 8: Add a link ────────────────────────────────────────
    const { parsed: addLinkResult } = await callTool(client, "add_session_link", {
      id: sessionId,
      label: "Auth Diagram",
      url: "https://example.com/diagram/auth",
      type: "diagram",
    });
    const linkCount = (addLinkResult as { linkCount: number }).linkCount;
    assert.equal(linkCount, 2, "Should now have 2 links");
    console.log("✔ Link added (2 total)");

    // ── Step 9: Remove a link ─────────────────────────────────────
    const { parsed: removeLinkResult } = await callTool(client, "remove_session_link", {
      id: sessionId,
      index: 0,
    });
    const linkCountAfter = (removeLinkResult as { linkCount: number }).linkCount;
    assert.equal(linkCountAfter, 1, "Should now have 1 link after removal");
    console.log("✔ Link removed (1 remaining)");

    // ── Step 10: List sessions confirms presence ──────────────────
    const { parsed: listResult } = await callTool(client, "list_sessions", {});
    const list = listResult as Array<{ id: string; taskCount: number }>;
    assert(list.length >= 1, "Should have at least 1 session");
    const listed = list.find((x) => x.id === sessionId);
    assert(listed, "Created session should appear in list");
    assert.equal(listed.taskCount, 2, "Should have 2 tasks");
    console.log("✔ Session appears in list with correct task count");

    // ── Step 11: Test sessions resource ──────────────────────────
    const { resources } = await client.listResources();
    const sessionsResource = resources.find((r) => r.uri === "archdiagram://sessions");
    assert(sessionsResource, "Sessions resource should be registered");

    const resource = await client.readResource({ uri: "archdiagram://sessions" });
    const resourceText = (resource.contents[0] as { text: string }).text;
    const resourceData = JSON.parse(resourceText) as Array<{ id: string }>;
    assert(resourceData.some((x) => x.id === sessionId), "Session should appear in resource listing");
    console.log("✔ Sessions resource endpoint returns session");

    // ── Step 12: Error cases ──────────────────────────────────────
    const { isError: notFoundError } = await callTool(client, "get_session", { id: "nonexistent-id" });
    assert(notFoundError, "Getting non-existent session should return error");

    const { isError: badIndexError } = await callTool(client, "remove_session_task", {
      id: sessionId,
      index: 999,
    });
    assert(badIndexError, "Out-of-range index should return error");
    console.log("✔ Error cases handled correctly");

    // ── Step 13: Delete the session ───────────────────────────────
    await callTool(client, "delete_session", { id: sessionId });
    const { isError: deletedError } = await callTool(client, "get_session", { id: sessionId });
    assert(deletedError, "Getting deleted session should return error");
    console.log("✔ Session deleted and confirmed gone");

    console.log("\n🎉 All Session E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
