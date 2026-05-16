alter table overlay_scenes
  add column subscriber_token text unique
    default encode(gen_random_bytes(32), 'hex');

update overlay_scenes
  set subscriber_token = encode(gen_random_bytes(32), 'hex')
  where subscriber_token is null;

alter table overlay_scenes
  alter column subscriber_token set not null;
