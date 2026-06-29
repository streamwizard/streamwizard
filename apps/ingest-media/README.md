# ingest-media

The Python media plane for the StreamWizard ingest server. Accepts RTMP, SRT, and
SRTLA from IRL streamers, authorizes each connection against the Bun control
plane, and passthrough-relays (no transcode) the feed to the streamer's OBS
container over SRT.

## How it works

```
streamer ──RTMP──────────────► rtmp_listener (pyrtmp) ─┐
streamer ──SRT (streamid=key)─► srt_listener (libsrt)  ├─► authorize() ─► control plane
srtla_receiver ──SRT internal─► srt_listener (srtla)   ┘        │
                                                                ▼
                                          GStreamer passthrough ─► srt://sw-obs-<user>:9000
```

- **SRT / SRTLA** (`srt_listener.py`, `libsrt.py`): one libsrt listener socket per
  port accepts many callers; the `streamid` carries the stream key. SRTLA arrives
  on an internal port fed by the Belabox `srtla_receiver` and is otherwise plain
  SRT — only the reported protocol label differs. The accepted MPEG-TS is relayed
  verbatim to OBS via a GStreamer `appsrc ! srtsink` pipeline.
- **RTMP** (`rtmp_listener.py`, `pipelines.py`): pyrtmp runs the RTMP server; the
  reconstructed FLV is remuxed to MPEG-TS (codec copy) and pushed to OBS over SRT.
- **Auth** (`control_client.py`): every connect calls `POST /internal/authorize`
  on the control plane with the stream key; rejection closes the connection.

## Config (env)

| Var | Default | Meaning |
| --- | --- | --- |
| `INGEST_CONTROL_URL` | — (required) | Base URL of the Bun control plane |
| `INGEST_CONTROL_SECRET` | — (required) | Shared secret for `/internal/*` |
| `INGEST_SRT_PORT` | `8888` | Public SRT ingest (UDP) |
| `INGEST_SRTLA_SRT_PORT` | `8889` | Internal SRT port fed by srtla_receiver |
| `INGEST_RTMP_PORT` | `1935` | Public RTMP ingest (TCP) |
| `INGEST_CONTROL_TIMEOUT` | `5` | Control-plane request timeout (s) |
| `INGEST_LOG_LEVEL` | `INFO` | Log level |

## Validation status

The control-plane auth flow and FLV/TS framing are deterministic and unit-checkable.
The **GStreamer pipelines and the libsrt ctypes binding require on-hardware
validation** (a running GStreamer + libsrt) — see the repo `docker/stream-server`
compose stack and the end-to-end steps in the implementation plan. The libsrt
accept/streamid path is the highest-risk piece; if it proves troublesome, the
documented fallback is per-tenant SRT listener ports instead of shared-port
streamid routing.
