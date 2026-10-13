/** @param {string} environment @param {string} projectId */
export function notebookStorageKey(environment, projectId) {
  return environment === "production"
    ? "bandit-maintenance-v1"
    : `bandit-maintenance-v1:${environment}:${projectId}`;
}
