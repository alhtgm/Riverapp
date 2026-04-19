-- Add optional due time to tasks
alter table tasks add column if not exists due_time text;
