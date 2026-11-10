export function LoanEntryForm({ entry }: { entry: { kind: string | null } }) {
  return <output id="loan-entry">{entry.kind ?? ""}</output>;
}

export function PendingInventoryDispatchesPanel({ presentation, onBusyChange }: { presentation?: string; onBusyChange?: (busy: boolean) => void }) {
  return <div>
    <output id="inventory-panel">{presentation ?? "page"}</output>
    <button type="button" onClick={() => onBusyChange?.(true)}>Start inventory save</button>
  </div>;
}
