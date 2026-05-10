export type { ChannelSearchResult, TwitchUser, TwitchGame, TwitchCategory } from "./search";
export type { ClipDownloadUrl } from "./clips";
export type { Vod, GetVodsParams } from "./vods";
import { TwitchChatClient } from "./chat";
import { TwitchEventSubClient } from "./eventsub";
import { TwitchFollowersClient } from "./followers";
import { TwitchSubscriptionsClient } from "./subscriptions";
import { TwitchMarkersClient } from "./markers";
import { TwitchClipsClient } from "./clips";
import { TwitchStreamsClient } from "./stream";
import { TwitchVodsClient } from "./vods";
import { TwitchSearchClient } from "./search";
import { TwitchAdsClient } from "./ads";

export class TwitchApi {
  public chat: TwitchChatClient;
  public eventsub: TwitchEventSubClient;
  public followers: TwitchFollowersClient;
  public subscriptions: TwitchSubscriptionsClient;
  public markers: TwitchMarkersClient;
  public clips: TwitchClipsClient;
  public streams: TwitchStreamsClient;
  public videos: TwitchVodsClient;
  public search: TwitchSearchClient;
  public ads: TwitchAdsClient;

  constructor(broadcaster_id: string | null = null) {
    this.chat = new TwitchChatClient(broadcaster_id);
    this.eventsub = new TwitchEventSubClient(broadcaster_id);
    this.followers = new TwitchFollowersClient(broadcaster_id);
    this.subscriptions = new TwitchSubscriptionsClient(broadcaster_id);
    this.markers = new TwitchMarkersClient(broadcaster_id);
    this.clips = new TwitchClipsClient(broadcaster_id);
    this.streams = new TwitchStreamsClient(broadcaster_id);
    this.videos = new TwitchVodsClient(broadcaster_id);
    this.search = new TwitchSearchClient(broadcaster_id);
    this.ads = new TwitchAdsClient(broadcaster_id);
  }
}
