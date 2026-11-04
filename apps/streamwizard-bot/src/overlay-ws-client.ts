import type { BotBroadcastMessage } from "@repo/types";
import { ServiceSocket, type AuthHeaderProvider } from "@repo/ws-client/service-socket";

class OverlayWsClient {
  private socket: ServiceSocket | null = null;

  /** `authHeader` runs on every (re)connect: a fresh service token, or
   *  null when this service has no signing key. */
  connect(url: string, authHeader: AuthHeaderProvider): void {
    this.socket = new ServiceSocket({
      url,
      query: { role: "bot" },
      authHeader,
      name: "overlay-ws-client",
      noCredentialMessage: "no ws-server credential; overlay pushes are off",
    });
    this.socket.connect();
  }

  send(message: BotBroadcastMessage): void {
    this.socket?.send(message);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}

export const overlayWsClient = new OverlayWsClient();
