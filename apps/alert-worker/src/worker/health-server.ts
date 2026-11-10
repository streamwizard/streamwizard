import { isLoopAlive } from "@/worker/liveness";

/** Start the container health endpoint, tracking when the loop last finished a pass. */
export function startHealthServer(port: number, tickSeconds: number): {
  markPassFinished(): void;
  stop(): void;
} {
  let lastPassAt = Date.now();
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/health") {
        const ok = isLoopAlive(lastPassAt, Date.now(), tickSeconds);
        return Response.json({ ok, lastPassAt: new Date(lastPassAt).toISOString() }, { status: ok ? 200 : 503 });
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    markPassFinished() {
      lastPassAt = Date.now();
    },
    stop() {
      server.stop(true);
    },
  };
}
