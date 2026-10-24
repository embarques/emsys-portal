import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createEmptyInvoiceForm, type InvoiceFormValues } from "@/lib/invoices/types";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function InvoiceWizardStepFixture() {
  const step = Number(document.documentElement.dataset.step ?? 1) as 1 | 2 | 3;
  const [receiverId, setReceiverId] = useState("");
  return <QueryClientProvider client={queryClient}><TooltipProvider>
    <div data-testid="invoice-form-wizard" className="flex h-screen min-h-0 flex-col">
      <InvoiceForm appearance="wizard" wizardStep={step} wizardTotalSteps={7} showFooter={false}
        showPaymentLocation={false} initialValues={{ ...createEmptyInvoiceForm(), containerId: "7" }}
        submitLabel="Save" onSubmit={() => ({ error: null })} onCancel={() => {}}
        onValuesChange={(values: InvoiceFormValues) => setReceiverId(values.receiverId)}
        onContinue={() => document.getElementById("wizard-next")?.focus()} />
      <button type="button" id="wizard-next" data-wizard-primary>Next</button>
      <output id="selected-receiver">{receiverId}</output>
    </div>
  </TooltipProvider></QueryClientProvider>;
}

createRoot(document.getElementById("root")!).render(<InvoiceWizardStepFixture />);
