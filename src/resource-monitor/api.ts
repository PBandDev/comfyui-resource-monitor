import type { ResourceSnapshot } from "./types";

export const RESOURCE_MONITOR_EVENT_NAME = "resource-monitor.snapshot";
const SNAPSHOT_ROUTE = "/resource-monitor/snapshot";
const CONFIGURE_ROUTE = "/resource-monitor/configure";
const DISCONNECT_ROUTE = "/resource-monitor/disconnect";

type SnapshotPatch = Partial<ResourceSnapshot>;
type SnapshotListener = (snapshot: SnapshotPatch) => void;
type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface FetchApiResponse {
  ok: boolean;
  json(): Promise<JsonValue>;
}

export interface ResourceMonitorApiClient {
  clientId?: string;
  initialClientId?: string | null;
  fetchApi(path: string, options?: RequestInit): Promise<FetchApiResponse>;
  addEventListener?(type: string, listener: (event: Event) => void): void;
  removeEventListener?(type: string, listener: (event: Event) => void): void;
}

export interface ConfigureResourceMonitorResult {
  activeClients?: number;
  started: boolean;
  snapshot: SnapshotPatch | null;
}

export interface ConfigureResourceMonitorOptions {
  forceRefresh?: boolean;
}

export async function disconnectResourceMonitor(
  api: ResourceMonitorApiClient,
): Promise<boolean> {
  const clientId = api.clientId ?? api.initialClientId ?? undefined;
  if (clientId === undefined) {
    return false;
  }

  const response = await api.fetchApi(DISCONNECT_ROUTE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
    }),
  });

  return response.ok;
}

const SNAPSHOT_KEYS = [
  "timestamp",
  "cpu_percent",
  "ram_percent",
  "ram_used_bytes",
  "ram_total_bytes",
  "gpu_available",
  "gpu_name",
  "gpu_percent",
  "vram_percent",
  "vram_used_bytes",
  "vram_total_bytes",
  "gpu_temp_celsius",
] as const;

type SnapshotKey = (typeof SNAPSHOT_KEYS)[number];

function isBooleanKey(key: SnapshotKey): key is "gpu_available" {
  return key === "gpu_available";
}

function isStringKey(key: SnapshotKey): key is "gpu_name" {
  return key === "gpu_name";
}

function parseSnapshotPatch(value: object | null): SnapshotPatch {
  if (value === null) {
    return {};
  }

  const record = value as Partial<Record<SnapshotKey, boolean | number | string>>;
  const patch: SnapshotPatch = {};

  for (const key of SNAPSHOT_KEYS) {
    const nextValue = record[key];
    if (nextValue === undefined) {
      continue;
    }

    if (isBooleanKey(key) && typeof nextValue === "boolean") {
      patch[key] = nextValue;
      continue;
    }

    if (isStringKey(key) && typeof nextValue === "string") {
      patch[key] = nextValue;
      continue;
    }

    if (!isBooleanKey(key) && !isStringKey(key) && typeof nextValue === "number") {
      patch[key] = nextValue;
    }
  }

  return patch;
}

export async function fetchInitialSnapshot(
  api: ResourceMonitorApiClient,
): Promise<SnapshotPatch | null> {
  const response = await api.fetchApi(SNAPSHOT_ROUTE);
  if (!response.ok) {
    return null;
  }

  const raw = await response.json();
  const objectValue = typeof raw === "object" && raw !== null ? raw : null;
  return parseSnapshotPatch(objectValue);
}

export async function configureResourceMonitor(
  api: ResourceMonitorApiClient,
  refreshInterval: number,
  options: ConfigureResourceMonitorOptions = {},
): Promise<ConfigureResourceMonitorResult | null> {
  const clientId = api.clientId ?? api.initialClientId ?? undefined;
  const response = await api.fetchApi(CONFIGURE_ROUTE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      force_refresh: options.forceRefresh ?? true,
      refresh_interval: refreshInterval,
    }),
  });
  if (!response.ok) {
    return null;
  }

  const raw = await response.json();
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const record = raw as {
    active_clients?: number;
    snapshot?: object | null;
    started?: boolean;
  };
  const snapshotValue =
    typeof record.snapshot === "object" && record.snapshot !== null
      ? record.snapshot
      : null;
  return {
    activeClients:
      typeof record.active_clients === "number" ? record.active_clients : undefined,
    started: record.started === true,
    snapshot: parseSnapshotPatch(snapshotValue),
  };
}

export function subscribeToSnapshots(
  api: ResourceMonitorApiClient,
  listener: SnapshotListener,
): () => void {
  if (
    typeof api.addEventListener !== "function" ||
    typeof api.removeEventListener !== "function"
  ) {
    return () => {};
  }

  const handleEvent = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const objectValue =
      typeof event.detail === "object" && event.detail !== null
        ? event.detail
        : null;
    const patch = parseSnapshotPatch(objectValue);

    if (Object.keys(patch).length > 0) {
      listener(patch);
    }
  };

  api.addEventListener(RESOURCE_MONITOR_EVENT_NAME, handleEvent);
  return () => {
    api.removeEventListener?.(RESOURCE_MONITOR_EVENT_NAME, handleEvent);
  };
}
