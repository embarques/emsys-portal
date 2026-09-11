"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspaceTabPortalContainer } from "@/lib/layout/workspace-tab-scope";

function Sheet({
  modal,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const portalContainer = useWorkspaceTabPortalContainer();
  const tabScoped = portalContainer != null;

  return (
    <SheetPrimitive.Root modal={modal ?? !tabScoped} {...props} />
  );
}

const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> & {
    tabScoped?: boolean;
  }
>(({ className, tabScoped = false, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "z-50 bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out",
      tabScoped ? "absolute inset-0" : "fixed inset-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetSideClasses = {
  top: "inset-x-0 top-0 border-b",
  bottom: "inset-x-0 bottom-0 border-t",
  left: "inset-y-0 left-0 h-full w-80 max-w-[86vw] border-r",
  right: "inset-y-0 right-0 h-full w-80 max-w-[86vw] border-l",
};

type SheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sheetSideClasses;
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => {
  const portalContainer = useWorkspaceTabPortalContainer();
  const tabScoped = portalContainer != null;

  function isShellChromeInteraction(target: EventTarget | null) {
    if (!(target instanceof Element) || !portalContainer) return false;
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
    <SheetPortal container={portalContainer ?? undefined}>
      <SheetOverlay tabScoped={tabScoped} />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          // Always viewport-fixed so side sheets (and their action footers)
          // pin to screen height. Overlay stays absolute when tab-scoped so
          // dimming remains inside the workspace tab only.
          "fixed z-50 bg-background shadow-xl outline-none",
          sheetSideClasses[side],
          className,
        )}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        {...props}
      >
        {children}
        <SheetPrimitive.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
