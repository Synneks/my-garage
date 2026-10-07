import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { TASKS, createInitialState } from "@/data.js";
import { validateState } from "@/engine.js";
import { auth, firebaseMessage } from "@/lib/firebase";
import { subscribeNotebook, writeNotebook } from "@/lib/cloud-notebook";
import { NotebookConflict } from "@/lib/notebook-transaction.js";
import type { Notebook } from "@/types";

export const LOCAL_KEY = "bandit-maintenance-v1";
function readLocal() {
  const raw = localStorage.getItem(LOCAL_KEY);
  const state = raw
    ? validateState(JSON.parse(raw), TASKS)
    : createInitialState();
  return { state, version: raw || "" };
}
export function useNotebook() {
  const [state, setState] = useState<Notebook>(createInitialState);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [undo, setUndo] = useState<{ state: Notebook; version: string } | null>(
    null,
  );
  const current = useRef({ state, user, version, ready, needsSetup });
  current.current = { state, user, version, ready, needsSetup };
  const busy = useRef(false);

  const restoreLocal = useCallback(() => {
    try {
      const local = readLocal();
      setState(local.state);
      setVersion(local.version);
      setError("");
    } catch {
      setState(createInitialState());
      setVersion("");
      setError(
        "Carnetul local nu poate fi citit. Copia existentă este păstrată. Importă un CSV valid pentru recuperare.",
      );
    }
  }, []);
  useEffect(() => {
    restoreLocal();
  }, [restoreLocal]);
  useEffect(() => {
    if (!auth) return;
    let disposeCloud: (() => void) | undefined;
    let generation = 0;
    const disposeAuth = onAuthStateChanged(
      auth,
      (nextUser) => {
        const activeGeneration = ++generation;
        disposeCloud?.();
        disposeCloud = undefined;
        setUser(nextUser);
        setUndo(null);
        setNeedsSetup(false);
        setError("");
        if (!nextUser) {
          restoreLocal();
          setReady(true);
          return;
        }
        setReady(false);
        disposeCloud = subscribeNotebook(
          nextUser.uid,
          (cloud, revision) => {
            if (activeGeneration !== generation) return;
            setState(cloud || readLocalSafe());
            setVersion(`${nextUser.uid}:${revision}`);
            setNeedsSetup(!cloud);
            setReady(true);
            setError("");
            // An undo is valid only for the immediately following document revision.
            setUndo((previous) =>
              previous?.version === `${nextUser.uid}:${revision}`
                ? previous
                : null,
            );
          },
          (cause) => {
            if (activeGeneration === generation) {
              setError(firebaseMessage(cause));
              setReady(false);
            }
          },
        );
      },
      (cause) => {
        setError(firebaseMessage(cause));
        setReady(false);
      },
    );
    return () => {
      generation++;
      disposeCloud?.();
      disposeAuth();
    };
  }, [restoreLocal]);

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === LOCAL_KEY && !current.current.user) {
        restoreLocal();
        setUndo(null);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [restoreLocal]);

  const commit = useCallback(
    async (next: Notebook, expected: string, recovery = false) => {
      if (busy.current) throw new Error("O salvare este deja în curs.");
      const before = current.current;
      if (before.version !== expected) throw new NotebookConflict();
      if (!before.ready)
        throw new Error(
          "Așteaptă încărcarea carnetului sau reconectează-te înainte de a salva.",
        );
      validateState(next, TASKS);
      busy.current = true;
      setSaving(true);
      try {
        let writtenVersion: string;
        if (before.user) {
          const expectedRevision = Number(
            expected.slice(expected.lastIndexOf(":") + 1),
          );
          const revision = await writeNotebook(
            before.user.uid,
            next,
            expectedRevision,
          );
          writtenVersion = `${before.user.uid}:${revision}`;
          // A sign-out / account switch while saving must never display the old account's data.
          if (current.current.user?.uid !== before.user.uid) return;
          const liveRevision = Number(
            current.current.version.slice(
              current.current.version.lastIndexOf(":") + 1,
            ),
          );
          if (liveRevision > revision) return;
        } else {
          if (!recovery && (localStorage.getItem(LOCAL_KEY) || "") !== expected)
            throw new NotebookConflict();
          writtenVersion = JSON.stringify(next);
          localStorage.setItem(LOCAL_KEY, writtenVersion);
        }
        setState(next);
        setVersion(writtenVersion);
        setNeedsSetup(false);
        setError("");
        setUndo({ state: before.state, version: writtenVersion });
      } finally {
        busy.current = false;
        setSaving(false);
      }
    },
    [],
  );

  async function undoLast() {
    if (!undo) return;
    await commit(undo.state, undo.version);
    setUndo(null);
  }
  return {
    state,
    user,
    version,
    ready,
    saving,
    error,
    needsSetup,
    commit,
    undoLast,
    canUndo: Boolean(undo),
    localState: readLocalSafe,
  };
}
function readLocalSafe() {
  try {
    return readLocal().state;
  } catch {
    return createInitialState();
  }
}
