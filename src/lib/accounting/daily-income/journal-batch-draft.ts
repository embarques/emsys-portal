import type { DailyIncomeJournal } from "./types";

export type JournalBatchQueue = "reconciliation" | "clearance";

export type JournalBatchDraft = {
  queue: JournalBatchQueue;
  requestId: string;
  ids: string[];
  rows: DailyIncomeJournal[];
};

const memory = new Map<string, JournalBatchDraft>();
const STORAGE_KEY = "emsys-journal-batch-drafts";

type ConfirmedListener = (ids: string[]) => void;
const confirmedListeners = new Set<ConfirmedListener>();

function readSessionStore(): Record<string, JournalBatchDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, JournalBatchDraft>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionStore(store: Record<string, JournalBatchDraft>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Session quota or private-mode failures should not block confirmation.
  }
}

export function stashJournalBatch(draft: JournalBatchDraft) {
  memory.set(draft.requestId, draft);
  const store = readSessionStore();
  store[draft.requestId] = draft;
  writeSessionStore(store);
}

export function readJournalBatch(requestId: string | null | undefined): JournalBatchDraft | null {
  if (!requestId) return null;
  const cached = memory.get(requestId);
  if (cached) return cached;
  const fromSession = readSessionStore()[requestId];
  if (fromSession) {
    memory.set(requestId, fromSession);
    return fromSession;
  }
  return null;
}

export function clearJournalBatch(requestId: string | null | undefined) {
  if (!requestId) return;
  memory.delete(requestId);
  const store = readSessionStore();
  if (!(requestId in store)) return;
  delete store[requestId];
  writeSessionStore(store);
}

export function publishJournalBatchConfirmed(ids: string[]) {
  if (ids.length === 0) return;
  for (const listener of confirmedListeners) listener(ids);
}

export function subscribeJournalBatchConfirmed(listener: ConfirmedListener) {
  confirmedListeners.add(listener);
  return () => {
    confirmedListeners.delete(listener);
  };
}
