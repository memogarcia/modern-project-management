import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ parsed: unknown; raw: string; isError?: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const textContent = (result.content as Array<{ type: string; text: string }>).find(
    (content) => content.type === "text"
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

async function readResource(client: Client, uri: string): Promise<unknown> {
  const result = await client.readResource({ uri });
  const text = (result.contents as Array<{ mimeType?: string; text?: string }>)[0]?.text;
  assert(text, `Resource '${uri}' returned no text payload`);
  return JSON.parse(text);
}

async function runTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "planview-project-mcp-"));
  const serverEntrypoint = path.resolve(__dirname, "../index.ts");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntrypoint],
    env: {
      ...process.env,
      PLANVIEW_DB: path.join(tmpDir, "planview.db"),
      PLANVIEW_ARTIFACTS_DIR: path.join(tmpDir, "artifacts"),
    },
  });

  const client = new Client({ name: "project-gantt-test", version: "1.0.0" });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name);
    for (const expectedTool of [
      "list_projects",
      "get_project",
      "create_project",
      "update_project",
      "delete_project",
      "list_project_tasks",
      "upsert_project_task",
      "delete_project_task",
    ]) {
      assert(toolNames.includes(expectedTool), `Missing tool: ${expectedTool}`);
    }

    const { parsed: createdProject } = await callTool(client, "create_project", {
      id: "beta_launch",
      name: "Beta launch",
      description: "Roadmap managed through MCP",
    });
    const projectId = (createdProject as { id: string }).id;
    assert.equal(projectId, "beta_launch");

    await callTool(client, "upsert_project_task", {
      projectId,
      task: {
        id: "scope_lock",
        columnId: "todo",
        name: "Lock scope",
        description: "Finalize the beta scope",
        priority: "high",
        assignee: "product",
        startDate: "2026-04-01",
        dueDate: "2026-04-03",
        progress: 25,
        tags: ["beta"],
        links: [],
        dependencies: [],
        metadata: { isMilestone: false },
      },
    });

    const { parsed: milestoneTask } = await callTool(client, "upsert_project_task", {
      projectId,
      task: {
        id: "go_live",
        columnId: "review",
        name: "Go live",
        description: "Beta milestone",
        priority: "critical",
        assignee: "ops",
        startDate: "2026-04-10",
        dueDate: "2026-04-10",
        progress: 0,
        tags: ["milestone"],
        links: [],
        dependencies: [{ dependsOnTaskId: "scope_lock", type: "finish-to-start" }],
        metadata: { isMilestone: true },
      },
    });
    assert.equal((milestoneTask as { id: string }).id, "go_live");

    const { parsed: project } = await callTool(client, "get_project", { id: projectId });
    assert.equal((project as { taskCount: number }).taskCount, 2);
    assert.equal((project as { dependencyCount: number }).dependencyCount, 1);

    const { parsed: listedTasks } = await callTool(client, "list_project_tasks", { projectId });
    assert.equal((listedTasks as Array<unknown>).length, 2);

    const projectCollection = (await readResource(client, "planview://projects")) as Array<{
      id: string;
    }>;
    assert(projectCollection.some((entry) => entry.id === projectId));

    const projectResource = (await readResource(client, `planview://projects/${projectId}`)) as {
      tasks: unknown[];
    };
    assert.equal(projectResource.tasks.length, 2);

    const ganttResource = (await readResource(client, `planview://projects/${projectId}/gantt`)) as {
      tasks: Array<{ dependencies: unknown[] }>;
    };
    assert.equal(ganttResource.tasks[1]?.dependencies.length, 1);

    await callTool(client, "delete_project_task", {
      projectId,
      taskId: "go_live",
    });
    const { parsed: projectAfterDelete } = await callTool(client, "get_project", { id: projectId });
    assert.equal((projectAfterDelete as { taskCount: number }).taskCount, 1);

    await callTool(client, "delete_project", { id: projectId });
    const projectsAfterDelete = (await readResource(client, "planview://projects")) as Array<{
      id: string;
    }>;
    assert(!projectsAfterDelete.some((entry) => entry.id === projectId));
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest()
  .then(() => {
    console.log("✅ MCP project Gantt E2E test passed");
  })
  .catch((error) => {
    console.error("❌ MCP project Gantt E2E test failed:", error);
    process.exitCode = 1;
  });
