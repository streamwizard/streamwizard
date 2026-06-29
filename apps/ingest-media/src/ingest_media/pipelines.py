"""GStreamer passthrough relays.

These take an authorized input and republish it (codec-copy, no transcode) to the
streamer's OBS container over SRT. SRT input is MPEG-TS and is relayed verbatim;
RTMP input is FLV and is remuxed to MPEG-TS (still no re-encode) for the SRT push.
"""

from __future__ import annotations

import logging
import threading
from typing import Callable, Optional

import gi

gi.require_version("Gst", "1.0")
from gi.repository import Gst  # noqa: E402

from . import libsrt  # noqa: E402
from .stream_stats import BitrateTracker

log = logging.getLogger(__name__)

Gst.init(None)

# How often (seconds) to sample throughput/quality stats and hand them to
# on_stats while a relay is active. Short enough that a future scene-switcher
# reacts quickly to a degrading link; long enough not to spam the control plane.
_STATS_INTERVAL = 2.0


class SrtPassthroughRelay:
    """Reads MPEG-TS from an accepted libsrt socket and pushes it to OBS over SRT.

    libsrt owns the accepted connection (so we keep the streamid-routed listener);
    GStreamer's srtsink owns the outbound push to the OBS container.
    """

    def __init__(
        self,
        conn_sock: int,
        output_target: str,
        on_end: Callable[[Optional[int]], None],
        on_stats: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._conn = conn_sock
        self._output_target = output_target
        self._on_end = on_end
        self._on_stats = on_stats
        self._pipeline: Optional[Gst.Pipeline] = None
        self._appsrc: Optional[Gst.Element] = None
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self.tracker = BitrateTracker()
        self._stats_timer: Optional[threading.Timer] = None

    def start(self) -> None:
        desc = (
            "appsrc name=src is-live=true do-timestamp=true format=bytes ! "
            "queue max-size-buffers=0 max-size-time=0 ! "
            f'srtsink uri="{self._output_target}" sync=false wait-for-connection=true'
        )
        self._pipeline = Gst.parse_launch(desc)
        self._appsrc = self._pipeline.get_by_name("src")
        self._pipeline.set_state(Gst.State.PLAYING)
        self._thread = threading.Thread(target=self._feed, name="srt-relay", daemon=True)
        self._thread.start()
        if self._on_stats is not None:
            self._schedule_stats()

    def _schedule_stats(self) -> None:
        self._stats_timer = threading.Timer(_STATS_INTERVAL, self._report_stats)
        self._stats_timer.daemon = True
        self._stats_timer.start()

    def _report_stats(self) -> None:
        if self._on_stats is None:
            return
        stats = {"kbps": round(self.tracker.sample_kbps())}
        srt_stats = libsrt.get_stats(self._conn)
        if srt_stats is not None:
            stats.update(srt_stats)
        try:
            self._on_stats(stats)
        except Exception:  # noqa: BLE001
            log.exception("on_stats callback failed")
        if not self._stop.is_set():
            self._schedule_stats()

    def _feed(self) -> None:
        try:
            while not self._stop.is_set():
                chunk = libsrt.recv(self._conn, 1500)
                if not chunk:
                    break
                self.tracker.add_bytes(len(chunk))
                buf = Gst.Buffer.new_wrapped(chunk)
                if self._appsrc is not None:
                    if self._appsrc.emit("push-buffer", buf) != Gst.FlowReturn.OK:
                        break
        except Exception:  # noqa: BLE001
            log.exception("srt relay feed error")
        finally:
            self._teardown()
            self._on_end(round(self.tracker.average_kbps()))

    def _teardown(self) -> None:
        self._stop.set()
        if self._stats_timer is not None:
            self._stats_timer.cancel()
        if self._appsrc is not None:
            self._appsrc.emit("end-of-stream")
        if self._pipeline is not None:
            self._pipeline.set_state(Gst.State.NULL)
        libsrt.close(self._conn)

    def stop(self) -> None:
        self._stop.set()


class RtmpRemuxRelay:
    """Remuxes an incoming FLV byte stream to MPEG-TS and pushes it to OBS over SRT.

    Codec data is copied (h264parse/aacparse), never re-encoded. The caller feeds
    FLV bytes via `push(data)` and calls `eos()` when the publisher disconnects.
    """

    def __init__(
        self,
        output_target: str,
        on_end: Callable[[Optional[int]], None],
        on_stats: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self._output_target = output_target
        self._on_end = on_end
        self._on_stats = on_stats
        self._pipeline: Optional[Gst.Pipeline] = None
        self._appsrc: Optional[Gst.Element] = None
        self._mux: Optional[Gst.Element] = None
        self.tracker = BitrateTracker()
        self._stats_timer: Optional[threading.Timer] = None
        self._stopped = False

    def start(self) -> None:
        self._pipeline = Gst.Pipeline.new("rtmp-remux")

        self._appsrc = Gst.ElementFactory.make("appsrc", "src")
        self._appsrc.set_property("is-live", True)
        self._appsrc.set_property("format", Gst.Format.BYTES)
        self._appsrc.set_property("do-timestamp", True)
        self._appsrc.set_property("caps", Gst.Caps.from_string("video/x-flv"))

        demux = Gst.ElementFactory.make("flvdemux", "demux")
        self._mux = Gst.ElementFactory.make("mpegtsmux", "mux")
        sink = Gst.ElementFactory.make("srtsink", "sink")
        sink.set_property("uri", self._output_target)
        sink.set_property("sync", False)
        sink.set_property("wait-for-connection", True)

        for el in (self._appsrc, demux, self._mux, sink):
            self._pipeline.add(el)
        self._appsrc.link(demux)
        self._mux.link(sink)
        # flvdemux exposes audio/video pads only once the FLV header is parsed.
        demux.connect("pad-added", self._on_pad_added)

        self._pipeline.set_state(Gst.State.PLAYING)
        if self._on_stats is not None:
            self._schedule_stats()

    def _schedule_stats(self) -> None:
        self._stats_timer = threading.Timer(_STATS_INTERVAL, self._report_stats)
        self._stats_timer.daemon = True
        self._stats_timer.start()

    def _report_stats(self) -> None:
        if self._on_stats is None:
            return
        try:
            self._on_stats({"kbps": round(self.tracker.sample_kbps())})
        except Exception:  # noqa: BLE001
            log.exception("on_stats callback failed")
        if not self._stopped:
            self._schedule_stats()

    def _on_pad_added(self, _demux: Gst.Element, pad: Gst.Pad) -> None:
        name = pad.get_name()
        if name.startswith("video"):
            parser = Gst.ElementFactory.make("h264parse", None)
        elif name.startswith("audio"):
            parser = Gst.ElementFactory.make("aacparse", None)
        else:
            return
        assert self._pipeline is not None and self._mux is not None
        self._pipeline.add(parser)
        parser.sync_state_with_parent()
        pad.link(parser.get_static_pad("sink"))
        parser.link(self._mux)

    def push(self, data: bytes) -> bool:
        if self._appsrc is None:
            return False
        self.tracker.add_bytes(len(data))
        buf = Gst.Buffer.new_wrapped(data)
        return self._appsrc.emit("push-buffer", buf) == Gst.FlowReturn.OK

    def eos(self) -> None:
        self._stopped = True
        if self._stats_timer is not None:
            self._stats_timer.cancel()
        if self._appsrc is not None:
            self._appsrc.emit("end-of-stream")
        if self._pipeline is not None:
            self._pipeline.set_state(Gst.State.NULL)
        self._on_end(round(self.tracker.average_kbps()))
