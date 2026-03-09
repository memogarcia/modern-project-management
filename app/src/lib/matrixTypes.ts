export type MatrixQuadrant = "do-first" | "schedule" | "delegate" | "drop";

export interface MatrixTask {
  id: string;
  title: string;
  quadrant: MatrixQuadrant;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixBoardMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixBoard extends MatrixBoardMeta {
  tasks: MatrixTask[];
}
