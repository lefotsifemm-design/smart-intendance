-- Run this in Supabase SQL Editor to enable the Recycle Bin feature
alter table subscriptions add column if not exists deleted_at timestamptz default null;
