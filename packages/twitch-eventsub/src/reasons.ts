/** Human-readable explanations for Twitch's EventSub status and close codes. */

/** Close codes Twitch sends when it ends an EventSub WebSocket. */
export const WebSocketCloseCode = {
    InternalServerError: 4000,
    ClientSentInboundTraffic: 4001,
    ClientFailedPingPong: 4002,
    ConnectionUnused: 4003,
    ReconnectGraceTimeExpired: 4004,
    NetworkTimeout: 4005,
    NetworkError: 4006,
    InvalidReconnect: 4007,
} as const;

export type WebSocketCloseCode = (typeof WebSocketCloseCode)[keyof typeof WebSocketCloseCode];

export function revocationReason(status: string | undefined): string {
    switch (status) {
        case 'user_removed':
            return 'The user no longer exists';
        case 'authorization_revoked':
            return 'The authorization token was revoked';
        case 'version_removed':
            return 'The subscription type/version is no longer supported';
        default:
            return 'Unknown reason';
    }
}

export function closeReason(code: number): string {
    switch (code) {
        case 4000:
            return 'Internal server error';
        case 4001:
            return 'Client sent inbound traffic';
        case 4002:
            return 'Client failed ping-pong';
        case 4003:
            return 'Connection unused';
        case 4004:
            return 'Reconnect grace time expired';
        case 4005:
            return 'Network timeout';
        case 4006:
            return 'Network error';
        case 4007:
            return 'Invalid reconnect URL';
        case 1000:
            return 'Normal closure';
        default:
            return 'Unknown close code';
    }
}
