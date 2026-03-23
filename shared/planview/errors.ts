export class PlanViewError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "PlanViewError";
    this.code = code;
    this.status = options?.status ?? 400;
    this.details = options?.details;
  }
}

export function asPlanViewError(error: unknown): PlanViewError {
  if (error instanceof PlanViewError) return error;
  if (error instanceof Error) {
    return new PlanViewError("internal_error", error.message, { status: 500 });
  }
  return new PlanViewError("internal_error", "Unknown PlanView error", { status: 500 });
}

