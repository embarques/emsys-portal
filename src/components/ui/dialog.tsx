"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspaceTabPortalContainer } from "@/lib/layout/workspace-tab-scope";

function Dialog({
  modal,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const portalContainer = useWorkspaceTabPortalContainer();
  const tabScoped = portalContainer != null;

  return (
    <DialogPrimitive.Root
      // Tab-scoped dialogs must not lock the document — users need the tab bar,
      // sidebar, and other tabs while a mutation runs in the background tab.
      modal={modal ?? !tabScoped}
      {...props}
    />
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
    tabScoped?: boolean;
  }
>(({ className, tabScoped = false, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "z-50 bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out",
      tabScoped ? "absolute inset-0" : "fixed inset-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => {
  const portalContainer = useWorkspaceTabPortalContainer();
  const tabScoped = portalContainer != null;

  function isShellChromeInteraction(target: EventTarget | null) {
    if (!(target instanceof Element) || !portalContainer) return false;
    // Clicks on toast feedback or outside this tab's portal host (tab bar,
    // sidebar, other chrome) should not dismiss the dialog.
    if (target.closest("[data-feedback-toast]")) return true;
    return !portalContainer.contains(target);
  }

  function handlePointerDownOutside(
    event: Parameters<NonNullable<typeof onPointerDownOutside>>[0],
  ) {
    if (isShellChromeInteraction(event.detail.originalEvent.target)) {
      event.preventDefault();
      return;
    }

    onPointerDownOutside?.(event);
  }

  function handleInteractOutside(
    event: Parameters<NonNullable<typeof onInteractOutside>>[0],
  ) {
    if (isShellChromeInteraction(event.target)) {
      event.preventDefault();
      return;
    }

    onInteractOutside?.(event);
  }

  return (
    <DialogPortal container={portalContainer ?? undefined}>
      <DialogOverlay tabScoped={tabScoped} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Always viewport-fixed so confirm/action dialogs stay on screen even
          // when the tab content is taller than the viewport. Overlay stays
          // absolute when tab-scoped so dimming remains inside the workspace tab.
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background p-6 shadow-xl outline-none",
          className,
        )}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-left", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
