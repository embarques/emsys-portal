import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { usePinnedEditSnapshot } from "@/lib/forms/use-pinned-edit-snapshot";

function Fixture() {
  const [server, setServer] = useState({ version: "v1:" + "a".repeat(64), name: "Original" });
  const snapshot = usePinnedEditSnapshot("record", server)!;
  const { register, reset } = useForm({ defaultValues: { name: snapshot.name } });
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  useEffect(() => reset({ name: snapshot.name }), [snapshot, reset]);
  return <>
    <input aria-label="Name" {...register("name")} />
    <button onClick={() => setServer({ version: "v1:" + "b".repeat(64), name: "Other user's save" })}>Background refresh</button>
    <button onClick={() => {
      setSent('"' + snapshot.version + '"');
      setError("Changed by another user. Your input is preserved.");
    }}>Save</button>
    {error && <p role="alert">{error}</p>}
    <output>{sent}</output>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
