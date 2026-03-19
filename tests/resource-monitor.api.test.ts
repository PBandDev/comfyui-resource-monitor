// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  configureResourceMonitor,
  disconnectResourceMonitor,
  fetchInitialSnapshot,
  subscribeToSnapshots,
  type ResourceMonitorApiClient,
} from "../src/resource-monitor/api";

function createJsonResponse(payload: object, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

describe("resource monitor api", () => {
  it("keeps bootstrap snapshot fetch working", async () => {
    const fetchApi = vi.fn().mockResolvedValue(
      createJsonResponse({
        timestamp: 1,
        cpu_percent: 22,
      }),
    );
    const api: ResourceMonitorApiClient = { fetchApi };

    const snapshot = await fetchInitialSnapshot(api);

    expect(snapshot).toEqual({
      timestamp: 1,
      cpu_percent: 22,
    });
    expect(fetchApi).toHaveBeenCalledWith("/resource-monitor/snapshot");
  });

  it("configures the backend monitor and returns the bootstrap snapshot", async () => {
    const fetchApi = vi.fn().mockResolvedValue(
      createJsonResponse({
        active_clients: 1,
        started: true,
        refresh_interval: 0.5,
        snapshot: {
          timestamp: 2,
          cpu_percent: 33,
          gpu_available: false,
        },
      }),
    );
    const api: ResourceMonitorApiClient = {
      fetchApi,
      clientId: "client-123",
    };

    const result = await configureResourceMonitor(api, 0.5);

    expect(result).toEqual({
      activeClients: 1,
      started: true,
      snapshot: {
        timestamp: 2,
        cpu_percent: 33,
        gpu_available: false,
      },
    });
    expect(fetchApi).toHaveBeenCalledWith("/resource-monitor/configure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "client-123",
        force_refresh: true,
        refresh_interval: 0.5,
      }),
    });
  });

  it("can send keepalive configure requests without forcing a fresh sample", async () => {
    const fetchApi = vi.fn().mockResolvedValue(
      createJsonResponse({
        active_clients: 1,
        started: true,
        snapshot: {
          timestamp: 5,
        },
      }),
    );
    const api: ResourceMonitorApiClient = {
      fetchApi,
      clientId: "client-123",
    };

    await configureResourceMonitor(api, 1, { forceRefresh: false });

    expect(fetchApi).toHaveBeenCalledWith("/resource-monitor/configure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "client-123",
        force_refresh: false,
        refresh_interval: 1,
      }),
    });
  });

  it("can unregister the current client when the page is leaving", async () => {
    const fetchApi = vi.fn().mockResolvedValue(createJsonResponse({ disconnected: true }));
    const api: ResourceMonitorApiClient = {
      fetchApi,
      clientId: "client-123",
    };

    const disconnected = await disconnectResourceMonitor(api);

    expect(disconnected).toBe(true);
    expect(fetchApi).toHaveBeenCalledWith("/resource-monitor/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "client-123",
      }),
    });
  });

  it("subscribes to custom snapshot events through the Comfy api event interface", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const api: ResourceMonitorApiClient = {
      fetchApi: vi.fn(),
      addEventListener,
      removeEventListener,
    };
    const listener = vi.fn();

    const unsubscribe = subscribeToSnapshots(api, listener);
    const eventHandler = addEventListener.mock.calls[0]?.[1] as
      | ((event: Event) => void)
      | undefined;

    expect(addEventListener).toHaveBeenCalledWith(
      "resource-monitor.snapshot",
      expect.any(Function),
    );
    expect(eventHandler).toBeTypeOf("function");

    eventHandler?.(
      new CustomEvent("resource-monitor.snapshot", {
        detail: {
          cpu_percent: 14,
          gpu_available: false,
        },
      }),
    );

    expect(listener).toHaveBeenCalledWith({
      cpu_percent: 14,
      gpu_available: false,
    });

    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith(
      "resource-monitor.snapshot",
      eventHandler,
    );
  });
});
