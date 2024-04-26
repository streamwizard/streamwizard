export type TwitchData = {
  username: string;
  channelID: number;
  accessToken: string;
  refreshToken: string;
  email: string;
  broadcasterType: string;
  profileImage: string;
  offlineImage: string;
  userid: string;
  IRC: boolean;
  teamID: string | null;
  membershipID: string | null;
  betaAccess?: boolean;
  isLive: boolean
}
