import { AppError } from "./app-error";
export class NotebookConflict extends AppError {
  constructor() {
    super("errors.conflict");
  }
}
// Kept independent of the Firebase SDK so concurrency behaviour can be tested.
export function nextRevision(
  document: { revision?: unknown } | null,
  expected: number,
): number {
  const revision = document?.revision ?? 0;
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision !== expected
  )
    throw new NotebookConflict();
  return revision + 1;
}
