"""SRT ingest listener.

One listener socket per protocol port accepts many concurrent callers. For each
caller we read its streamid (the stream key), authorize it against the control
plane, and — if accepted — start a passthrough relay to the streamer's OBS.

The same code path serves both direct SRT (public port) and SRTLA (internal port
fed by the Belabox srtla_receiver); only the reported protocol label differs.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from . import libsrt
from .control_client import ControlClient
from .pipelines import SrtPassthroughRelay

log = logging.getLogger(__name__)


class SrtListener:
    def __init__(self, port: int, protocol: str, control: ControlClient) -> None:
        assert protocol in ("srt", "srtla")
        self._port = port
        self._protocol = protocol
        self._control = control
        self._listen_sock: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

    def start(self) -> None:
        self._listen_sock = libsrt.create_listener(self._port)
        self._running = True
        self._thread = threading.Thread(target=self._accept_loop, name=f"{self._protocol}-listen", daemon=True)
        self._thread.start()
        log.info("%s listener bound on :%d", self._protocol, self._port)

    def _accept_loop(self) -> None:
        assert self._listen_sock is not None
        while self._running:
            try:
                conn, peer_ip = libsrt.accept(self._listen_sock)
            except RuntimeError as exc:
                if self._running:
                    log.error("accept failed on :%d: %s", self._port, exc)
                continue
            threading.Thread(
                target=self._handle_connection,
                args=(conn, peer_ip),
                name=f"{self._protocol}-conn",
                daemon=True,
            ).start()

    def _handle_connection(self, conn: int, peer_ip: Optional[str]) -> None:
        streamid = libsrt.get_streamid(conn)
        stream_key = libsrt.parse_stream_key(streamid)
        if not stream_key:
            log.info("%s connection from %s rejected: no streamid", self._protocol, peer_ip)
            libsrt.close(conn)
            return

        auth = self._control.authorize(self._protocol, stream_key, peer_ip)
        if auth is None:
            log.info("%s connection from %s rejected: unauthorized", self._protocol, peer_ip)
            libsrt.close(conn)
            return

        log.info("%s session %s started for user %s", self._protocol, auth.session_id, auth.user_id)

        def on_end(last_bitrate_kbps: Optional[int]) -> None:
            log.info("%s session %s ended", self._protocol, auth.session_id)
            self._control.session_end(auth.session_id, auth.user_id, last_bitrate_kbps)

        def on_stats(stats: dict) -> None:
            self._control.session_stats(auth.session_id, auth.user_id, self._protocol, stats)

        relay = SrtPassthroughRelay(conn, auth.output_target, on_end, on_stats)
        relay.start()

    def stop(self) -> None:
        self._running = False
        if self._listen_sock is not None:
            libsrt.close(self._listen_sock)
