import type { NodeTypes } from "@xyflow/react";
import ArchNodeComponent from "./ArchNode";
import DatabaseSchemaNodeComponent from "./DatabaseSchemaNode";
import GroupNodeComponent from "./GroupNode";

export const nodeTypes: NodeTypes = {
  archNode: ArchNodeComponent,
  databaseSchemaNode: DatabaseSchemaNodeComponent,
  groupNode: GroupNodeComponent,
};
