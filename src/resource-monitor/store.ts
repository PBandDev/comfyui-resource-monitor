import { formatMetricValue, formatTooltip } from "./format";
import type {
  DisplayMode,
  MetricKey,
  ResourceMonitorSettingsValues,
  ResourceSnapshot,
} from "./types";

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
type SnapshotPatch = Partial<ResourceSnapshot>;

export interface MetricRow {
  key: MetricKey;
  label: string;
  percent: number;
  text: string;
  tooltip: string;
}

export function resolveExpandedState(
  previousExpanded: boolean,
  previousMode: DisplayMode | null,
  nextDisplayMode: DisplayMode,
): boolean {
  if (previousMode === null) {
    return nextDisplayMode !== "collapsed";
  }

  if (nextDisplayMode !== previousMode) {
    return nextDisplayMode !== "collapsed";
  }

  return previousExpanded;
}

function isNumberKey(key: SnapshotKey): key is Exclude<SnapshotKey, "gpu_available" | "gpu_name"> {
  return key !== "gpu_available" && key !== "gpu_name";
}

function sanitizeSnapshotPatch(patch: SnapshotPatch | null | undefined): SnapshotPatch {
  if (!patch) {
    return {};
  }

  const nextPatch: SnapshotPatch = {};

  for (const key of SNAPSHOT_KEYS) {
    const value = patch[key];
    if (value === undefined) {
      continue;
    }

    if (key === "gpu_available" && typeof value === "boolean") {
      nextPatch[key] = value;
      continue;
    }

    if (key === "gpu_name" && typeof value === "string") {
      nextPatch[key] = value;
      continue;
    }

    if (isNumberKey(key) && typeof value === "number" && Number.isFinite(value)) {
      nextPatch[key] = value;
    }
  }

  return nextPatch;
}

function isCompleteSnapshot(patch: SnapshotPatch): patch is ResourceSnapshot {
  return SNAPSHOT_KEYS.every((key) => patch[key] !== undefined);
}

function metricPercent(key: MetricKey, snapshot: ResourceSnapshot): number {
  switch (key) {
    case "cpu":
      return snapshot.cpu_percent;
    case "ram":
      return snapshot.ram_percent;
    case "gpu":
      return snapshot.gpu_available ? snapshot.gpu_percent : 0;
    case "vram":
      return snapshot.gpu_available ? snapshot.vram_percent : 0;
    case "gpuTemp":
      return snapshot.gpu_available
        ? Math.max(0, Math.min(snapshot.gpu_temp_celsius, 100))
        : 0;
  }
}

export function reduceSnapshot(
  previous: ResourceSnapshot | null,
  patch: SnapshotPatch | null | undefined,
): ResourceSnapshot | null {
  const sanitizedPatch = sanitizeSnapshotPatch(patch);

  if (previous === null) {
    return isCompleteSnapshot(sanitizedPatch) ? sanitizedPatch : null;
  }

  return {
    ...previous,
    ...sanitizedPatch,
  };
}

export function selectMetricRows(
  snapshot: ResourceSnapshot | null,
  settings: ResourceMonitorSettingsValues,
): MetricRow[] {
  if (snapshot === null) {
    return [];
  }

  const rowDefinitions: Array<{ key: MetricKey; label: string; visible: boolean }> = [
    { key: "cpu", label: "CPU", visible: settings.showCpu },
    { key: "ram", label: "RAM", visible: settings.showRam },
    { key: "gpu", label: "GPU", visible: settings.showGpu },
    { key: "vram", label: "VRAM", visible: settings.showVram },
    { key: "gpuTemp", label: "TEMP", visible: settings.showGpuTemp },
  ];

  return rowDefinitions
    .filter((definition) => definition.visible)
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      percent: metricPercent(definition.key, snapshot),
      text: formatMetricValue(definition.key, snapshot, settings.textDensity),
      tooltip: formatTooltip(definition.key, snapshot),
    }));
}
