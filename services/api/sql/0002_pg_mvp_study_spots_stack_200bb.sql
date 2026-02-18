do $$
declare
  constraint_name text;
begin
  if to_regclass('public.pg_mvp_study_spots') is null then
    return;
  end if;

  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pg_mvp_study_spots'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%stack_bb%'
  loop
    execute format('alter table public.pg_mvp_study_spots drop constraint %I', constraint_name);
  end loop;

  alter table public.pg_mvp_study_spots
    add constraint pg_mvp_study_spots_stack_bb_check
    check (stack_bb in (20, 40, 60, 100, 200));
end
$$;
