alter table overlay_scenes
  add column render_mode text not null default 'obs'
    check (render_mode in ('obs', 'phone'));
