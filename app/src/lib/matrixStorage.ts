import type { MatrixBoard } from "@/lib/matrixTypes";

const API_BASE = "/api/matrix";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`.trim();
}

export async function loadMatrixBoards(): Promise<MatrixBoard[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      console.error(`Failed to load matrix boards: ${await readErrorMessage(res)}`);
      return [];
    }
    return (await res.json()) as MatrixBoard[];
  } catch (error) {
    console.error("Failed to load matrix boards", error);
    return [];
  }
}

export async function loadMatrixBoard(id: string): Promise<MatrixBoard | null> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as MatrixBoard;
}

export async function saveMatrixBoard(board: MatrixBoard): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...board,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save matrix board: ${await readErrorMessage(res)}`);
  }
}

export async function deleteMatrixBoard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete matrix board: ${await readErrorMessage(res)}`);
  }
}
