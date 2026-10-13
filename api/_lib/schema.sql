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

-- world reels: freely-licensed videos from Wikimedia Commons (cached)
create table if not exists world_media (
  id          bigserial primary key,
  source      text not null,
  source_id   text not null,
  topic       text not null,
  url         text not null,
  poster      text,
  width       int,
  height      int,
  duration    real,
  title       text,
  description text,
  author      text,
  license     text,
  page_url    text,
  created_at  timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists world_media_topic_idx on world_media(topic);
create table if not exists world_fetch (
  topic      text primary key,
  fetched_at timestamptz,
  runs       int not null default 0
);
create table if not exists world_likes (
  user_id    bigint not null references users(id) on delete cascade,
  media_id   bigint not null references world_media(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create index if not exists world_likes_media_idx on world_likes(media_id);
create table if not exists world_hidden (
  user_id    bigint not null references users(id) on delete cascade,
  media_id   bigint not null references world_media(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

-- 2.4: profile notes & links, reposts, views
alter table users add column if not exists note text;
alter table users add column if not exists note_at timestamptz;
alter table users add column if not exists links jsonb not null default '[]'::jsonb;
create table if not exists reposts (
  user_id    bigint not null references users(id) on delete cascade,
  post_id    bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists reposts_post_idx on reposts(post_id);
create table if not exists post_views (
  user_id    bigint not null references users(id) on delete cascade,
  post_id    bigint not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists post_views_post_idx on post_views(post_id);
create table if not exists world_views (
  user_id    bigint not null references users(id) on delete cascade,
  media_id   bigint not null references world_media(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create index if not exists world_views_media_idx on world_views(media_id);

-- 2.4.3: chat reply / reactions / pin / unsend / delete for you
alter table messages add column if not exists reply_to bigint references messages(id) on delete set null;
alter table messages add column if not exists unsent boolean not null default false;
alter table messages add column if not exists hidden_for bigint[] not null default '{}';
alter table messages add column if not exists pinned_at timestamptz;
alter table messages add column if not exists updated_at timestamptz not null default now();
create index if not exists messages_updated_idx on messages(updated_at);
create table if not exists message_reactions (
  message_id bigint not null references messages(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- 2.4.4: activity status, seen time, typing indicator
alter table users add column if not exists last_active_at timestamptz;
alter table messages add column if not exists read_at timestamptz;
create table if not exists typing (
  user_id    bigint not null references users(id) on delete cascade,
  partner_id bigint not null references users(id) on delete cascade,
  at         timestamptz not null default now(),
  primary key (user_id, partner_id)
);

-- 2.4.5: voice / video messages, edit
alter table messages add column if not exists media_type text;
alter table messages add column if not exists media_meta jsonb;
alter table messages add column if not exists edited_at timestamptz;

-- 2.4.6 — comment replies and comment likes
alter table comments add column if not exists parent_id bigint references comments(id) on delete cascade;
create index if not exists comments_parent_idx on comments(parent_id);
create table if not exists comment_likes (
  comment_id bigint not null references comments(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- 2026-10-13: server-side settings (AI provider keys) + client error reports
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists client_errors (
  id         bigserial primary key,
  user_id    bigint references users(id) on delete set null,
  path       text,
  code       text,
  detail     text,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on client_errors(created_at desc);

/* ---- NEXORA AI PLUS (المحادثات المحفوظة · الملفات المرفقة) ---- */
create table if not exists ai_conversations (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  title      text not null default 'محادثة جديدة',
  mode       text not null default 'chat',
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conv_user_idx on ai_conversations(user_id, updated_at desc);

create table if not exists ai_messages (
  id              bigserial primary key,
  conversation_id bigint not null references ai_conversations(id) on delete cascade,
  user_id         bigint not null references users(id) on delete cascade,
  role            text not null,
  text            text not null default '',
  provider        text,
  model           text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists ai_msg_conv_idx on ai_messages(conversation_id, id);

create table if not exists ai_files (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  name       text not null,
  mime       text not null,
  size       int not null,
  kind       text not null,
  blob_url   text,
  extracted  text,
  created_at timestamptz not null default now()
);


/* ------------------------------------------------------------------ */
/* الاشتراكات والمدفوعات (نظام NEXORA AI) — تُنشأ أيضًا runtime في      */
/* api/_lib/subscriptions.js عبر subsEnsure() لضمان تطبيق آمن بلا هجرات */
/* ------------------------------------------------------------------ */
create table if not exists subscription_plans (
  id text primary key, name_ar text not null, name_en text, tier int not null default 0,
  currency text not null default 'DZD', price_month numeric(12,2) not null default 0,
  price_year numeric(12,2) not null default 0, price_usd_month numeric(12,2), price_eur_month numeric(12,2),
  included_credits int not null default 0, features jsonb not null default '[]'::jsonb,
  approved boolean not null default false, note text, active boolean not null default true,
  sort int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists usage_limits (
  id bigserial primary key, plan_id text not null references subscription_plans(id) on delete cascade,
  feature text not null, period text not null default 'month', limit_count int not null,
  cost_units numeric(8,3) not null default 1, updated_at timestamptz not null default now(),
  unique (plan_id, feature));
create table if not exists user_subscriptions (
  id bigserial primary key, user_id bigint not null references users(id) on delete cascade,
  plan_id text not null references subscription_plans(id), period text not null default 'month',
  status text not null default 'pending', started_at timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean not null default false, auto_renew boolean not null default false,
  provider text, provider_ref text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), canceled_at timestamptz);
create unique index if not exists user_subs_one_live on user_subscriptions(user_id) where status in ('active','pending');
create table if not exists payment_transactions (
  id bigserial primary key, user_id bigint not null references users(id) on delete cascade,
  subscription_id bigint references user_subscriptions(id) on delete set null, reference text unique not null,
  provider text not null default 'wallet', provider_ref text, purpose text not null default 'subscription',
  plan_id text, period text, amount numeric(12,2) not null default 0, currency text not null default 'DZD',
  fees numeric(12,2) not null default 0, method text, status text not null default 'pending',
  created_at timestamptz not null default now(), paid_at timestamptz, failed_at timestamptz,
  updated_at timestamptz not null default now(), meta jsonb not null default '{}'::jsonb);
create table if not exists payment_webhook_events (
  id bigserial primary key, provider text not null, event_id text not null, reference text,
  signature_valid boolean not null default false, payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(), processed boolean not null default false,
  result text, processed_at timestamptz, unique (provider, event_id));
create table if not exists usage_records (
  id bigserial primary key, user_id bigint not null references users(id) on delete cascade,
  feature text not null, units numeric(8,2) not null default 1, bill_mode text not null default 'plan',
  credits_spent int not null default 0, cost_estimate numeric(10,4) not null default 0,
  provider text, model text, subscription_id bigint references user_subscriptions(id) on delete set null,
  created_at timestamptz not null default now());
create table if not exists refund_records (
  id bigserial primary key, transaction_id bigint not null references payment_transactions(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade, amount numeric(12,2) not null,
  currency text not null default 'DZD', reason text, status text not null default 'requested',
  provider_ref text, requested_at timestamptz not null default now(), processed_at timestamptz, processed_by bigint);
