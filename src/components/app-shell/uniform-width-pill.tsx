"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type WidthRegistry = Record<string, Record<string, number>>;

type UniformPillRegistryContextValue = {
  registerWidth: (columnKey: string, instanceId: string, width: number) => void;
  unregisterWidth: (columnKey: string, instanceId: string) => void;
};

const UniformPillRegistryContext = createContext<UniformPillRegistryContextValue | null>(null);
const UniformPillWidthsContext = createContext<Record<string, number>>({});
const UniformPillResetContext = createContext(0);

function computeColumnMaxWidth(registry: WidthRegistry, columnKey: string): number {
  const entries = registry[columnKey];
  if (!entries) return 0;
  return Math.max(0, ...Object.values(entries));
}

type UniformPillWidthProviderProps = {
  children: ReactNode;
  /** Clears measured widths when page data or layout changes. */
  resetKey?: string;
};

export function UniformPillWidthProvider({ children, resetKey }: UniformPillWidthProviderProps) {
  const registryRef = useRef<WidthRegistry>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [resetVersion, setResetVersion] = useState(0);
  const pendingSyncRef = useRef<number | null>(null);

  const flushWidthSync = useCallback(() => {
    pendingSyncRef.current = null;

    const registry = registryRef.current;
    setWidths((current) => {
      const columnKeys = new Set([...Object.keys(current), ...Object.keys(registry)]);
      const next: Record<string, number> = {};
      let changed = false;

      for (const columnKey of columnKeys) {
        const measuredMax = computeColumnMaxWidth(registry, columnKey);
        const previous = current[columnKey] ?? 0;

        if (measuredMax > 0) {
          next[columnKey] = measuredMax;
          if (previous !== measuredMax) changed = true;
        } else if (previous > 0) {
          next[columnKey] = previous;
        }
      }

      if (Object.keys(next).length !== Object.keys(current).length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, []);

  const scheduleWidthSync = useCallback(() => {
    if (pendingSyncRef.current != null) return;
    pendingSyncRef.current = requestAnimationFrame(flushWidthSync);
  }, [flushWidthSync]);

  const registerWidth = useCallback(
    (columnKey: string, instanceId: string, width: number) => {
      if (!registryRef.current[columnKey]) {
        registryRef.current[columnKey] = {};
      }

      if (registryRef.current[columnKey][instanceId] === width) return;

      registryRef.current[columnKey][instanceId] = width;
      scheduleWidthSync();
    },
    [scheduleWidthSync],
  );

  const unregisterWidth = useCallback(
    (columnKey: string, instanceId: string) => {
      const columnRegistry = registryRef.current[columnKey];
      if (!columnRegistry || columnRegistry[instanceId] == null) return;

      delete columnRegistry[instanceId];
      scheduleWidthSync();
    },
    [scheduleWidthSync],
  );

  const registryApi = useMemo(
    () => ({ registerWidth, unregisterWidth }),
    [registerWidth, unregisterWidth],
  );

  useLayoutEffect(() => {
    registryRef.current = {};
    setWidths({});
    setResetVersion((version) => version + 1);
  }, [resetKey]);

  useLayoutEffect(() => {
    return () => {
      if (pendingSyncRef.current != null) {
        cancelAnimationFrame(pendingSyncRef.current);
      }
    };
  }, []);

  return (
    <UniformPillRegistryContext.Provider value={registryApi}>
      <UniformPillResetContext.Provider value={resetVersion}>
        <UniformPillWidthsContext.Provider value={widths}>{children}</UniformPillWidthsContext.Provider>
      </UniformPillResetContext.Provider>
    </UniformPillRegistryContext.Provider>
  );
}

type UniformWidthPillProps = {
  columnKey: string;
  className?: string;
  children: ReactNode;
};

function measureNaturalWidth(node: HTMLSpanElement): number {
  const target = (node.firstElementChild as HTMLElement | null) ?? node;
  const previousWidth = target.style.width;
  const previousMinWidth = target.style.minWidth;
  target.style.width = "auto";
  target.style.minWidth = "0px";
  const width = Math.ceil(target.getBoundingClientRect().width);
  target.style.width = previousWidth;
  target.style.minWidth = previousMinWidth;
  return width;
}

export function UniformWidthPill({ columnKey, className, children }: UniformWidthPillProps) {
  const registry = useContext(UniformPillRegistryContext);
  const widths = useContext(UniformPillWidthsContext);
  const resetVersion = useContext(UniformPillResetContext);
  const instanceId = useId();
  const pillRef = useRef<HTMLSpanElement>(null);
  const columnWidth = widths[columnKey];

  useLayoutEffect(() => {
    if (!registry || !pillRef.current) return;

    const width = measureNaturalWidth(pillRef.current);
    registry.registerWidth(columnKey, instanceId, width);

    return () => {
      registry.unregisterWidth(columnKey, instanceId);
    };
  }, [columnKey, instanceId, registry, resetVersion]);

  if (!registry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      ref={pillRef}
      style={columnWidth ? { width: columnWidth } : undefined}
      className={cn(
        "inline-flex max-w-full justify-center",
        columnWidth && "[&>*]:box-border [&>*]:w-full [&>*]:justify-center",
        className,
      )}
    >
      {children}
    </span>
  );
}
