-- Run this in Supabase SQL Editor to enable the Budgets feature

create table if not exists budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  category    text not null,
  amount      numeric not null,
  period      text not null default 'monthly' check (period in ('monthly', 'annual')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, category)
);

-- RLS
alter table budgets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'budgets'
      and policyname = 'Users manage own budgets'
  ) then
    execute $p$
      create policy "Users manage own budgets"
        on budgets for all
        using (user_id = auth.uid()::text)
    $p$;
  end if;
end;
$$;
