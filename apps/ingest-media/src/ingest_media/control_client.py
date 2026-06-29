"""Thin HTTP client for the Bun control plane.

Kept dependency-free (stdlib urllib) — the calls are tiny and infrequent
(one authorize per connect, one session-end per disconnect).
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

from .config import Config

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Authorization:
    user_id: str
    session_id: str
    output_target: str


class ControlClient:
    def __init__(self, config: Config) -> None:
        self._config = config

    def _post(self, path: str, payload: dict) -> Optional[dict]:
        req = urllib.request.Request(
            f"{self._config.control_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-ingest-secret": self._config.control_secret,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._config.control_timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # 403 = invalid key; any non-2xx means "do not accept this stream".
            log.info("control %s rejected: %s", path, exc.code)
            return None
        except (urllib.error.URLError, TimeoutError) as exc:
            log.error("control %s unreachable: %s", path, exc)
            return None

    def authorize(self, protocol: str, stream_key: str, remote_ip: Optional[str]) -> Optional[Authorization]:
        """Validate a stream key. Returns None if the stream must be rejected."""
        data = self._post(
            "/internal/authorize",
            {"protocol": protocol, "stream_key": stream_key, "remote_ip": remote_ip},
        )
        if not data:
            return None
        try:
            return Authorization(
                user_id=data["user_id"],
                session_id=data["session_id"],
                output_target=data["output_target"],
            )
        except KeyError:
            log.error("control authorize returned malformed body: %s", data)
            return None

    def session_end(self, session_id: str, user_id: str, last_bitrate_kbps: Optional[int]) -> None:
        payload: dict = {"session_id": session_id, "user_id": user_id}
        if last_bitrate_kbps is not None:
            payload["last_bitrate_kbps"] = last_bitrate_kbps
        self._post("/internal/session-end", payload)

    def session_stats(self, session_id: str, user_id: str, protocol: str, stats: dict) -> None:
        """Best-effort periodic quality report — never blocks the relay on failure."""
        self._post(
            "/internal/session-stats",
            {"session_id": session_id, "user_id": user_id, "protocol": protocol, "stats": stats},
        )
