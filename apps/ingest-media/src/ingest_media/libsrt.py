"""Minimal ctypes binding to libsrt.

We use libsrt's standard server API (bind/listen/accept) so that a single
listener can accept many concurrent callers, each carrying its own `streamid`.
This is exactly how srt-live-server uses libsrt — we are *using* the C library's
server API, not reimplementing the SRT protocol.

Only the handful of functions we need are bound. The actual media relay is done
by GStreamer (see pipelines.py); libsrt here is purely accept + streamid + recv.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import socket
import struct
from typing import Optional

# --- libsrt constants ---------------------------------------------------------
SRT_ERROR = -1
SRT_INVALID_SOCK = -1

# Socket options (from srt.h)
SRTO_RCVSYN = 2          # bool: blocking recv
SRTO_SNDSYN = 1          # bool: blocking send
SRTO_STREAMID = 46       # string: the streamid set by the caller
SRTO_TRANSTYPE = 50      # enum: SRTT_LIVE = 0

SRTT_LIVE = 0

AF_INET = socket.AF_INET


class sockaddr_in(ctypes.Structure):
    _fields_ = [
        ("sin_family", ctypes.c_ushort),
        ("sin_port", ctypes.c_ushort),
        ("sin_addr", ctypes.c_uint32),
        ("sin_zero", ctypes.c_char * 8),
    ]


class SRT_TRACEBSTATS(ctypes.Structure):
    """Mirrors `struct CBytePerfMon` (aliased SRT_TRACEBSTATS) from srt.h.

    Field order/types verified against the installed libsrt-openssl-dev 1.5.x
    header (apt package on Debian trixie) — SRT only ever appends new fields
    at the end for ABI stability, so this prefix is safe even if a future
    libsrt minor version adds more fields after pktReorderTolerance.
    """

    _fields_ = [
        ("msTimeStamp", ctypes.c_int64),
        ("pktSentTotal", ctypes.c_int64),
        ("pktRecvTotal", ctypes.c_int64),
        ("pktSndLossTotal", ctypes.c_int),
        ("pktRcvLossTotal", ctypes.c_int),
        ("pktRetransTotal", ctypes.c_int),
        ("pktSentACKTotal", ctypes.c_int),
        ("pktRecvACKTotal", ctypes.c_int),
        ("pktSentNAKTotal", ctypes.c_int),
        ("pktRecvNAKTotal", ctypes.c_int),
        ("usSndDurationTotal", ctypes.c_int64),
        ("pktSndDropTotal", ctypes.c_int),
        ("pktRcvDropTotal", ctypes.c_int),
        ("pktRcvUndecryptTotal", ctypes.c_int),
        ("byteSentTotal", ctypes.c_uint64),
        ("byteRecvTotal", ctypes.c_uint64),
        ("byteRcvLossTotal", ctypes.c_uint64),
        ("byteRetransTotal", ctypes.c_uint64),
        ("byteSndDropTotal", ctypes.c_uint64),
        ("byteRcvDropTotal", ctypes.c_uint64),
        ("byteRcvUndecryptTotal", ctypes.c_uint64),
        ("pktSent", ctypes.c_int64),
        ("pktRecv", ctypes.c_int64),
        ("pktSndLoss", ctypes.c_int),
        ("pktRcvLoss", ctypes.c_int),
        ("pktRetrans", ctypes.c_int),
        ("pktRcvRetrans", ctypes.c_int),
        ("pktSentACK", ctypes.c_int),
        ("pktRecvACK", ctypes.c_int),
        ("pktSentNAK", ctypes.c_int),
        ("pktRecvNAK", ctypes.c_int),
        ("mbpsSendRate", ctypes.c_double),
        ("mbpsRecvRate", ctypes.c_double),
        ("usSndDuration", ctypes.c_int64),
        ("pktReorderDistance", ctypes.c_int),
        ("pktRcvAvgBelatedTime", ctypes.c_double),
        ("pktRcvBelated", ctypes.c_int64),
        ("pktSndDrop", ctypes.c_int),
        ("pktRcvDrop", ctypes.c_int),
        ("pktRcvUndecrypt", ctypes.c_int),
        ("byteSent", ctypes.c_uint64),
        ("byteRecv", ctypes.c_uint64),
        ("byteRcvLoss", ctypes.c_uint64),
        ("byteRetrans", ctypes.c_uint64),
        ("byteSndDrop", ctypes.c_uint64),
        ("byteRcvDrop", ctypes.c_uint64),
        ("byteRcvUndecrypt", ctypes.c_uint64),
        ("usPktSndPeriod", ctypes.c_double),
        ("pktFlowWindow", ctypes.c_int),
        ("pktCongestionWindow", ctypes.c_int),
        ("pktFlightSize", ctypes.c_int),
        ("msRTT", ctypes.c_double),
        ("mbpsBandwidth", ctypes.c_double),
        ("byteAvailSndBuf", ctypes.c_int),
        ("byteAvailRcvBuf", ctypes.c_int),
        ("mbpsMaxBW", ctypes.c_double),
        ("byteMSS", ctypes.c_int),
        ("pktSndBuf", ctypes.c_int),
        ("byteSndBuf", ctypes.c_int),
        ("msSndBuf", ctypes.c_int),
        ("msSndTsbPdDelay", ctypes.c_int),
        ("pktRcvBuf", ctypes.c_int),
        ("byteRcvBuf", ctypes.c_int),
        ("msRcvBuf", ctypes.c_int),
        ("msRcvTsbPdDelay", ctypes.c_int),
        ("pktSndFilterExtraTotal", ctypes.c_int),
        ("pktRcvFilterExtraTotal", ctypes.c_int),
        ("pktRcvFilterSupplyTotal", ctypes.c_int),
        ("pktRcvFilterLossTotal", ctypes.c_int),
        ("pktSndFilterExtra", ctypes.c_int),
        ("pktRcvFilterExtra", ctypes.c_int),
        ("pktRcvFilterSupply", ctypes.c_int),
        ("pktRcvFilterLoss", ctypes.c_int),
        ("pktReorderTolerance", ctypes.c_int),
        ("pktSentUniqueTotal", ctypes.c_int64),
        ("pktRecvUniqueTotal", ctypes.c_int64),
        ("byteSentUniqueTotal", ctypes.c_uint64),
        ("byteRecvUniqueTotal", ctypes.c_uint64),
        ("pktSentUnique", ctypes.c_int64),
        ("pktRecvUnique", ctypes.c_int64),
        ("byteSentUnique", ctypes.c_uint64),
        ("byteRecvUnique", ctypes.c_uint64),
    ]


def _load_libsrt() -> ctypes.CDLL:
    name = ctypes.util.find_library("srt") or "libsrt.so.1"
    lib = ctypes.CDLL(name)

    lib.srt_startup.restype = ctypes.c_int
    lib.srt_cleanup.restype = ctypes.c_int
    lib.srt_create_socket.restype = ctypes.c_int
    lib.srt_bind.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
    lib.srt_bind.restype = ctypes.c_int
    lib.srt_listen.argtypes = [ctypes.c_int, ctypes.c_int]
    lib.srt_listen.restype = ctypes.c_int
    lib.srt_accept.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)]
    lib.srt_accept.restype = ctypes.c_int
    lib.srt_setsockflag.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
    lib.srt_setsockflag.restype = ctypes.c_int
    lib.srt_getsockflag.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)]
    lib.srt_getsockflag.restype = ctypes.c_int
    lib.srt_recvmsg.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    lib.srt_recvmsg.restype = ctypes.c_int
    lib.srt_bstats.argtypes = [ctypes.c_int, ctypes.POINTER(SRT_TRACEBSTATS), ctypes.c_int]
    lib.srt_bstats.restype = ctypes.c_int
    lib.srt_close.argtypes = [ctypes.c_int]
    lib.srt_close.restype = ctypes.c_int
    lib.srt_getlasterror_str.restype = ctypes.c_char_p
    return lib


_lib = _load_libsrt()


def last_error() -> str:
    return _lib.srt_getlasterror_str().decode("utf-8", "replace")


def startup() -> None:
    if _lib.srt_startup() == SRT_ERROR:
        raise RuntimeError(f"srt_startup failed: {last_error()}")


def cleanup() -> None:
    _lib.srt_cleanup()


def create_listener(port: int, backlog: int = 16) -> int:
    """Create a bound, listening SRT socket on 0.0.0.0:port."""
    sock = _lib.srt_create_socket()
    if sock == SRT_INVALID_SOCK:
        raise RuntimeError(f"srt_create_socket failed: {last_error()}")

    live = ctypes.c_int(SRTT_LIVE)
    _lib.srt_setsockflag(sock, SRTO_TRANSTYPE, ctypes.byref(live), ctypes.sizeof(live))

    addr = sockaddr_in()
    addr.sin_family = AF_INET
    addr.sin_port = struct.unpack("H", struct.pack("!H", port))[0]  # htons
    addr.sin_addr = 0  # INADDR_ANY

    if _lib.srt_bind(sock, ctypes.byref(addr), ctypes.sizeof(addr)) == SRT_ERROR:
        _lib.srt_close(sock)
        raise RuntimeError(f"srt_bind({port}) failed: {last_error()}")
    if _lib.srt_listen(sock, backlog) == SRT_ERROR:
        _lib.srt_close(sock)
        raise RuntimeError(f"srt_listen({port}) failed: {last_error()}")
    return sock


def accept(listen_sock: int) -> tuple[int, Optional[str]]:
    """Block until a caller connects. Returns (socket, peer_ip)."""
    addr = sockaddr_in()
    addrlen = ctypes.c_int(ctypes.sizeof(addr))
    conn = _lib.srt_accept(listen_sock, ctypes.byref(addr), ctypes.byref(addrlen))
    if conn == SRT_INVALID_SOCK:
        raise RuntimeError(f"srt_accept failed: {last_error()}")
    peer_ip = socket.inet_ntoa(struct.pack("I", addr.sin_addr)) if addr.sin_addr else None
    return conn, peer_ip


def get_streamid(sock: int) -> str:
    buf = ctypes.create_string_buffer(512)
    size = ctypes.c_int(ctypes.sizeof(buf))
    if _lib.srt_getsockflag(sock, SRTO_STREAMID, buf, ctypes.byref(size)) == SRT_ERROR:
        return ""
    return buf.raw[: size.value].decode("utf-8", "replace")


def recv(sock: int, length: int = 1500) -> bytes:
    """Receive one message. Returns b'' on clean disconnect; raises on error."""
    buf = ctypes.create_string_buffer(length)
    n = _lib.srt_recvmsg(sock, buf, length)
    if n == 0:
        return b""
    if n == SRT_ERROR:
        # Connection broken / closed by peer.
        return b""
    return buf.raw[:n]


def get_stats(sock: int, clear: bool = True) -> Optional[dict]:
    """Snapshot this connection's live quality stats (loss, RTT, bandwidth).

    These come straight from SRT's own internal accounting, so they're a far
    earlier warning sign of a degrading link than our own byte counting:
    packet loss and RTT typically rise well before the encoder actually has
    to cut bitrate. `clear=True` resets the "local" (since-last-call)
    counters, matching how srt-live-transmit samples them periodically.
    """
    stats = SRT_TRACEBSTATS()
    if _lib.srt_bstats(sock, ctypes.byref(stats), 1 if clear else 0) == SRT_ERROR:
        return None
    return {
        "mbps_recv_rate": stats.mbpsRecvRate,
        "mbps_bandwidth": stats.mbpsBandwidth,
        "rtt_ms": stats.msRTT,
        "pkt_recv_loss": stats.pktRcvLoss,
        "pkt_recv_drop": stats.pktRcvDrop,
        "pkt_recv_retrans": stats.pktRcvRetrans,
        "pkt_recv_loss_total": stats.pktRcvLossTotal,
        "byte_recv_total": stats.byteRecvTotal,
    }


def close(sock: int) -> None:
    _lib.srt_close(sock)


def parse_stream_key(streamid: str) -> str:
    """Extract the stream key from an SRT streamid.

    Supports both the raw form (the key itself, as most IRL encoders send) and
    the standardized access-control form `#!::r=<key>,...` / `#!::u=...,r=<key>`.
    """
    if not streamid:
        return ""
    if streamid.startswith("#!::"):
        for pair in streamid[4:].split(","):
            if pair.startswith("r="):
                return pair[2:]
        return ""
    return streamid
