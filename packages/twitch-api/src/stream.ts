import { TwitchApiBaseClient } from "./base-client";
import type { Stream, GetStreamsParams, GetStreamsResponse } from "@repo/types";

interface GetStreamKeyResponse {
    data: { stream_key: string }[];
}

export class TwitchStreamsClient extends TwitchApiBaseClient {
    constructor(broadcaster_id: string | null = null) {
        super(broadcaster_id);
    }

    /**
     * Get a single stream for the broadcaster
     * @param options - Options for filtering the stream
     * @returns The stream object or undefined if not live
     */
    async getStream(params: GetStreamsParams = {}): Promise<Stream | undefined> {
        const response = await this.clientApi().get<GetStreamsResponse>(`/streams`, {
            params: {
                user_id: this.broadcaster_id,
                type: params.type || "live",
                first: params.first || 1,
                ...params,
            } as GetStreamsParams,
        });
        return response.data.data[0];
    }

    /**
     * Live state for one channel using the app token. /streams is public data,
     * so this avoids decrypting a broadcaster token on a path that overlay
     * viewers hit — unlike getStream(), which is for authenticated callers.
     * @returns The stream object, or undefined when the channel is offline
     */
    async getStreamWithAppToken(broadcasterId: string): Promise<Stream | undefined> {
        const response = await this.appApi().get<GetStreamsResponse>(`/streams`, {
            params: { user_id: broadcasterId, type: "live", first: 1 },
        });
        return response.data.data[0];
    }

    /**
     * Get a list of streams with full filtering and pagination support
     * @param params - Parameters for filtering and pagination
     * @returns Response containing array of streams and pagination info
     */
    async getStreams(params?: GetStreamsParams): Promise<GetStreamsResponse> {
        const response = await this.clientApi().get<GetStreamsResponse>(`/streams`, {
            params: params,
        });
        return response.data;
    }

    /**
     * The broadcaster's primary stream key. A live broadcast credential:
     * callers must gate who gets to see it. Needs the channel:read:stream_key
     * scope on the stored user token.
     */
    async getStreamKey(): Promise<string> {
        const response = await this.clientApi().get<GetStreamKeyResponse>(`/streams/key`, {
            params: { broadcaster_id: this.broadcaster_id },
        });
        const key = response.data.data[0]?.stream_key;
        if (!key) throw new Error("No stream key returned by Twitch API");
        return key;
    }
}
