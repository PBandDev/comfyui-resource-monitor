import type { DisplayMode } from "./types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function findRunActionGroup(root: ParentNode = document): HTMLElement | null {
  const actionGroup = root.querySelector(
    ".actionbar [role='region'] .relative.flex.items-center.gap-2.select-none",
  );
  if (actionGroup instanceof HTMLElement) {
    return actionGroup;
  }

  const runButton = Array.from(root.querySelectorAll("button")).find(
    (button) => normalizeText(button.textContent) === "Run",
  );
  if (!(runButton instanceof HTMLElement)) {
    return null;
  }

  return (
    runButton.closest(".relative.flex.items-center.gap-2.select-none") ??
    runButton.parentElement?.parentElement ??
    null
  );
}

function findCanvasToolbar(root: ParentNode = document): HTMLElement | null {
  const toolbar = root.querySelector("[role='toolbar'][aria-label='Canvas Toolbar']");
  return toolbar instanceof HTMLElement ? toolbar : null;
}

export function resolveMonitorMountTarget(
  mode: DisplayMode,
  root: ParentNode = document,
): HTMLElement | null {
  if (mode === "bottom") {
    return findCanvasToolbar(root) ?? findRunActionGroup(root);
  }

  return findRunActionGroup(root) ?? findCanvasToolbar(root);
}
