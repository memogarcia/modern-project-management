import type { NodeTypes } from "@xyflow/react";
import ArchNodeComponent from "./ArchNode";
import DatabaseSchemaNodeComponent from "./DatabaseSchemaNode";
import GroupNodeComponent from "./GroupNode";
import TextNodeComponent from "./TextNode";

export const nodeTypes: NodeTypes = {
  archNode: ArchNodeComponent,
  databaseSchemaNode: DatabaseSchemaNodeComponent,
  groupNode: GroupNodeComponent,
  textNode: TextNodeComponent,
};
