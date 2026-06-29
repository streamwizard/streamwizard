"""RTMP ingest server.

GStreamer cannot *listen* for RTMP (its RTMP elements are push/pull clients), so
we use pyrtmp for the RTMP server (handshake + chunk parsing) and reconstruct an
FLV byte stream that we feed into the GStreamer FLV->TS remux relay. The stream
path (e.g. rtmp://host/live/<key>) carries the stream key.

pyrtmp is asyncio-based; pin the version in requirements.txt — the controller
hook names below match pyrtmp's SimpleRTMPController interface.
"""

from __future__ import annotations

import asyncio
import logging
import struct
from typing import Optional

from pyrtmp.rtmp import RTMPProtocol, SimpleRTMPController, SimpleRTMPServer

from . import _pyrtmp_patch
from .control_client import ControlClient
from .pipelines import RtmpRemuxRelay

_pyrtmp_patch.apply()

log = logging.getLogger(__name__)

# FLV tag types
_TAG_AUDIO = 8
_TAG_VIDEO = 9
_TAG_SCRIPT = 18


class _FlvStreamWriter:
    """Builds a valid FLV byte stream from RTMP messages and feeds it to a relay."""

    def __init__(self, relay: RtmpRemuxRelay) -> None:
        self._relay = relay
        # FLV header: signature, version 1, audio+video flags, data offset 9,
        # followed by PreviousTagSize0 (0).
        header = b"FLV" + bytes([1, 0x05]) + struct.pack(">I", 9) + struct.pack(">I", 0)
        self._relay.push(header)

    def _write_tag(self, tag_type: int, timestamp: int, payload: bytes) -> None:
        size = len(payload)
        ts = timestamp & 0xFFFFFF
        ts_ext = (timestamp >> 24) & 0xFF
        tag = bytes([tag_type]) + struct.pack(">I", size)[1:] + struct.pack(">I", ts)[1:]
        tag += bytes([ts_ext]) + b"\x00\x00\x00" + payload
        tag += struct.pack(">I", 11 + size)  # PreviousTagSize
        self._relay.push(tag)

    def write_video(self, timestamp: int, payload: bytes) -> None:
        self._write_tag(_TAG_VIDEO, timestamp, payload)

    def write_audio(self, timestamp: int, payload: bytes) -> None:
        self._write_tag(_TAG_AUDIO, timestamp, payload)

    def write_script(self, payload: bytes) -> None:
        self._write_tag(_TAG_SCRIPT, 0, payload)

    def close(self) -> None:
        self._relay.eos()


class _IngestRtmpController(SimpleRTMPController):
    def __init__(self, control: ControlClient) -> None:
        self._control = control
        super().__init__()

    async def on_ns_publish(self, session, message) -> None:
        stream_key = message.publishing_name
        peer = session.writer.get_extra_info("peername")
        peer_ip = peer[0] if peer else None

        auth = await asyncio.to_thread(self._control.authorize, "rtmp", stream_key, peer_ip)
        if auth is None:
            log.info("rtmp publish rejected for key from %s", peer_ip)
            raise RuntimeError("unauthorized stream key")

        on_stats = lambda stats: self._control.session_stats(auth.session_id, auth.user_id, "rtmp", stats)  # noqa: E731
        relay = RtmpRemuxRelay(auth.output_target, on_end=lambda _b: None, on_stats=on_stats)
        relay.start()
        session.state = {"writer": _FlvStreamWriter(relay), "auth": auth, "relay": relay}
        log.info("rtmp session %s started for user %s", auth.session_id, auth.user_id)
        await super().on_ns_publish(session, message)

    async def on_metadata(self, session, message) -> None:
        session.state["writer"].write_script(message.to_raw_meta())
        await super().on_metadata(session, message)

    async def on_video_message(self, session, message) -> None:
        session.state["writer"].write_video(message.timestamp, message.payload)
        await super().on_video_message(session, message)

    async def on_audio_message(self, session, message) -> None:
        session.state["writer"].write_audio(message.timestamp, message.payload)
        await super().on_audio_message(session, message)

    async def on_stream_closed(self, session, exception) -> None:
        state = getattr(session, "state", None)
        if state:
            state["writer"].close()
            auth = state["auth"]
            last_bitrate_kbps = round(state["relay"].tracker.average_kbps())
            await asyncio.to_thread(self._control.session_end, auth.session_id, auth.user_id, last_bitrate_kbps)
            log.info("rtmp session %s ended", auth.session_id)
        await super().on_stream_closed(session, exception)


class RtmpServer(SimpleRTMPServer):
    def __init__(self, control: ControlClient) -> None:
        self._control = control
        super().__init__()

    async def create(self, host: str, port: int) -> None:
        loop = asyncio.get_event_loop()
        self.server = await loop.create_server(
            lambda: RTMPProtocol(controller=_IngestRtmpController(self._control)),
            host=host,
            port=port,
        )
        log.info("rtmp listener bound on %s:%d", host, port)
