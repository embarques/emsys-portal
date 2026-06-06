const STORAGE_KEY = "emsys-memo-pad";

let memoContent = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function readStoredMemo(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredMemo(content: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, content);
}

export function subscribeMemoPadStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMemoPadSnapshot(): string {
  return memoContent;
}

export function initializeMemoPadStore() {
  memoContent = readStoredMemo();
  emit();
}

export function setMemoPadContent(content: string) {
  memoContent = content;
  writeStoredMemo(memoContent);
  emit();
}

export function clearMemoPadContent() {
  memoContent = "";
  writeStoredMemo("");
  emit();
}
