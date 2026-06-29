"""Entrypoint for the ingest media plane.

Starts the SRT (public), SRTLA (internal, fed by srtla_receiver), and RTMP
listeners, then runs the GLib main loop that drives the GStreamer relays.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import threading

import gi

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # noqa: E402

from . import libsrt
from .config import load_config
from .control_client import ControlClient
from .rtmp_listener import RtmpServer
from .srt_listener import SrtListener


def main() -> None:
    config = load_config()
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    log = logging.getLogger("ingest-media")

    libsrt.startup()
    control = ControlClient(config)

    srt = SrtListener(config.srt_port, "srt", control)
    srtla = SrtListener(config.srtla_srt_port, "srtla", control)
    srt.start()
    srtla.start()

    # RTMP runs on its own asyncio loop in a background thread.
    rtmp_server = RtmpServer(control)

    def run_rtmp() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(rtmp_server.create("0.0.0.0", config.rtmp_port))
        loop.run_forever()

    threading.Thread(target=run_rtmp, name="rtmp-loop", daemon=True).start()

    glib_loop = GLib.MainLoop()

    def shutdown(*_args) -> None:
        log.info("shutting down")
        srt.stop()
        srtla.stop()
        libsrt.cleanup()
        glib_loop.quit()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info("ingest media plane started")
    glib_loop.run()


if __name__ == "__main__":
    main()
