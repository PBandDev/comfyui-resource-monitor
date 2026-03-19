from __future__ import annotations

import asyncio
import time
from contextlib import suppress
from dataclasses import asdict
from typing import Awaitable, Callable

from .collector import ResourceCollector
from .schemas import ResourceSnapshot

SNAPSHOT_EVENT_NAME = "resource-monitor.snapshot"

PromptSender = Callable[
    [str, dict[str, object], str | None],
    Awaitable[None] | None,
]

_monitor_service: ResourceMonitorService | None = None


def get_monitor_service() -> ResourceMonitorService:
    global _monitor_service
    if _monitor_service is None:
        _monitor_service = ResourceMonitorService()
    return _monitor_service


def _load_prompt_sender() -> PromptSender | None:
    try:
        from server import PromptServer
    except Exception:
        return None

    async def send(
        event_name: str,
        payload: dict[str, object],
        client_id: str | None,
    ) -> None:
        result = PromptServer.instance.send(event_name, payload, client_id)
        if asyncio.iscoroutine(result):
            await result

    return send


class ResourceMonitorService:
    def __init__(
        self,
        collector: ResourceCollector | None = None,
        prompt_sender: PromptSender | None = None,
        refresh_interval: float = 1.0,
        client_timeout: float = 30.0,
    ) -> None:
        self.collector = collector or ResourceCollector()
        self.prompt_sender = prompt_sender
        self.default_refresh_interval = max(float(refresh_interval), 0.1)
        self.refresh_interval = self.default_refresh_interval
        self.client_timeout = max(float(client_timeout), 1.0)
        self._client_last_seen: dict[str, float] = {}
        self._client_refresh_intervals: dict[str, float] = {}
        self._latest_snapshot: ResourceSnapshot | None = None
        self._task: asyncio.Task[None] | None = None

    def get_snapshot(self, force_refresh: bool = False) -> ResourceSnapshot:
        if force_refresh or self._latest_snapshot is None:
            self._latest_snapshot = self.collector.sample()
        return self._latest_snapshot

    def set_refresh_interval(self, refresh_interval: object) -> bool:
        try:
            normalized_refresh_interval = max(float(refresh_interval), 0.1)
        except (TypeError, ValueError):
            return False

        self.default_refresh_interval = normalized_refresh_interval
        self._recompute_refresh_interval()
        return True

    def _normalize_client_id(self, client_id: object) -> str | None:
        if not isinstance(client_id, str):
            return None

        normalized_client_id = client_id.strip()
        return normalized_client_id or None

    def _normalize_refresh_interval(
        self,
        refresh_interval: object,
    ) -> float | None:
        try:
            return max(float(refresh_interval), 0.1)
        except (TypeError, ValueError):
            return None

    def _recompute_refresh_interval(self) -> None:
        if self._client_refresh_intervals:
            self.refresh_interval = min(self._client_refresh_intervals.values())
            return

        self.refresh_interval = self.default_refresh_interval

    def register_client(
        self,
        client_id: object,
        refresh_interval: object | None = None,
    ) -> bool:
        normalized_client_id = self._normalize_client_id(client_id)
        if normalized_client_id is None:
            return False

        self._client_last_seen[normalized_client_id] = time.monotonic()
        normalized_refresh_interval = self._normalize_refresh_interval(refresh_interval)
        if normalized_refresh_interval is not None:
            self._client_refresh_intervals[normalized_client_id] = normalized_refresh_interval
        else:
            self._client_refresh_intervals.setdefault(
                normalized_client_id,
                self.default_refresh_interval,
            )
        self._recompute_refresh_interval()
        return True

    def unregister_client(self, client_id: object) -> bool:
        normalized_client_id = self._normalize_client_id(client_id)
        if normalized_client_id is None:
            return False

        self._client_last_seen.pop(normalized_client_id, None)
        self._client_refresh_intervals.pop(normalized_client_id, None)
        self._recompute_refresh_interval()
        return True

    def prune_inactive_clients(self) -> int:
        now = time.monotonic()
        active_client_ids = {
            client_id
            for client_id, last_seen in self._client_last_seen.items()
            if now - last_seen <= self.client_timeout
        }

        removed_client_ids = [
            client_id
            for client_id in self._client_last_seen
            if client_id not in active_client_ids
        ]
        for client_id in removed_client_ids:
            self._client_last_seen.pop(client_id, None)
            self._client_refresh_intervals.pop(client_id, None)

        self._recompute_refresh_interval()
        return len(self._client_last_seen)

    def get_active_client_ids(self) -> tuple[str, ...]:
        self.prune_inactive_clients()
        return tuple(self._client_last_seen)

    def snapshot_to_payload(
        self,
        snapshot: ResourceSnapshot | None = None,
    ) -> dict[str, object]:
        return asdict(snapshot or self.get_snapshot())

    async def publish_snapshot(
        self,
        snapshot: ResourceSnapshot | None = None,
        client_ids: tuple[str, ...] | None = None,
    ) -> None:
        sender = self.prompt_sender or _load_prompt_sender()
        if sender is None:
            return

        active_client_ids = client_ids or self.get_active_client_ids()
        if not active_client_ids:
            return

        snapshot_to_send = snapshot or self.get_snapshot()
        payload = self.snapshot_to_payload(snapshot_to_send)
        for client_id in active_client_ids:
            await sender(SNAPSHOT_EVENT_NAME, payload, client_id)

    async def monitor_forever(self) -> None:
        try:
            while True:
                active_client_ids = self.get_active_client_ids()
                if not active_client_ids:
                    return

                snapshot = self.get_snapshot(force_refresh=True)
                await self.publish_snapshot(snapshot, active_client_ids)
                await asyncio.sleep(self.refresh_interval)
        finally:
            self._task = None

    def start(self) -> bool:
        if self._task is not None and not self._task.done():
            return True

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return False

        self._task = loop.create_task(self.monitor_forever())
        return True

    async def stop(self) -> None:
        if self._task is None:
            return

        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
        self._task = None
