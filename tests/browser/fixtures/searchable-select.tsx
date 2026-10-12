import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import type { OrderCommentFormValues } from "@/lib/orders/types";

function PickupCommentsFixture() {
  const [comments, setComments] = useState<OrderCommentFormValues[]>([]);
  const navigate = useFormEnterNavigation();
  return (
    <form onKeyDown={navigate} onSubmit={(event) => event.preventDefault()}>
      <input id="before-comments" autoFocus />
      <OrderCommentsEditor comments={comments} onChange={setComments} />
      <button type="submit" id="save">Save</button>
      <button type="button" id="new-record" onClick={() => setComments([])}>New</button>
      <output id="comments-value">{JSON.stringify(comments)}</output>
    </form>
  );
}

function Fixture() {
  const [value, setValue] = useState("NY");
  const [changes, setChanges] = useState(0);
  const navigate = useFormEnterNavigation();
  return (
    <form onKeyDown={navigate} onSubmit={(event) => event.preventDefault()}>
      <input id="first" />
      <SearchableSelect
        id="branch" value={value} required
        options={[{ value: "NY", label: "NY" }, { value: "RD", label: "RD" }]}
        onValueChange={(next) => { setValue(next); setChanges((count) => count + 1); }}
      />
      <SearchableSelect id="plain" searchable={false} value="NY"
        options={[{ value: "NY", label: "NY" }, { value: "RD", label: "RD" }]}
        onValueChange={() => {}} />
      <input id="last" />
      <button type="submit">Save</button>
      <output id="value">{value}</output><output id="changes">{changes}</output>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(
  document.documentElement.dataset.fixture === "comments" ? <PickupCommentsFixture /> : <Fixture />,
);
