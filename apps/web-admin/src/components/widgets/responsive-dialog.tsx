"use client";

import { createContext, useContext } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  useIsMobile,
} from "@repo/ui";
import { cn } from "@/lib/utils";

// A dialog from 768px up, a bottom drawer on a phone: a form in the middle of
// a small screen leaves no room for the keyboard, a drawer sits right above it.
// Same parts as Dialog, so swapping the import is the whole migration.

const DrawerMode = createContext(false);

export function ResponsiveDialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <DrawerMode.Provider value={isMobile}>
      <Root {...props}>{children}</Root>
    </DrawerMode.Provider>
  );
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  return useContext(DrawerMode) ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

export function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  return useContext(DrawerMode) ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

export function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
  if (useContext(DrawerMode)) {
    return (
      <DrawerContent>
        {/* The drawer scrolls inside itself, so a long form never hides its own buttons. */}
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return useContext(DrawerMode) ? <DrawerHeader className={cn("px-0 text-left", className)} {...props} /> : <DialogHeader className={className} {...props} />;
}

export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return useContext(DrawerMode) ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return useContext(DrawerMode) ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

export function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return useContext(DrawerMode) ? (
    <DrawerFooter className={cn("px-0 pb-0 [&_button]:h-11", className)} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}
