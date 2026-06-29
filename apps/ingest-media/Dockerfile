# Ingest media plane (Python + GStreamer + libsrt).
#
# Runs on the dedicated stream box via docker/stream-server/docker-compose.yml.
# GStreamer + PyGObject + libsrt come from Debian system packages; only pyrtmp
# is installed via pip.

# Use the distro Python (not python:3.x-slim). The GStreamer bindings come from
# the apt `python3-gi` package, whose compiled `_gi` extension is built for the
# distro's system Python. A python:3.x-slim base ships its own /usr/local Python
# at a different version, which cannot load that extension (ModuleNotFoundError
# / ABI mismatch on `import gi`). Running the system python3 keeps them aligned.
FROM debian:trixie-slim AS runner

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# System media stack:
#  - python3 + python3-pip : distro Python that python3-gi is built against
#  - python3-gi + gir1.2-* : GStreamer Python bindings
#  - gstreamer1.0-plugins-{base,good,bad,libav} : srtsink, flvdemux, h264parse,
#    aacparse, mpegtsmux, appsrc
#  - libsrt-openssl-dev / libsrt1.5-openssl : libsrt loaded via ctypes
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-gi \
        python3-gst-1.0 \
        gir1.2-glib-2.0 \
        gir1.2-gstreamer-1.0 \
        gstreamer1.0-plugins-base \
        gstreamer1.0-plugins-good \
        gstreamer1.0-plugins-bad \
        gstreamer1.0-libav \
        libsrt1.5-openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/ingest-media/requirements.txt ./requirements.txt
# Use the system site-packages (where python3-gi lives) rather than an isolated venv.
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY apps/ingest-media/src ./src

ENV PYTHONPATH=/app/src

# SRT (public), SRTLA-internal, RTMP. SRT/SRTLA are UDP; RTMP is TCP.
EXPOSE 8888/udp 8889/udp 1935/tcp

CMD ["python3", "-m", "ingest_media.main"]
