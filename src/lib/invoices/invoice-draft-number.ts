// Only draft identifiers are persisted. The API supplies the ownership proof on each recovery.
export async function lockInvoiceNumberDraft(scope: string) {
  const prefix = `invoice-number-draft:${scope}:`;
  const fresh = crypto.randomUUID();
  const available = Object.keys(localStorage).filter(key => key.startsWith(prefix));
  for (const key of [...available, prefix + fresh]) {
    let unlock!: () => void;
    const held = new Promise<void>(resolve => { unlock = resolve; });
    const acquired = await new Promise<boolean>((resolve, reject) => {
      navigator.locks.request(key, { ifAvailable: true }, async lock => {
        resolve(Boolean(lock));
        if (lock) await held;
      }).catch(reject);
    });
    if (!acquired) continue;
    try {
      const id = key.slice(prefix.length);
      const releaseId = localStorage.getItem(key);
      if (!releaseId && id !== fresh) { unlock(); continue; }
      const releaseRequestId = releaseId ?? crypto.randomUUID();
      localStorage.setItem(key, releaseRequestId);
      return {
        id, releaseRequestId, recovering: Boolean(releaseId),
        unlock,
        forget() { localStorage.removeItem(key); unlock(); },
      };
    } catch (error) {
      unlock();
      throw error;
    }
  }
  throw new Error("Unable to lock invoice draft.");
}
