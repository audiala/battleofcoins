create table battle_histories (
  id text primary key,
  date timestamp with time zone not null,
  prompt text not null,
  results jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for better performance
create index battle_histories_date_idx on battle_histories(date desc);
create index battle_histories_created_at_idx on battle_histories(created_at desc);