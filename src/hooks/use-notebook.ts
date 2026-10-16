import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AppError } from "@/lib/app-error.js";
import type { TranslationKey } from "@/i18n";
import { notebookStorageKey } from "@/lib/notebook-storage.js";
import {
  emptyNotebook,
  migrateNotebook,
  previewNotebook,
} from "@/lib/garage.js";
import {
  auth,
  firebaseMessage,
  appEnvironment,
  firebaseProjectId,
} from "@/lib/firebase";
import {
  subscribeGarage,
  writeNotebook,
  deleteNotebook,
  type GarageEntry,
} from "@/lib/cloud-notebook";
import { NotebookConflict } from "@/lib/notebook-transaction.js";
import type { Notebook } from "@/types";

export const LOCAL_KEY = notebookStorageKey(appEnvironment, firebaseProjectId);
function readLocal(): Notebook | null {
  const raw = localStorage.getItem(LOCAL_KEY);
  return raw ? migrateNotebook(JSON.parse(raw)) : null;
}
export function useNotebook() {
  const [entries, setEntries] = useState<GarageEntry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | "">("");
  const [local, setLocal] = useState<Notebook | null>(null);
  const [preview] = useState(previewNotebook);
  const [undo, setUndo] = useState<{
    state: Notebook;
    version: string;
    vehicleId: string;
  } | null>(null);
  const selected =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const vehicleId = selected?.id ?? "";
  const state =
    selected?.state ?? (!user ? (local ?? preview) : emptyNotebook());
  const version = `${user?.uid ?? "guest"}:${vehicleId}:${selected?.revision ?? 0}`;
  const current = useRef({ user, ready, entries, vehicleId, state, version });
  current.current = { user, ready, entries, vehicleId, state, version };
  const busy = useRef(false);
  const session = useRef(0);

  useEffect(() => {
    try {
      setLocal(readLocal());
    } catch {
      setError("errors.local_unreadable");
    }
  }, []);
  useEffect(() => {
    if (!auth) return;
    let dispose: (() => void) | undefined;
    let generation = 0;
    const stop = onAuthStateChanged(
      auth,
      (nextUser) => {
        const active = ++generation;
        session.current++;
        current.current.user = nextUser;
        current.current.ready = !nextUser;
        current.current.entries = [];
        current.current.vehicleId = "";
        dispose?.();
        setUser(nextUser);
        setEntries([]);
        setSelectedId("");
        setUndo(null);
        setError("");
        setReady(!nextUser);
        if (!nextUser) return;
        dispose = subscribeGarage(
          nextUser.uid,
          (next) => {
            if (active !== generation) return;
            setEntries(next);
            setReady(true);
            setError("");
            setUndo((previous) => {
              if (!previous) return null;
              const item = next.find(
                (entry) => entry.id === previous.vehicleId,
              );
              return previous.version ===
                `${nextUser.uid}:${item?.id}:${item?.revision}`
                ? previous
                : null;
            });
          },
          (cause) => {
            if (active !== generation) return;
            setReady(false);
            setError(firebaseMessage(cause));
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
      session.current++;
      dispose?.();
      stop();
    };
  }, []);

  const commit = useCallback(async (next: Notebook, expected: string) => {
    const before = { ...current.current };
    const activeSession = session.current;
    if (!before.user) throw new AppError("errors.sign_in_required");
    if (busy.current) throw new AppError("errors.save_running");
    if (!before.ready) throw new AppError("errors.not_ready");
    if (before.version !== expected || !before.vehicleId)
      throw new NotebookConflict();
    busy.current = true;
    setSaving(true);
    try {
      const revision = await writeNotebook(
        before.user.uid,
        before.vehicleId,
        next,
        Number(expected.split(":").at(-1)),
      );
      if (
        session.current !== activeSession ||
        current.current.user?.uid !== before.user.uid
      )
        return;
      const live = current.current.entries.find(
        (entry) => entry.id === before.vehicleId,
      );
      if (live && live.revision > revision) return;
      setEntries((items) =>
        items.map((item) =>
          item.id === before.vehicleId
            ? { ...item, state: next, revision }
            : item,
        ),
      );
      setError("");
      setUndo({
        state: before.state,
        vehicleId: before.vehicleId,
        version: `${before.user.uid}:${before.vehicleId}:${revision}`,
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, []);

  async function createVehicle(next: Notebook) {
    const before = { ...current.current };
    const activeSession = session.current;
    if (!before.user) throw new AppError("errors.sign_in_required");
    if (!before.ready) throw new AppError("errors.not_ready");
    if (busy.current) throw new AppError("errors.save_running");
    const id = crypto.randomUUID();
    busy.current = true;
    setSaving(true);
    try {
      const revision = await writeNotebook(before.user.uid, id, next, 0);
      if (
        session.current !== activeSession ||
        current.current.user?.uid !== before.user.uid
      )
        return;
      setEntries((items) =>
        items.some((item) => item.id === id)
          ? items
          : [...items, { id, state: next, revision }],
      );
      setSelectedId(id);
      setUndo(null);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function removeVehicle(expected: string) {
    const before = { ...current.current };
    const activeSession = session.current;
    if (!before.user) throw new AppError("errors.sign_in_required");
    if (!before.ready) throw new AppError("errors.not_ready");
    if (busy.current) throw new AppError("errors.save_running");
    if (before.version !== expected || !before.vehicleId)
      throw new NotebookConflict();
    busy.current = true;
    setSaving(true);
    try {
      await deleteNotebook(
        before.user.uid,
        before.vehicleId,
        Number(expected.split(":").at(-1)),
      );
      if (
        session.current !== activeSession ||
        current.current.user?.uid !== before.user.uid
      )
        return;
      setEntries((items) =>
        items.filter((item) => item.id !== before.vehicleId),
      );
      setSelectedId("");
      setUndo(null);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function undoLast() {
    if (!undo || undo.vehicleId !== vehicleId) return;
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
    vehicleId,
    vehicles: entries.map((entry) => ({
      id: entry.id,
      ...entry.state.vehicle,
    })),
    selectVehicle: setSelectedId,
    createVehicle,
    removeVehicle,
    commit,
    undoLast,
    canUndo: Boolean(undo && undo.vehicleId === vehicleId),
    hasVehicle: Boolean(selected || !user),
    isPreview: !user && !local,
    hasLocal: Boolean(local),
    localState: () => local,
  };
}
