-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste this -> Run.
-- It creates the tables your website needs. Safe to run only once.

create table if not exists services (
  id text primary key,
  title text not null,
  desc text not null,
  icon text not null default 'asset',
  rate text default ''
);

create table if not exists contacts (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null,
  service text not null,
  date text default '',
  notes text default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists admin_users (
  id int primary key,
  username text not null,
  password_hash text not null
);
