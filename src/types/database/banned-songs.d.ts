export interface BannedSongs {
  id?: string;
  created_at?: Date;
  song_id: string;
  song_name: string;
  broadcaster_id: string;
  broadcaster_name: string;
  settings_id?: string;
  user_id?: string;
}