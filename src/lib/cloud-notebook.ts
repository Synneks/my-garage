import { AppError } from "./app-error";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { validateState } from "@/engine";
import { migrateNotebook } from "./garage";
import { db } from "./firebase";
import { nextRevision } from "./notebook-transaction";
import type { Notebook } from "@/types";

export interface GarageEntry {
  id: string;
  state: Notebook;
  revision: number;
}
export function subscribeGarage(
  uid: string,
  onValue: (entries: GarageEntry[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!db) throw new AppError("errors.firebase_missing");
  return onSnapshot(
    collection(db, "users", uid, "notebooks"),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (
        snapshot.metadata.hasPendingWrites ||
        (snapshot.empty && snapshot.metadata.fromCache)
      )
        return;
      try {
        onValue(
          snapshot.docs.map((item) => {
            const data = item.data();
            if (!Number.isSafeInteger(data.revision) || data.revision < 1)
              throw new AppError("errors.cloud_version");
            return {
              id: item.id,
              state: migrateNotebook(data.state),
              revision: data.revision,
            };
          }),
        );
      } catch (error) {
        onError(error);
      }
    },
    onError,
  );
}
export async function writeNotebook(
  uid: string,
  vehicleId: string,
  next: Notebook,
  expected: number,
) {
  if (!db) throw new AppError("errors.firebase_missing");
  validateState(next);
  if (next.version !== 2) throw new AppError("errors.invalid_notebook");
  if (new TextEncoder().encode(JSON.stringify(next)).length > 800_000)
    throw new AppError("errors.size_limit");
  const ref = doc(db, "users", uid, "notebooks", vehicleId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const revision = nextRevision(
      snapshot.exists() ? snapshot.data() : null,
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
export async function deleteNotebook(
  uid: string,
  vehicleId: string,
  expected: number,
) {
  if (!db) throw new AppError("errors.firebase_missing");
  const ref = doc(db, "users", uid, "notebooks", vehicleId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    nextRevision(snapshot.exists() ? snapshot.data() : null, expected);
    transaction.delete(ref);
  });
}
