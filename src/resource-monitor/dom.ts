import type { DisplayMode } from "./types";
import type { MetricRow } from "./store";

export interface ResourceMonitorDom {
  root: HTMLDivElement;
  attachTo(target: HTMLElement | null): void;
  setExpanded(expanded: boolean): void;
  setMode(mode: DisplayMode): void;
  setSmoothTransitions(enabled: boolean): void;
  renderRows(rows: MetricRow[]): void;
}

interface CreateResourceMonitorDomOptions {
  onExpandedChange?: (expanded: boolean) => void;
}

function createMetricRow(row: MetricRow): HTMLDivElement {
  const rowElement = document.createElement("div");
  rowElement.className = "rm-row";

  const header = document.createElement("div");
  header.className = "rm-row__header";

  const label = document.createElement("span");
  label.className = "rm-row__label";
  label.textContent = row.label;

  const value = document.createElement("span");
  value.className = "rm-row__value";
  value.textContent = row.text;

  const meter = document.createElement("div");
  meter.className = "rm-row__meter";

  const fill = document.createElement("div");
  fill.className = "rm-row__fill";
  fill.style.width = `${Math.max(0, Math.min(row.percent, 100))}%`;
  meter.appendChild(fill);

  header.append(label, value);
  rowElement.append(header, meter);
  return rowElement;
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

  launcher.addEventListener("click", () => {
    expanded = !expanded;
    root.dataset.expanded = expanded ? "true" : "false";
    options.onExpandedChange?.(expanded);
  });

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
      rows.replaceChildren(...metricRows.map(createMetricRow));
    },
  };
}
