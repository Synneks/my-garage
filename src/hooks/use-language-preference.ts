import { useEffect, useRef, useState } from "react";
import { i18n, type Language } from "@/i18n";
import {
  browserStorage,
  cacheLanguage,
  isLanguage,
  languageKey,
  readLanguage,
} from "@/i18n/language.js";
import {
  initializeLanguage,
  subscribeLanguage,
  writeLanguage,
} from "@/lib/interface-preference";

type SyncState = "idle" | "pending" | "failed";
export function useLanguagePreference(uid?: string) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const retryWrite = useRef(false);
  const session = useRef({
    uid,
    generation: 0,
    sequence: 0,
    pending: false,
    failed: false,
    initializing: false,
  });
  const memory = useRef(new Map<string, Language>());
  const latestUid = useRef(uid);
  latestUid.current = uid;

  function cached(account?: string) {
    return (
      memory.current.get(languageKey(account)) ??
      (readLanguage(browserStorage(), navigator.languages, account) as Language)
    );
  }
  function apply(language: Language, account?: string) {
    memory.current.set(languageKey(account), language);
    cacheLanguage(browserStorage(), language, account);
    void i18n.changeLanguage(language);
  }
  useEffect(() => {
    const generation = session.current.generation + 1;
    const active = {
      uid,
      generation,
      sequence: 0,
      pending: false,
      failed: false,
      initializing: false,
    };
    session.current = active;
    setSyncState(uid ? "pending" : "idle");
    const current = () =>
      session.current === active &&
      latestUid.current === uid &&
      active.generation >= 0;
    // An account without a cached preference initially uses the current browser language.
    const initial = uid
      ? (memory.current.get(languageKey(uid)) ??
        readAccountCache(uid) ??
        cached())
      : cached();
    apply(initial, uid);
    const failed = () => {
      if (current()) {
        active.failed = true;
        setSyncState("failed");
      }
    };
    let dispose: (() => void) | undefined;
    if (uid) {
      try {
        dispose = subscribeLanguage(
          uid,
          (language) => {
            if (!current()) return;
            if (active.pending || active.failed) return;
            if (language) {
              apply(language, uid);
              setSyncState("idle");
            } else if (!active.initializing) {
              active.initializing = true;
              const sequence = active.sequence;
              void initializeLanguage(uid, i18n.language as Language)
                .then((value) => {
                  if (current() && sequence === active.sequence) {
                    apply(value, uid);
                    setSyncState("idle");
                  }
                })
                .catch(() => {
                  if (active.sequence === sequence) failed();
                })
                .finally(() => {
                  active.initializing = false;
                });
            }
          },
          failed,
        );
      } catch {
        failed();
      }
    }
    if (retryWrite.current) {
      retryWrite.current = false;
      selectLanguage(initial);
    }
    const storage = (event: StorageEvent) => {
      if (
        current() &&
        event.key === languageKey(uid) &&
        isLanguage(event.newValue) &&
        !active.pending &&
        !active.failed
      ) {
        memory.current.set(languageKey(uid), event.newValue as Language);
        void i18n.changeLanguage(event.newValue!);
      }
    };
    window.addEventListener("storage", storage);
    return () => {
      dispose?.();
      window.removeEventListener("storage", storage);
      active.generation = -1;
    };
  }, [uid, retryCount]);

  function selectLanguage(language: Language) {
    if (!isLanguage(language)) return;
    const active = session.current;
    const account = latestUid.current;
    apply(language, account);
    const sequence = ++active.sequence;
    active.failed = false;
    if (!account) {
      setSyncState("idle");
      return;
    }
    active.pending = true;
    setSyncState("pending");
    void writeLanguage(account, language)
      .then((committed) => {
        if (
          session.current !== active ||
          latestUid.current !== account ||
          active.sequence !== sequence ||
          active.generation < 0
        )
          return;
        active.pending = false;
        // The latest committed snapshot may include a newer selection from another device.
        apply(committed, account);
        setSyncState("idle");
      })
      .catch(() => {
        if (
          session.current !== active ||
          latestUid.current !== account ||
          active.sequence !== sequence ||
          active.generation < 0
        )
          return;
        active.pending = false;
        active.failed = true;
        setSyncState("failed");
      });
  }
  function retry() {
    retryWrite.current = session.current.sequence > 0;
    setRetryCount((count) => count + 1);
  }
  return { syncState, selectLanguage, retry };
}
function readAccountCache(uid: string): Language | undefined {
  try {
    const value = browserStorage()?.getItem(languageKey(uid));
    return isLanguage(value) ? (value as Language) : undefined;
  } catch {
    return undefined;
  }
}
