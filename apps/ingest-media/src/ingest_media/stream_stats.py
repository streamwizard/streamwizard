"""Protocol-agnostic throughput tracking, shared by both relay types.

This is the one signal available regardless of input protocol (RTMP has no
transport-level stats we can read; SRT does — see libsrt.get_stats — so SRT
sessions report both this and the richer SRT stats).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class BitrateTracker:
    _window_bytes: int = 0
    _window_start: float = field(default_factory=time.monotonic)
    _total_bytes: int = 0
    _session_start: float = field(default_factory=time.monotonic)

    def add_bytes(self, n: int) -> None:
        self._window_bytes += n
        self._total_bytes += n

    def sample_kbps(self) -> float:
        """Bitrate since the last sample_kbps() call; resets the window."""
        now = time.monotonic()
        elapsed = now - self._window_start
        kbps = (self._window_bytes * 8 / 1000) / elapsed if elapsed > 0 else 0.0
        self._window_bytes = 0
        self._window_start = now
        return kbps

    def average_kbps(self) -> float:
        """Bitrate across the whole session so far — used for the final report."""
        elapsed = time.monotonic() - self._session_start
        return (self._total_bytes * 8 / 1000) / elapsed if elapsed > 0 else 0.0
