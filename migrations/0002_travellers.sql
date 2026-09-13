create table if not exists travellers (
  id text primary key,
  created_at timestamptz not null default now(),
  handle text not null,
  title text not null,
  note text not null default '',
  consent boolean not null,
  mime text not null,
  image text not null,
  thumb text not null,
  status text not null default 'pending'
);

create index if not exists travellers_status_idx on travellers (status, created_at desc);
