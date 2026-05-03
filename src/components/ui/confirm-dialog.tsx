"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" shows a red accent for destructive actions; default is primary. */
  variant?: "default" | "danger";
}

type Resolver = (confirmed: boolean) => void;

interface ConfirmApi {
  /** Returns true if user confirmed, false otherwise. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(options);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    setOpen(false);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const api = useMemo<ConfirmApi>(() => ({ confirm }), [confirm]);

  const isDanger = opts?.variant === "danger";

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) finish(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                name={isDanger ? "warning" : "help"}
                size={22}
                fill
                className={isDanger ? "text-md-error" : "text-primary"}
              />
              {opts?.title || ""}
            </DialogTitle>
            {opts?.description && (
              <DialogDescription>{opts.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => finish(false)}>
              {opts?.cancelLabel || "Cancel"}
            </Button>
            <Button
              onClick={() => finish(true)}
              className={cn(isDanger && "!bg-md-error !bg-none hover:!bg-md-error/90")}
            >
              {opts?.confirmLabel || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
