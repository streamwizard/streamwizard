import type { AutoSwitcherStatus } from "@repo/schemas";
import { ServiceSocket, type AuthHeaderProvider } from "@repo/ws-client/service-socket";

// Bot-role client pushing streamwizard.auto_switcher_status into the user's
// room, so the Auto Switcher status card sees live engine state. Separate
// connection from the consumer feed: bots are send-only, consumers
// receive-only, and ws-server keeps those roles distinct.
export class StatusPublisher {
  private socket: ServiceSocket;

  constructor(url: string, authHeader: AuthHeaderProvider) {
    this.socket = new ServiceSocket({
      url,
      query: { role: "bot" },
      authHeader,
      name: "status-publisher",
      noCredentialMessage: "no ws-server credential (WS_SERVICE_SIGNING_JWK); status pushes are off",
    });
  }

  connect(): void {
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  publish(userId: string, status: AutoSwitcherStatus): void {
    this.socket.send({ userId, type: "streamwizard.auto_switcher_status", payload: status });
  }
}
