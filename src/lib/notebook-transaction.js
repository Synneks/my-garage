export class NotebookConflict extends Error {
  constructor() { super('Carnetul a fost modificat în altă filă sau pe alt dispozitiv. Închide formularul și verifică datele actualizate înainte de a salva din nou.'); }
}
// Kept independent of the Firebase SDK so concurrency behaviour can be tested.
export function nextRevision(document, expected) {
  const revision = document?.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision !== expected) throw new NotebookConflict();
  return revision + 1;
}
