"""Monkeypatch for a real bug in pyrtmp==0.3.0's handshake buffering.

pyrtmp.BitStreamReader.read() computes how many more bits it needs to top up
its internal buffer before parsing a format string (e.g. "bytes:1528" for the
RTMP C2 handshake). It does `int(length) - (buffer bits available)`, treating
`length` as a bit count for every format. But bitstring's tokenparser returns
`length` in the token's native unit — for "bytes:N" tokens that's N *bytes*,
not bits. So for any "bytes:N" read, pyrtmp under-counts by 8x, stops filling
the buffer too early, and bitstring.read() then raises:

    ReadError: Needed a length of at least <N*8> bits, but only <fewer> bits
    were available.

This fires on essentially every RTMP connection during the handshake (C2 is a
"bytes:1528" read), so it isn't an edge case — it breaks RTMP ingest entirely.
Upstream is unmaintained (last release 0.3.0), so we patch it in-process rather
than fork it.
"""

from __future__ import annotations

from bitstring.utils import tokenparser
from pyrtmp import BitStreamReader


async def _read(self: BitStreamReader, fmt: str):
    _, token = tokenparser(fmt)
    assert len(token) == 1
    name, length, _ = token[0]
    assert length is not None

    bits_per_unit = 8 if name == "bytes" else 1
    bit_needed = int(length) * bits_per_unit - (self.buffer.length - self.buffer.pos)
    while bit_needed > 0:
        new_data = await self.reader.read(4096)
        if len(new_data) == 0:
            from pyrtmp import StreamClosedException

            raise StreamClosedException()
        self._append(new_data)
        bit_needed = int(length) * bits_per_unit - (self.buffer.length - self.buffer.pos)

    value = self.buffer.read(fmt)
    del self.buffer[: int(length) * bits_per_unit]
    self.buffer.bitpos = 0
    return value


def apply() -> None:
    BitStreamReader.read = _read
