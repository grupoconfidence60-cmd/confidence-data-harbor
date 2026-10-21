
create type public.app_role as enum ('admin','gestor','supervisor','rh','colaborador');
create type public.account_status as enum ('ativo','inativo','bloqueado');
create type public.colab_situacao as enum ('ativo','ferias','afastado','desligado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  cargo text,
  status public.account_status not null default 'ativo',
  last_access timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and r.role = _role and p.status = 'ativo')
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and r.role = any(_roles) and p.status = 'ativo')
$$;

create or replace function public.system_initialized()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.system_initialized() to anon, authenticated;

create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_any_role(auth.uid(), array['admin','gestor','rh','supervisor']::public.app_role[]));
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]));

-- prevent users from changing their own status via own update
create or replace function public.protect_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.has_role(auth.uid(),'admin') and auth.uid() is not null then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_status();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_admin boolean;
begin
  first_admin := not exists (select 1 from public.user_roles where role = 'admin');
  insert into public.profiles (id, nome, email, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), coalesce(new.email,''),
          case when first_admin then 'ativo'::public.account_status
               when coalesce(new.raw_app_meta_data->>'created_by_admin','') = 'true' then 'ativo'::public.account_status
               else 'inativo'::public.account_status end);
  if first_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.funcoes to authenticated;
grant all on public.funcoes to service_role;
alter table public.funcoes enable row level security;
create policy "funcoes read" on public.funcoes for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor','rh','supervisor','colaborador']::public.app_role[]));
create policy "funcoes write" on public.funcoes for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]));

create table public.postos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente text,
  tipo text,
  endereco text,
  cidade text,
  efetivo_previsto integer not null default 0,
  supervisor_id uuid,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.postos to authenticated;
grant all on public.postos to service_role;
alter table public.postos enable row level security;
create policy "postos read" on public.postos for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]) or supervisor_id = auth.uid());
create policy "postos write" on public.postos for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor']::public.app_role[]));

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  matricula text not null unique,
  nome text not null,
  cpf text unique,
  telefone text,
  email text,
  endereco text,
  funcao_id uuid references public.funcoes(id) on delete set null,
  posto_id uuid references public.postos(id) on delete set null,
  supervisor_id uuid,
  data_admissao date,
  vinculo text,
  jornada text,
  situacao public.colab_situacao not null default 'ativo',
  observacoes text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.colaboradores(posto_id);
grant select, insert, update, delete on public.colaboradores to authenticated;
grant all on public.colaboradores to service_role;
alter table public.colaboradores enable row level security;
create policy "colab read" on public.colaboradores for select to authenticated using (
  public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[])
  or (public.has_role(auth.uid(),'supervisor') and (supervisor_id = auth.uid() or exists (select 1 from public.postos p where p.id = posto_id and p.supervisor_id = auth.uid())))
  or (user_id = auth.uid() and public.has_role(auth.uid(),'colaborador'))
);
create policy "colab write" on public.colaboradores for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gestor','rh']::public.app_role[]));

create table public.colaborador_historico (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  dados jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.colaborador_historico to authenticated;
grant all on public.colaborador_historico to service_role;
alter table public.colaborador_historico enable row level security;
create policy "hist read" on public.colaborador_historico for select to authenticated using (
  exists (select 1 from public.colaboradores c where c.id = colaborador_id)
);

create or replace function public.track_colaborador()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_posto text; new_posto text; changes jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'INSERT' then
    insert into public.colaborador_historico(colaborador_id,tipo,descricao,user_id)
      values (new.id,'cadastro','Colaborador cadastrado',auth.uid());
    return new;
  end if;
  new.updated_at := now();
  if new.posto_id is distinct from old.posto_id then
    select nome into old_posto from public.postos where id = old.posto_id;
    select nome into new_posto from public.postos where id = new.posto_id;
    insert into public.colaborador_historico(colaborador_id,tipo,descricao,dados,user_id)
      values (new.id,'transferencia','Transferido de ' || coalesce(old_posto,'(sem posto)') || ' para ' || coalesce(new_posto,'(sem posto)'),
        jsonb_build_object('de',old.posto_id,'para',new.posto_id),auth.uid());
  end if;
  for k in select key from jsonb_each(to_jsonb(new)) loop
    if k not in ('updated_at','posto_id') and (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k) then
      changes := changes || jsonb_build_object(k, jsonb_build_object('de', to_jsonb(old)->k, 'para', to_jsonb(new)->k));
    end if;
  end loop;
  if changes <> '{}'::jsonb then
    insert into public.colaborador_historico(colaborador_id,tipo,descricao,dados,user_id)
      values (new.id,'alteracao','Alteração cadastral: ' || (select string_agg(key, ', ') from jsonb_object_keys(changes) key),changes,auth.uid());
  end if;
  return new;
end $$;
create trigger trg_colab_ins after insert on public.colaboradores for each row execute function public.track_colaborador();
create trigger trg_colab_upd before update on public.colaboradores for each row execute function public.track_colaborador();

create table public.audit_log (
  id bigserial primary key,
  user_id uuid,
  tabela text not null,
  acao text not null,
  registro_id text,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit admin read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(user_id,tabela,acao,registro_id,antes,depois)
  values (auth.uid(), tg_table_name, tg_op,
    coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_trigger();
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_funcoes after insert or update or delete on public.funcoes for each row execute function public.audit_trigger();
create trigger audit_postos after insert or update or delete on public.postos for each row execute function public.audit_trigger();
create trigger audit_colab after insert or update or delete on public.colaboradores for each row execute function public.audit_trigger();

insert into public.funcoes (nome, descricao) values
 ('Vigilante','Vigilância patrimonial'),
 ('Bombeiro Civil','Brigada de incêndio'),
 ('Supervisor Operacional','Supervisão de postos'),
 ('Controlador de Acesso','Portaria e controle de acesso'),
 ('Auxiliar de Serviços','Serviços de apoio');
