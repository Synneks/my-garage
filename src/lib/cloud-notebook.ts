import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { TASKS } from "@/data.js";
import { validateState } from "@/engine.js";
import { db } from "./firebase";
import { nextRevision } from "./notebook-transaction.js";
import type { Notebook } from "@/types";

export function subscribeNotebook(
  uid: string,
  onValue: (state: Notebook | null, revision: number) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!db) throw new Error("Firebase nu este configurat.");
  return onSnapshot(
    doc(db, "users", uid, "notebooks", "bandit"),
    { includeMetadataChanges: true },
    (snapshot) => {
      // Do not expose a pending local write as a successful server save.
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      try {
        if (!snapshot.exists()) {
          onValue(null, 0);
          return;
        }
        const data = snapshot.data();
        if (!Number.isSafeInteger(data.revision) || data.revision < 1)
          throw new Error("Carnetul din cloud are o versiune invalidă.");
        onValue(validateState(data.state, TASKS), data.revision);
      } catch (error) {
        onError(error);
      }
    },
    onError,
  );
}

export async function writeNotebook(
  uid: string,
  next: Notebook,
  expected: number,
) {
  if (!db) throw new Error("Firebase nu este configurat.");
  validateState(next, TASKS);
  if (next.events.length > 5_000)
    throw new Error(
      "Carnetul poate conține cel mult 5.000 de intervenții în cloud. Exportă un backup CSV înainte de arhivare.",
    );
  if (new TextEncoder().encode(JSON.stringify(next)).length > 800_000)
    throw new Error(
      "Carnetul depășește limita de salvare în cloud. Exportă istoricul CSV înainte de a-l arhiva.",
    );
  const ref = doc(db, "users", uid, "notebooks", "bandit");
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    const revision = nextRevision(
      current.exists() ? current.data() : null,
      expected,
    );
    transaction.set(ref, {
      state: next,
      revision,
      updatedAt: serverTimestamp(),
    });
    return revision;
  });
}
