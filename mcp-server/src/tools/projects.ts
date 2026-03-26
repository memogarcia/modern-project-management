import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  deleteProjectTask as dbDeleteProjectTask,
  getProjectById as dbGetProject,
  listProjects as dbListProjects,
  listProjectTasks as dbListProjectTasks,
  updateProject as dbUpdateProject,
  upsertProjectTask as dbUpsertProjectTask,
} from "../db.js";
import { toProjectResourceSummary } from "../../../shared/planview/projections.js";
import {
  projectCreateSchema,
  projectTaskUpsertSchema,
  projectUpdateSchema,
} from "../../../shared/planview/validation.js";
import { assertFound, registerJsonTool } from "../toolkit.js";

function requireProject(id: string) {
  return assertFound(dbGetProject(id), "project_not_found", `Project not found: ${id}`);
}

export function registerProjectTools(server: McpServer): void {
  registerJsonTool(
    server,
    "list_projects",
    {
      title: "List Projects",
      description: "List all saved projects so you can choose a project ID before reading or mutating its roadmap.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    () => dbListProjects().map((project) => toProjectResourceSummary(project))
  );

  registerJsonTool(
    server,
    "get_project",
    {
      title: "Get Project",
      description:
        "Get a full project roadmap document, including columns, epics, tasks, typed dependencies, and linked diagram or investigation IDs.",
      inputSchema: { id: z.string().describe("The project ID") },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ id }: { id: string }) => requireProject(id)
  );

  registerJsonTool(
    server,
    "create_project",
    {
      title: "Create Project",
      description:
        "Create a new project roadmap. The server automatically seeds default status columns so Gantt tasks can be scheduled immediately.",
      inputSchema: projectCreateSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (args: z.infer<typeof projectCreateSchema>) => {
      const input = projectCreateSchema.parse(args);
      return dbCreateProject(input);
    },
    { fallbackCode: "project_create_failed", fallbackMessage: "Failed to create project" }
  );

  registerJsonTool(
    server,
    "update_project",
    {
      title: "Update Project",
      description: "Update a project's name or description.",
      inputSchema: {
        id: z.string().describe("The project ID"),
        ...projectUpdateSchema.shape,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ id, ...patch }: { id: string } & z.infer<typeof projectUpdateSchema>) =>
      dbUpdateProject(id, projectUpdateSchema.parse(patch)),
    { fallbackCode: "project_update_failed", fallbackMessage: "Failed to update project" }
  );

  registerJsonTool(
    server,
    "delete_project",
    {
      title: "Delete Project",
      description: "Delete a project and all of its task-planning records.",
      inputSchema: { id: z.string().describe("The project ID") },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ id }: { id: string }) => {
      requireProject(id);
      dbDeleteProject(id);
      return { id, message: "Project deleted" };
    },
    { fallbackCode: "project_delete_failed", fallbackMessage: "Failed to delete project" }
  );

  registerJsonTool(
    server,
    "list_project_tasks",
    {
      title: "List Project Tasks",
      description: "List all tasks for a project, including typed dependencies and scheduling fields.",
      inputSchema: {
        projectId: z.string().describe("The project ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ projectId }: { projectId: string }) => {
      requireProject(projectId);
      return dbListProjectTasks(projectId);
    }
  );

  registerJsonTool(
    server,
    "upsert_project_task",
    {
      title: "Create or Update Project Task",
      description:
        "Create or fully replace a project task, including its schedule, tags, milestone metadata, and predecessor relationships. Treat the links and dependencies arrays as the complete desired state.",
      inputSchema: {
        projectId: z.string().describe("The project ID"),
        task: projectTaskUpsertSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ projectId, task }: { projectId: string; task: z.input<typeof projectTaskUpsertSchema> }) =>
      dbUpsertProjectTask(projectId, projectTaskUpsertSchema.parse(task)),
    { fallbackCode: "project_task_upsert_failed", fallbackMessage: "Failed to save project task" }
  );

  registerJsonTool(
    server,
    "delete_project_task",
    {
      title: "Delete Project Task",
      description: "Delete a task from a project roadmap.",
      inputSchema: {
        projectId: z.string().describe("The project ID"),
        taskId: z.string().describe("The task ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ projectId, taskId }: { projectId: string; taskId: string }) => {
      dbDeleteProjectTask(projectId, taskId);
      return { projectId, taskId, message: "Project task deleted" };
    },
    { fallbackCode: "project_task_delete_failed", fallbackMessage: "Failed to delete project task" }
  );
}
