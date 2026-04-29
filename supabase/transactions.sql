-- Run this in Supabase SQL Editor to enable the Statements feature

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  type        text not null check (type in ('income', 'expense')),
  category    text,
  amount      numeric not null,
  date        date,
  description text,
  counterparty text,
  source      text default 'csv',
  created_at  timestamptz default now()
);

-- RLS
alter table transactions enable row level security;

create policy "Users see own transactions"
  on transactions for all
  using (user_id = auth.uid()::text);
