"use client";

import { useEffect, useState } from "react";
import { Calculator, Delete, X } from "lucide-react";

import { useCalculator } from "@/components/app-shell/calculator-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "*" | "/";

type CalculatorState = {
  display: string;
  accumulator: number | null;
  pendingOperator: Operator | null;
  waitingForOperand: boolean;
};

const initialState: CalculatorState = {
  display: "0",
  accumulator: null,
  pendingOperator: null,
  waitingForOperand: false,
};

function parseDisplay(display: string): number {
  const value = Number(display);
  return Number.isFinite(value) ? value : 0;
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

function compute(left: number, right: number, operator: Operator): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? Number.NaN : left / right;
    default:
      return right;
  }
}

function reduceState(state: CalculatorState, action: { type: string; payload?: string }): CalculatorState {
  switch (action.type) {
    case "digit": {
      const digit = action.payload ?? "";
      if (state.waitingForOperand) {
        return {
          ...state,
          display: digit === "." ? "0." : digit,
          waitingForOperand: false,
        };
      }

      if (digit === "." && state.display.includes(".")) return state;
      if (state.display === "0" && digit !== ".") {
        return { ...state, display: digit };
      }

      return { ...state, display: `${state.display}${digit}` };
    }
    case "operator": {
      const operator = action.payload as Operator;
      const current = parseDisplay(state.display);

      if (state.accumulator === null) {
        return {
          ...state,
          accumulator: current,
          pendingOperator: operator,
          waitingForOperand: true,
        };
      }

      if (state.waitingForOperand) {
        return { ...state, pendingOperator: operator };
      }

      const result = compute(state.accumulator, current, state.pendingOperator ?? operator);
      return {
        display: formatResult(result),
        accumulator: result,
        pendingOperator: operator,
        waitingForOperand: true,
      };
    }
    case "equals": {
      if (state.pendingOperator === null || state.accumulator === null) return state;
      if (state.waitingForOperand) return state;

      const current = parseDisplay(state.display);
      const result = compute(state.accumulator, current, state.pendingOperator);

      return {
        display: formatResult(result),
        accumulator: null,
        pendingOperator: null,
        waitingForOperand: true,
      };
    }
    case "clear":
      return initialState;
    case "backspace": {
      if (state.waitingForOperand) return state;
      if (state.display.length <= 1 || (state.display.length === 2 && state.display.startsWith("-"))) {
        return { ...state, display: "0" };
      }
      return { ...state, display: state.display.slice(0, -1) };
    }
    case "toggleSign": {
      if (state.display === "0" || state.display === "Error") return state;
      return {
        ...state,
        display: state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`,
      };
    }
    case "percent": {
      const value = parseDisplay(state.display) / 100;
      return { ...state, display: formatResult(value) };
    }
    default:
      return state;
  }
}

const digitButtons = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "."];

export function FloatingCalculator() {
  const { open, close } = useCalculator();
  const [state, setState] = useState<CalculatorState>(initialState);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        setState((current) => reduceState(current, { type: "digit", payload: event.key }));
        return;
      }

      if (event.key === ".") {
        event.preventDefault();
        setState((current) => reduceState(current, { type: "digit", payload: "." }));
        return;
      }

      if (event.key === "+" || event.key === "-" || event.key === "*" || event.key === "/") {
        event.preventDefault();
        setState((current) => reduceState(current, { type: "operator", payload: event.key }));
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        setState((current) => reduceState(current, { type: "equals" }));
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setState((current) => reduceState(current, { type: "backspace" }));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  if (!open) return null;

  function press(type: string, payload?: string) {
    setState((current) => reduceState(current, { type, payload }));
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto w-[min(100vw-2rem,18rem)] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl"
        role="dialog"
        aria-label="Calculator"
      >
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4" />
            Calculator
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close calculator" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 p-3">
          <div className="rounded-xl border bg-background px-3 py-3 text-right">
            <p className="truncate font-mono text-3xl font-semibold tracking-tight">{state.display}</p>
            {state.pendingOperator ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {state.accumulator !== null ? formatResult(state.accumulator) : ""} {state.pendingOperator}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <CalcButton variant="muted" onClick={() => press("clear")}>
              AC
            </CalcButton>
            <CalcButton variant="muted" onClick={() => press("toggleSign")}>
              +/−
            </CalcButton>
            <CalcButton variant="muted" onClick={() => press("percent")}>
              %
            </CalcButton>
            <CalcButton variant="operator" onClick={() => press("operator", "/")}>
              ÷
            </CalcButton>

            {digitButtons.slice(0, 3).map((digit) => (
              <CalcButton key={digit} onClick={() => press("digit", digit)}>
                {digit}
              </CalcButton>
            ))}
            <CalcButton variant="operator" onClick={() => press("operator", "*")}>
              ×
            </CalcButton>

            {digitButtons.slice(3, 6).map((digit) => (
              <CalcButton key={digit} onClick={() => press("digit", digit)}>
                {digit}
              </CalcButton>
            ))}
            <CalcButton variant="operator" onClick={() => press("operator", "-")}>
              −
            </CalcButton>

            {digitButtons.slice(6, 9).map((digit) => (
              <CalcButton key={digit} onClick={() => press("digit", digit)}>
                {digit}
              </CalcButton>
            ))}
            <CalcButton variant="operator" onClick={() => press("operator", "+")}>
              +
            </CalcButton>

            <CalcButton className="col-span-2" onClick={() => press("digit", "0")}>
              0
            </CalcButton>
            <CalcButton onClick={() => press("digit", ".")}>.</CalcButton>
            <CalcButton variant="equals" onClick={() => press("equals")}>
              =
            </CalcButton>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => press("backspace")}>
              <Delete className="h-3.5 w-3.5" />
              Backspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcButton({
  children,
  className,
  variant = "default",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "operator" | "equals" | "muted";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center rounded-xl text-base font-medium transition-colors",
        variant === "default" && "bg-muted/60 hover:bg-muted",
        variant === "muted" && "bg-muted text-muted-foreground hover:bg-muted/80",
        variant === "operator" && "bg-primary/10 text-primary hover:bg-primary/15",
        variant === "equals" && "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
    >
      {children}
    </button>
  );
}

export function CalculatorToggleButton() {
  const { open, toggle } = useCalculator();

  return (
    <Button
      type="button"
      variant={open ? "secondary" : "ghost"}
      size="icon"
      aria-label={open ? "Hide calculator" : "Open calculator"}
      aria-pressed={open}
      className="shrink-0"
      onClick={toggle}
    >
      <Calculator className="h-5 w-5" />
    </Button>
  );
}
