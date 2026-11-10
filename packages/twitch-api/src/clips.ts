import { TwitchApiBaseClient } from "./base-client";
import type {
  CreateClipFromVodParams,
  CreateClipFromVodResponse,
  CreateClipParams,
  CreateClipResponse,
  GetClipsParams,
  GetClipsResponse,
} from "@repo/types/helix";

export interface ClipDownloadUrl {
  clip_id: string;
  landscape_download_url: string | null;
  portrait_download_url: string | null;
}

export class TwitchClipsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /** Retrieve clips for a broadcaster, game, or by clip ID. */
  async getClips(options: GetClipsParams): Promise<GetClipsResponse> {
    const response = await this.appApi().get<GetClipsResponse>("/clips", {
      params: options,
    });
    return response.data;
  }

  /** Create a clip from the broadcaster's live stream. Requires `clips:edit` scope. */
  async createClip(params: Omit<CreateClipParams, "broadcaster_id"> = {}): Promise<CreateClipResponse> {
    const response = await this.clientApi().post<CreateClipResponse>("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as CreateClipParams,
    });
    return response.data;
  }

  /** Create a clip from a VOD segment. Requires `clips:edit` scope. */
  async createClipFromVod(
    params: Omit<CreateClipFromVodParams, "broadcaster_id" | "editor_id">
  ): Promise<CreateClipFromVodResponse> {
    const response = await this.clientApi().post<CreateClipFromVodResponse>("/videos/clips", null, {
      params: {
        editor_id: this.broadcaster_id,
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as CreateClipFromVodParams,
    });
    return response.data;
  }

  /** Retrieve download URLs (landscape and portrait) for a clip. */
  async getClipDownloadUrl(params: {
    broadcaster_id: string;
    editor_id: string;
    clip_id: string;
  }): Promise<{ data: ClipDownloadUrl[] }> {
    const response = await this.appApi().get("/clips/downloads", { params });
    return response.data;
  }
}
