/**
 * End-to-end test: exercises all Gantt chart MCP tools.
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

    // ── Step 1: Verify Gantt tools are available ─────────────────
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    for (const expected of [
      "list_gantt_charts",
      "get_gantt_chart",
      "create_gantt_chart",
      "add_gantt_task",
      "update_gantt_task",
      "add_link_to_gantt_task",
      "delete_gantt_chart",
    ]) {
      assert(toolNames.includes(expected), `Missing tool: ${expected}`);
    }
    console.log("✔ All Gantt tools registered\n");

    // ── Step 2: Create a Gantt chart with initial tasks ──────────
    const { parsed: createResult } = await callTool(client, "create_gantt_chart", {
      name: "Q1 Sprint Plan",
      description: "Sprint planning for Q1 2026",
      tasks: [
        {
          name: "Design system architecture",
          startDate: "2026-01-05",
          endDate: "2026-01-16",
          status: "completed",
          priority: "high",
          progress: 100,
          assignee: "Alice",
          group: "Backend",
          links: [
            { label: "PROJ-101", url: "https://jira.example.com/PROJ-101", type: "jira" },
          ],
          metadata: { sprint: "Sprint 1", storyPoints: "8" },
        },
        {
          name: "Set up CI/CD pipeline",
          startDate: "2026-01-12",
          endDate: "2026-01-23",
          status: "in-progress",
          priority: "critical",
          progress: 60,
          assignee: "Bob",
          group: "DevOps",
          links: [
            { label: "PR #42", url: "https://github.com/org/repo/pull/42", type: "github-pr" },
          ],
        },
        {
          name: "Implement auth service",
          startDate: "2026-01-19",
          endDate: "2026-02-06",
          status: "not-started",
          priority: "high",
          progress: 0,
          group: "Backend",
        },
      ],
    });

    const chartId = (createResult as { id: string }).id;
    const taskCount = (createResult as { taskCount: number }).taskCount;
    assert(chartId, "Chart ID should be returned");
    assert.equal(taskCount, 3, "Should have 3 tasks");
    console.log(`✔ Created Gantt chart: ${chartId} with ${taskCount} tasks`);

    // ── Step 3: Get the chart and validate ───────────────────────
    const { parsed: chart } = await callTool(client, "get_gantt_chart", { id: chartId });
    const c = chart as { name: string; tasks: Array<{ id: string; name: string; links: unknown[]; status: string }> };
    assert.equal(c.name, "Q1 Sprint Plan");
    assert.equal(c.tasks.length, 3);
    assert.equal(c.tasks[0].name, "Design system architecture");
    assert.equal(c.tasks[0].status, "completed");
    assert(c.tasks[0].links.length >= 1, "First task should have a JIRA link");
    console.log("✔ Chart retrieved and validated");

    // ── Step 4: Add a new task ───────────────────────────────────
    const { parsed: addResult } = await callTool(client, "add_gantt_task", {
      chartId,
      name: "Write API documentation",
      startDate: "2026-02-02",
      endDate: "2026-02-13",
      status: "not-started",
      priority: "medium",
      progress: 0,
      assignee: "Charlie",
      group: "Backend",
      description: "Document all REST endpoints",
      links: [
        { label: "Confluence: API Docs", url: "https://confluence.example.com/api-docs", type: "confluence" },
      ],
      metadata: { sprint: "Sprint 2" },
    });
    const newTaskId = (addResult as { taskId: string }).taskId;
    assert(newTaskId, "New task ID should be returned");
    console.log(`✔ Added task: ${newTaskId}`);

    // ── Step 5: Update a task ────────────────────────────────────
    const existingTaskId = c.tasks[2].id; // "Implement auth service"
    const { parsed: updateResult } = await callTool(client, "update_gantt_task", {
      chartId,
      taskId: existingTaskId,
      status: "in-progress",
      progress: 25,
      assignee: "Dave",
    });
    const updatedTask = (updateResult as { task: { status: string; progress: number; assignee: string } }).task;
    assert.equal(updatedTask.status, "in-progress");
    assert.equal(updatedTask.progress, 25);
    assert.equal(updatedTask.assignee, "Dave");
    console.log("✔ Updated task status, progress, and assignee");

    // ── Step 6: Add a link to a task ─────────────────────────────
    await callTool(client, "add_link_to_gantt_task", {
      chartId,
      taskId: existingTaskId,
      label: "Issue #99",
      url: "https://github.com/org/repo/issues/99",
      type: "github-issue",
    });

    // Verify the link was added
    const { parsed: updatedChart } = await callTool(client, "get_gantt_chart", { id: chartId });
    const uc = updatedChart as { tasks: Array<{ id: string; links: Array<{ label: string; type: string }> }> };
    const taskWithLink = uc.tasks.find((t) => t.id === existingTaskId);
    assert(taskWithLink, "Task should still exist");
    assert(taskWithLink.links.some((l) => l.label === "Issue #99" && l.type === "github-issue"), "GitHub issue link should be present");
    console.log("✔ Added GitHub issue link to task");

    // ── Step 7: List Gantt charts ────────────────────────────────
    const { parsed: listResult } = await callTool(client, "list_gantt_charts", {});
    const list = listResult as Array<{ id: string; taskCount: number }>;
    assert(list.length >= 1, "Should have at least 1 chart");
    const listed = list.find((x) => x.id === chartId);
    assert(listed, "Created chart should appear in list");
    assert.equal(listed.taskCount, 4, "Should now have 4 tasks");
    console.log("✔ Chart appears in list with correct task count");

    // ── Step 8: Test Gantt resource ──────────────────────────────
    const { resources } = await client.listResources();
    const ganttResource = resources.find((r) => r.uri === "archdiagram://gantt-charts");
    assert(ganttResource, "Gantt charts resource should be registered");

    const resource = await client.readResource({ uri: "archdiagram://gantt-charts" });
    const resourceText = (resource.contents[0] as { text: string }).text;
    const resourceData = JSON.parse(resourceText) as Array<{ id: string }>;
    assert(resourceData.some((x) => x.id === chartId), "Chart should appear in resource listing");
    console.log("✔ Gantt resource endpoint returns chart");

    // ── Step 9: Delete the chart ─────────────────────────────────
    await callTool(client, "delete_gantt_chart", { id: chartId });

    const { isError } = await callTool(client, "get_gantt_chart", { id: chartId });
    assert(isError, "Getting deleted chart should return error");
    console.log("✔ Chart deleted and confirmed gone");

    console.log("\n🎉 All Gantt E2E tests passed!\n");
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
