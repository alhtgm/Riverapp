-- subjects
create table subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  name       text not null,
  color      text not null,
  "order"    integer not null default 0,
  created_at timestamptz default now()
);

alter table subjects enable row level security;
create policy "Users can manage own subjects"
  on subjects for all using (auth.uid() = user_id);

-- recurrences
create table recurrences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  subject_id     uuid references subjects(id) on delete cascade not null,
  title          text not null,
  start_from     date not null,
  interval_weeks integer not null default 1,
  duration_days  integer not null,
  count          integer not null,
  created_at     timestamptz default now()
);

alter table recurrences enable row level security;
create policy "Users can manage own recurrences"
  on recurrences for all using (auth.uid() = user_id);

-- tasks
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  subject_id     uuid references subjects(id) on delete cascade not null,
  recurrence_id  uuid references recurrences(id) on delete set null,
  title          text not null,
  start_date     date not null,
  due_date       date not null,
  status         text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'done', 'submitted')),
  memo           text,
  created_at     timestamptz default now()
);

alter table tasks enable row level security;
create policy "Users can manage own tasks"
  on tasks for all using (auth.uid() = user_id);
