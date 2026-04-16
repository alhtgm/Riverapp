-- Add row_id to tasks for grouping single tasks on the same timeline row
alter table tasks add column if not exists row_id uuid;
