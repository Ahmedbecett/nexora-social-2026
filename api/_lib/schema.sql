-- NEXORA database schema (PostgreSQL / Neon)
create table if not exists users (
  id            bigserial primary key,
  username      text not null unique,
  full_name     text not null default '',
  email         text unique,
  phone         text unique,
  password_hash text not null,
  bio           text not null default '',
  website       text not null default '',
  avatar_url    text,
  is_private    boolean not null default false,
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists posts (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  kind       text not null default 'post' check (kind in ('post','reel')),
  media      jsonb not null default '[]',
  caption    text not null default '',
  location   text not null default '',
  audio      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists posts_user_idx on posts(user_id, created_at desc);
create index if not exists posts_kind_idx on posts(kind, created_at desc);

create table if not exists likes (
  user_id    bigint not null references users(id) on delete cascade,
  post_id    bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists likes_post_idx on likes(post_id);

create table if not exists saves (
  user_id    bigint not null references users(id) on delete cascade,
  post_id    bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists comments (
  id         bigserial primary key,
  post_id    bigint not null references posts(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on comments(post_id, created_at);

create table if not exists follows (
  follower_id  bigint not null references users(id) on delete cascade,
  following_id bigint not null references users(id) on delete cascade,
  status       text not null default 'accepted' check (status in ('accepted','pending')),
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);
create index if not exists follows_following_idx on follows(following_id);

create table if not exists stories (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  media_url  text not null,
  media_type text not null default 'image',
  created_at timestamptz not null default now()
);
create index if not exists stories_user_idx on stories(user_id, created_at desc);

create table if not exists story_views (
  story_id   bigint not null references stories(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists highlights (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  title      text not null,
  items      jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  actor_id   bigint not null references users(id) on delete cascade,
  type       text not null,
  post_id    bigint references posts(id) on delete cascade,
  text       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

create table if not exists messages (
  id          bigserial primary key,
  sender_id   bigint not null references users(id) on delete cascade,
  receiver_id bigint not null references users(id) on delete cascade,
  text        text not null default '',
  media_url   text,
  post_id     bigint references posts(id) on delete set null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists messages_pair_idx on messages(sender_id, receiver_id, id);
create index if not exists messages_receiver_idx on messages(receiver_id, id);

create table if not exists reports (
  id          bigserial primary key,
  reporter_id bigint not null references users(id) on delete cascade,
  post_id     bigint references posts(id) on delete cascade,
  user_id     bigint references users(id) on delete cascade,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- v2.1
alter table users add column if not exists firebase_uid text unique;
alter table users alter column password_hash drop not null;
alter table users add column if not exists settings jsonb not null default '{}';
alter table users add column if not exists token_version int not null default 0;
alter table stories add column if not exists audience text not null default 'all';

create table if not exists blocks (
  blocker_id bigint not null references users(id) on delete cascade,
  blocked_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked_idx on blocks(blocked_id);

-- per-user relationship lists: mute, restrict, favorite, close friend
create table if not exists user_lists (
  owner_id   bigint not null references users(id) on delete cascade,
  target_id  bigint not null references users(id) on delete cascade,
  kind       text not null check (kind in ('mute','restrict','favorite','close')),
  created_at timestamptz not null default now(),
  primary key (owner_id, target_id, kind)
);
create index if not exists user_lists_target_idx on user_lists(target_id, kind);

-- own phone OTP (free SMS through the owner's Android gateway)
create table if not exists phone_otps (
  phone      text primary key,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0
);
create table if not exists otp_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0,
  last_at      timestamptz not null default now()
);
