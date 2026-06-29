"""Environment configuration for the ingest media plane."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    # Control plane (Bun) — validates stream keys and provisions OBS.
    control_url: str
    control_secret: str

    # Public SRT ingest port (streamers connect here directly).
    srt_port: int
    # Internal SRT port fed by the Belabox srtla_receiver; connections here are
    # tagged with the "srtla" protocol but are otherwise plain SRT.
    srtla_srt_port: int
    # Public RTMP ingest port.
    rtmp_port: int

    # How long (seconds) to wait for the control plane before rejecting a connect.
    control_timeout: float

    log_level: str


def load_config() -> Config:
    control_url = os.environ.get("INGEST_CONTROL_URL")
    control_secret = os.environ.get("INGEST_CONTROL_SECRET")
    if not control_url:
        raise RuntimeError("INGEST_CONTROL_URL is required")
    if not control_secret:
        raise RuntimeError("INGEST_CONTROL_SECRET is required")

    return Config(
        control_url=control_url.rstrip("/"),
        control_secret=control_secret,
        srt_port=int(os.environ.get("INGEST_SRT_PORT", "8888")),
        srtla_srt_port=int(os.environ.get("INGEST_SRTLA_SRT_PORT", "8889")),
        rtmp_port=int(os.environ.get("INGEST_RTMP_PORT", "1935")),
        control_timeout=float(os.environ.get("INGEST_CONTROL_TIMEOUT", "5")),
        log_level=os.environ.get("INGEST_LOG_LEVEL", "INFO"),
    )
