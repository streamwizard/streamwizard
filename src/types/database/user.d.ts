interface UserCustomClaims {
  broadcaster_type: "affiliate" | "partner" | "none";
  description: string;
  offline_image_url: string;
  type: string;
  view_count: number;
}

export interface UserMetaData {
  avatar_url: string;
  custom_claims: UserCustomClaims;
  email: string;
  email_verified: boolean;
  full_name: string;
  iss: string;
  name: string;
  nickname: string;
  phone_verified: boolean;
  picture: string;
  provider_id: string;
  slug: string;
  sub: string;
}

export interface Twitch_integration {
  user_id: string;
  username: string;
  channel_id: number;
  access_token: string;
  refresh_token: string;
  email: string;
  beta_access: boolean;
  is_live: boolean;
}