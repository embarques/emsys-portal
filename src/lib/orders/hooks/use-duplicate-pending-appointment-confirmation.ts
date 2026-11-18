"use client";

import { useEffect, useRef, useState } from "react";

import {
  createWithDuplicatePendingAppointmentConfirmation,
  type ExistingPendingAppointment,
  type SubmitCreateOrder,
} from "@/lib/orders/duplicate-pending-appointment";
import type { Order, OrderFormValues } from "@/lib/orders/types";

export function useDuplicatePendingAppointmentConfirmation(active = true) {
  const [pendingExisting, setPendingExisting] = useState<ExistingPendingAppointment[] | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const busy = useRef(false);
  const session = useRef(0);
  const available = useRef(active);
  const resolveConfirmation = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    available.current = active;
    return () => {
      available.current = false;
      session.current += 1;
      resolveConfirmation.current?.(false);
      resolveConfirmation.current = null;
    };
  }, [active]);

  function respond(confirmed: boolean) {
    const resolve = resolveConfirmation.current;
    resolveConfirmation.current = null;
    setPendingExisting(null);
    resolve?.(confirmed);
  }

  async function submit(values: OrderFormValues, action: SubmitCreateOrder): Promise<Order | null> {
    if (busy.current || !available.current) return null;
    busy.current = true;
    const submittingSession = session.current;
    setIsConfirming(true);
    try {
      return await createWithDuplicatePendingAppointmentConfirmation(values, action, (existing) => {
        if (!available.current || submittingSession !== session.current) {
          return Promise.resolve(false);
        }
        setPendingExisting(existing);
        return new Promise<boolean>((resolve) => {
          resolveConfirmation.current = resolve;
        });
      });
    } finally {
      busy.current = false;
      setIsConfirming(false);
      setPendingExisting(null);
    }
  }

  return {
    pendingExisting,
    isConfirming,
    submit,
    respond,
  };
}
