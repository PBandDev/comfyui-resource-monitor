// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { resolveMonitorMountTarget } from "../src/resource-monitor/hosts";

describe("resolveMonitorMountTarget", () => {
  it("uses the run action group for top and collapsed modes", () => {
    document.body.innerHTML = `
      <div class="actionbar">
        <div role="region">
          <div class="relative flex items-center gap-2 select-none">
            <button>Run</button>
          </div>
        </div>
      </div>
      <span role="toolbar" aria-label="Canvas Toolbar"></span>
    `;

    expect(resolveMonitorMountTarget("top")).toBe(
      document.querySelector(".actionbar .relative.flex.items-center.gap-2.select-none"),
    );
    expect(resolveMonitorMountTarget("collapsed")).toBe(
      document.querySelector(".actionbar .relative.flex.items-center.gap-2.select-none"),
    );
  });

  it("uses the canvas toolbar for bottom mode", () => {
    document.body.innerHTML = `
      <div class="actionbar">
        <div role="region">
          <div class="relative flex items-center gap-2 select-none">
            <button>Run</button>
          </div>
        </div>
      </div>
      <span role="toolbar" aria-label="Canvas Toolbar"></span>
    `;

    expect(resolveMonitorMountTarget("bottom")).toBe(
      document.querySelector("[role='toolbar'][aria-label='Canvas Toolbar']"),
    );
  });

  it("falls back to the run button ancestry when the actionbar selector is unavailable", () => {
    document.body.innerHTML = `
      <div>
        <div>
          <div class="run-cluster">
            <div>
              <button>Run</button>
            </div>
          </div>
        </div>
      </div>
    `;

    expect(resolveMonitorMountTarget("top")).toBe(
      document.querySelector(".run-cluster"),
    );
  });
});
