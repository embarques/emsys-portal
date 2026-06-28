"use client";

import { useMutation } from "@tanstack/react-query";

import {
  generateLabelReport,
  type LabelReportRequest,
} from "@/lib/labels/api/label-reports-api";

export function useGenerateLabelReport() {
  return useMutation({
    mutationFn: (request: LabelReportRequest) => generateLabelReport(request),
  });
}
