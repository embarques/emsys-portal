import { createRoot } from "react-dom/client";
import { useForm, useWatch } from "react-hook-form";
import { InvoicePoliciesStep, type InvoicePoliciesAgreementState } from "@/components/invoices/invoice-policies-step";

function Fixture() {
  const form = useForm<InvoicePoliciesAgreementState>({ defaultValues: { agreed: false, skipSignature: true, signatureDataUrl: null } });
  const values = useWatch({ control: form.control });
  return <>
    <InvoicePoliciesStep number={1} policies={[]} value={{ agreed: values.agreed ?? false, skipSignature: values.skipSignature ?? true, signatureDataUrl: values.signatureDataUrl ?? null }} onChange={form.reset} />
    <output id="signature-data">{values.signatureDataUrl ?? ""}</output>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
