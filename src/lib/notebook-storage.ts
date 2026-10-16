export function notebookStorageKey(
  environment: string,
  projectId: string,
): string {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
