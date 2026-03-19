import type { DisplayMode, MetricKey } from "./types";
import type { MetricRow } from "./store";

export interface ResourceMonitorDom {
  root: HTMLDivElement;
  attachTo(target: HTMLElement | null): void;
  setExpanded(expanded: boolean): void;
  setMode(mode: DisplayMode): void;
  setSmoothTransitions(enabled: boolean): void;
  renderRows(rows: MetricRow[]): void;
  dispose(): void;
}

interface CreateResourceMonitorDomOptions {
  onExpandedChange?: (expanded: boolean) => void;
}

function usageLevel(percent: number): "ok" | "warn" | "crit" {
  if (percent >= 90) return "crit";
  if (percent >= 75) return "warn";
  return "ok";
}

interface RowElements {
  root: HTMLDivElement;
  label: HTMLSpanElement;
  value: HTMLSpanElement;
  meter: HTMLDivElement;
  fill: HTMLDivElement;
}

function createRowElements(key: string): RowElements {
  const root = document.createElement("div");
  root.className = "rm-row";

  const header = document.createElement("div");
  header.className = "rm-row__header";

  const label = document.createElement("span");
  label.className = "rm-row__label";
  label.id = `rm-label-${key}`;

  const value = document.createElement("span");
  value.className = "rm-row__value";

  const meter = document.createElement("div");
  meter.className = "rm-row__meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-labelledby", label.id);

  const fill = document.createElement("div");
  fill.className = "rm-row__fill";
  meter.appendChild(fill);

  header.append(label, value);
  root.append(header, meter);

  return { root, label, value, meter, fill };
}

function updateRowElements(elements: RowElements, row: MetricRow): void {
  const clampedPercent = Math.max(0, Math.min(row.percent, 100));
  const level = usageLevel(row.percent);

  elements.root.dataset.level = level;
  elements.root.dataset.tooltip = row.tooltip;
  elements.label.textContent = row.label;
  elements.value.textContent = row.text;
  elements.fill.style.width = `${clampedPercent}%`;
  elements.meter.setAttribute("aria-valuenow", String(Math.round(clampedPercent)));
}

// Body-level tooltip that escapes all overflow:hidden ancestors
function createTooltipManager(): {
  attach(container: HTMLElement): void;
  detach(): void;
} {
  const TOOLTIP_ID = "rm-tooltip";
  let tooltipEl: HTMLDivElement | null = null;
  let hideTimer: number | null = null;

  function ensureTooltip(): HTMLDivElement {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = "rm-tooltip";
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function show(target: HTMLElement): void {
    const text = target.dataset.tooltip;
    if (!text) return;

    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    const tip = ensureTooltip();
    tip.textContent = text;
    tip.classList.add("rm-tooltip--visible");

    const rect = target.getBoundingClientRect();
    tip.style.left = `${rect.left + rect.width / 2}px`;
    tip.style.top = `${rect.top - 4}px`;
    tip.style.transform = "translate(-50%, -100%)";
  }

  function hide(): void {
    hideTimer = window.setTimeout(() => {
      tooltipEl?.classList.remove("rm-tooltip--visible");
      hideTimer = null;
    }, 50);
  }

  function handleMouseOver(event: MouseEvent): void {
    const row = (event.target as HTMLElement).closest?.(".rm-row");
    if (row instanceof HTMLElement && row.dataset.tooltip) {
      show(row);
    }
  }

  function handleMouseOut(event: MouseEvent): void {
    const row = (event.target as HTMLElement).closest?.(".rm-row");
    if (row instanceof HTMLElement) {
      hide();
    }
  }

  let attachedContainer: HTMLElement | null = null;

  return {
    attach(container: HTMLElement) {
      if (attachedContainer === container) return;
      attachedContainer?.removeEventListener("mouseover", handleMouseOver);
      attachedContainer?.removeEventListener("mouseout", handleMouseOut);
      attachedContainer = container;
      container.addEventListener("mouseover", handleMouseOver);
      container.addEventListener("mouseout", handleMouseOut);
    },
    detach() {
      attachedContainer?.removeEventListener("mouseover", handleMouseOver);
      attachedContainer?.removeEventListener("mouseout", handleMouseOut);
      attachedContainer = null;
      tooltipEl?.remove();
      tooltipEl = null;
    },
  };
}

export function createResourceMonitorDom(
  options: CreateResourceMonitorDomOptions = {},
): ResourceMonitorDom {
  const root = document.createElement("div");
  root.className = "rm-root rm-root--top";

  const launcher = document.createElement("button");
  launcher.className = "rm-launcher";
  launcher.type = "button";
  launcher.textContent = "Resources";

  const panel = document.createElement("div");
  panel.className = "rm-panel";

  const rows = document.createElement("div");
  rows.className = "rm-rows";

  panel.appendChild(rows);
  root.append(launcher, panel);

  let expanded = false;
  launcher.setAttribute("aria-expanded", "false");

  launcher.addEventListener("click", () => {
    expanded = !expanded;
    root.dataset.expanded = expanded ? "true" : "false";
    launcher.setAttribute("aria-expanded", expanded ? "true" : "false");
    options.onExpandedChange?.(expanded);
  });

  const rowPool = new Map<MetricKey, RowElements>();
  const tooltip = createTooltipManager();
  tooltip.attach(root);

  return {
    root,
    attachTo(target: HTMLElement | null) {
      if (target === null) {
        root.remove();
        return;
      }

      if (root.parentElement !== target) {
        target.appendChild(root);
      }
    },
    setExpanded(nextExpanded: boolean) {
      expanded = nextExpanded;
      root.dataset.expanded = expanded ? "true" : "false";
      launcher.setAttribute("aria-expanded", expanded ? "true" : "false");
    },
    setMode(mode: DisplayMode) {
      root.classList.remove("rm-root--top", "rm-root--bottom", "rm-root--collapsed");
      root.classList.add(`rm-root--${mode}`);
      if (mode !== "collapsed") {
        expanded = true;
      }
      root.dataset.expanded = expanded ? "true" : "false";
    },
    setSmoothTransitions(enabled: boolean) {
      root.dataset.smoothTransitions = enabled ? "true" : "false";
    },
    renderRows(metricRows: MetricRow[]) {
      const activeKeys = new Set(metricRows.map((r) => r.key));

      // Remove rows that are no longer visible
      for (const [key, elements] of rowPool) {
        if (!activeKeys.has(key)) {
          elements.root.remove();
          rowPool.delete(key);
        }
      }

      // Update or create rows
      for (const row of metricRows) {
        let elements = rowPool.get(row.key);
        if (!elements) {
          elements = createRowElements(row.key);
          rowPool.set(row.key, elements);
        }
        updateRowElements(elements, row);
        // Only insert into DOM if not already there.
        // Re-appending every render kills CSS transitions because
        // the browser treats removed+reinserted elements as new.
        if (elements.root.parentNode !== rows) {
          rows.appendChild(elements.root);
        }
      }
    },
    dispose() {
      tooltip.detach();
    },
  };
}
