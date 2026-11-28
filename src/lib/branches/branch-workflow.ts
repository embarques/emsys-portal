import type { BranchFormValues } from "@/lib/branches/types";

export type BranchFormStep = "branch" | "address" | "contact" | "settings" | "review";

export const BRANCH_FORM_STEPS: BranchFormStep[] = [
  "branch",
  "address",
  "contact",
  "settings",
  "review",
];

export const BRANCH_STEP_FIELDS: Record<
  Exclude<BranchFormStep, "review">,
  (keyof BranchFormValues)[]
> = {
  branch: ["name", "code", "type", "logo", "disclaimer"],
  address: ["address"],
  contact: ["phones"],
  settings: ["settings"],
};

export function getBranchFormSteps(): BranchFormStep[] {
  return BRANCH_FORM_STEPS;
}

export function getBranchStepFields(
  step: Exclude<BranchFormStep, "review">,
): (keyof BranchFormValues)[] {
  return BRANCH_STEP_FIELDS[step];
}

export function getBranchStepLabelKey(step: BranchFormStep): string {
  if (step === "review") return "branches.wizard.steps.review";
  return `branches.form.sections.${step}`;
}

export function getBranchStepHintKey(step: BranchFormStep): string {
  return `branches.wizard.stepHints.${step}`;
}
