from __future__ import annotations

from typing import Any, Callable

from .service import ResourceMonitorService, get_monitor_service


def build_route_handlers(
    service: ResourceMonitorService | None = None,
) -> dict[str, Callable[..., Any]]:
    active_service = service or get_monitor_service()

    async def get_snapshot(_request: Any) -> Any:
        return _json_response(active_service.snapshot_to_payload())

    async def configure(request: Any) -> Any:
        payload = await request.json()

        refresh_interval = payload.get("refresh_interval")
        client_id = payload.get("client_id")

        registered_client = active_service.register_client(client_id, refresh_interval)
        if not registered_client and refresh_interval is not None:
            active_service.set_refresh_interval(refresh_interval)

        started = active_service.start() if registered_client else False
        force_refresh = bool(payload.get("force_refresh", False))
        snapshot = active_service.get_snapshot(force_refresh=force_refresh)

        return _json_response(
            {
                "active_clients": len(active_service.get_active_client_ids()),
                "started": started,
                "refresh_interval": active_service.refresh_interval,
                "snapshot": active_service.snapshot_to_payload(snapshot),
            }
        )

    async def disconnect(request: Any) -> Any:
        payload = await request.json()
        disconnected = active_service.unregister_client(payload.get("client_id"))
        active_clients = len(active_service.get_active_client_ids())
        return _json_response(
            {
                "active_clients": active_clients,
                "disconnected": disconnected,
            }
        )

    return {
        "disconnect": disconnect,
        "get_snapshot": get_snapshot,
        "configure": configure,
    }


def register_promptserver_routes(
    service: ResourceMonitorService | None = None,
) -> bool:
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return False

    handlers = build_route_handlers(service)
    routes = PromptServer.instance.routes

    @routes.get("/resource-monitor/snapshot")
    async def _get_snapshot(request: Any) -> web.Response:
        return web.json_response(await handlers["get_snapshot"](request))

    @routes.post("/resource-monitor/configure")
    async def _configure(request: Any) -> web.Response:
        return web.json_response(await handlers["configure"](request))

    @routes.post("/resource-monitor/disconnect")
    async def _disconnect(request: Any) -> web.Response:
        return web.json_response(await handlers["disconnect"](request))

    return True


def _json_response(payload: dict[str, object]) -> dict[str, object]:
    return payload
