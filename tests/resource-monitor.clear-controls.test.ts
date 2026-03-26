// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createClearControls,
  type ClearControlsDeps,
} from "../src/resource-monitor/clear-controls";

function createMockDeps(overrides: Partial<ClearControlsDeps> = {}): ClearControlsDeps {
  return {
    showClearButtons: true,
    fetchApi: vi.fn().mockResolvedValue({ ok: true }),
    toastAdd: vi.fn(),
    ...overrides,
  };
}

describe("createClearControls", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates two buttons when showClearButtons is true", () => {
    const deps = createMockDeps();
    const { root } = createClearControls(deps);

    const unload = root.querySelector('[data-rm-clear-action="unloadModels"]');
    const free = root.querySelector('[data-rm-clear-action="freeMemory"]');

    expect(unload).not.toBeNull();
    expect(free).not.toBeNull();
  });

  it("creates no buttons when showClearButtons is false", () => {
    const deps = createMockDeps({ showClearButtons: false });
    const { root } = createClearControls(deps);

    expect(root.children.length).toBe(0);
  });

  it("sets data-tooltip attribute for plugin tooltip system", () => {
    const deps = createMockDeps();
    const { root } = createClearControls(deps);

    const unload = root.querySelector('[data-rm-clear-action="unloadModels"]');
    const free = root.querySelector('[data-rm-clear-action="freeMemory"]');

    expect(unload?.getAttribute("data-tooltip")).toBe("Unload models from VRAM");
    expect(free?.getAttribute("data-tooltip")).toBe("Free all memory, models, and VRAM");
  });

  it("calls fetchApi with unload_models payload on unload click", async () => {
    const fetchApi = vi.fn().mockResolvedValue({ ok: true });
    const toastAdd = vi.fn();
    const deps = createMockDeps({ fetchApi, toastAdd });
    const { root } = createClearControls(deps);

    const unload = root.querySelector(
      '[data-rm-clear-action="unloadModels"]',
    ) as HTMLButtonElement;
    unload.click();

    await vi.waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith("/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unload_models: true }),
      });
    });
  });

  it("calls fetchApi with free_memory payload on free click", async () => {
    const fetchApi = vi.fn().mockResolvedValue({ ok: true });
    const deps = createMockDeps({ fetchApi });
    const { root } = createClearControls(deps);

    const free = root.querySelector(
      '[data-rm-clear-action="freeMemory"]',
    ) as HTMLButtonElement;
    free.click();

    await vi.waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith("/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ free_memory: true }),
      });
    });
  });

  it("shows success toast on ok response", async () => {
    const fetchApi = vi.fn().mockResolvedValue({ ok: true });
    const toastAdd = vi.fn();
    const deps = createMockDeps({ fetchApi, toastAdd });
    const { root } = createClearControls(deps);

    const unload = root.querySelector(
      '[data-rm-clear-action="unloadModels"]',
    ) as HTMLButtonElement;
    unload.click();

    await vi.waitFor(() => {
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "success", summary: "Models unloaded" }),
      );
    });
  });

  it("shows error toast on failed response", async () => {
    const fetchApi = vi.fn().mockResolvedValue({ ok: false });
    const toastAdd = vi.fn();
    const deps = createMockDeps({ fetchApi, toastAdd });
    const { root } = createClearControls(deps);

    const free = root.querySelector(
      '[data-rm-clear-action="freeMemory"]',
    ) as HTMLButtonElement;
    free.click();

    await vi.waitFor(() => {
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "error", summary: "Failed to free memory" }),
      );
    });
  });

  it("disposes by removing the root element", () => {
    const deps = createMockDeps();
    const { root, dispose } = createClearControls(deps);
    document.body.appendChild(root);

    expect(document.body.contains(root)).toBe(true);
    dispose();
    expect(document.body.contains(root)).toBe(false);
  });
});
