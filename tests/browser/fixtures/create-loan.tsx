import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CreateLoanDialog } from "@/components/accounting/create-loan-dialog";
const branch = { id: 1, name: "New York", code: "NY" };
function Fixture() {
  const [open, setOpen] = useState(true);
  return <CreateLoanDialog open={open} onOpenChange={setOpen} pending={false}
    employees={[{ id: 1, name: "Ana" }]}
    loanAccounts={[{ id: 2, name: "Employee loans", displayName: "Employee loans", type: "ASSET", description: "", systemAccount: false, branchAccount: true, default: false, branch }]}
    assetAccounts={[{ id: 3, name: "Cash", displayName: "Cash", type: "ASSET", description: "", systemAccount: false, branchAccount: true, default: false, branch }]}
    onSubmit={async values => {
      (window.loanSubmissions ??= []).push(values);
      await new Promise(resolve => setTimeout(resolve, 50));
      if (window.loanSubmitFails) { window.loanSubmitFails = false; throw new Error("Loan could not be saved"); }
      setOpen(false);
    }} />;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
