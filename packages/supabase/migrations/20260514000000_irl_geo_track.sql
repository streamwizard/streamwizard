create table irl_geo_track (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid not null,
  stream_id    text references public.vods(stream_id) on delete set null,
  latitude     double precision not null,
  longitude    double precision not null,
  altitude     double precision,
  speed        double precision,
  heading      double precision,
  accuracy     double precision,
  recorded_at  timestamptz not null,
  inserted_at  timestamptz not null default now()
);

create index irl_geo_track_session_idx
  on irl_geo_track (session_id, recorded_at asc);

create index irl_geo_track_user_idx
  on irl_geo_track (user_id, recorded_at desc);

create index irl_geo_track_stream_idx
  on irl_geo_track (stream_id, recorded_at asc);

alter table irl_geo_track enable row level security;

create policy "Users can read own geo tracks"
  on irl_geo_track for select
  using (auth.uid() = user_id);
