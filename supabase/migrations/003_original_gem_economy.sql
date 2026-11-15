-- GEMS economy catalog: exact values supplied and confirmed by the owner.
-- Additive migration for the ORIGINAL database (player_gemstones + mining_sessions).
-- Do not run 001_gems_schema.sql on this database.

begin;

alter table public.gemstones
  add column if not exists earning_units_per_minute jsonb not null default '[]'::jsonb,
  add column if not exists units_per_gems numeric(20,8),
  add column if not exists level_up_cost_units jsonb not null default '[]'::jsonb,
  add column if not exists unlock_cost_units numeric(20,4) not null default 0,
  add column if not exists requires_gemstone_id uuid references public.gemstones(id);

alter table public.player_gemstones
  add column if not exists gemstone_units_balance numeric(24,8) not null default 0;

-- Preserve the current Garnet record and add the other nine catalog entries if missing.
insert into public.gemstones (code, name, description, unlock_cost_gems, mining_reward_per_hour, is_available)
select v.code, v.name, v.description, 0, 0, true
from (values
  ('MOONSTONE','Moonstone','Moonstone mining gemstone'),
  ('BLACK_OPAL','Black Opal','Black Opal mining gemstone'),
  ('AQUAMARINE','Aquamarine','Aquamarine mining gemstone'),
  ('TOPAZ','Topaz','Topaz mining gemstone'),
  ('AMETHYST','Amethyst','Amethyst mining gemstone'),
  ('EMERALD','Emerald','Emerald mining gemstone'),
  ('SAPPHIRE','Sapphire','Sapphire mining gemstone'),
  ('RUBY','Ruby','Ruby mining gemstone'),
  ('DIAMOND','Diamond','Diamond mining gemstone')
) as v(code,name,description)
where not exists (
  select 1 from public.gemstones g where upper(g.code) = v.code or lower(g.name) = lower(v.name)
);

-- Exact per-level earning values (gemstone units per minute), level-up unit costs,
-- and conversion quantities (gemstone units required for 1 GEMS).
update public.gemstones g set
  earning_units_per_minute = v.earning::jsonb,
  level_up_cost_units = v.level_cost::jsonb,
  units_per_gems = v.conversion::numeric,
  unlock_cost_units = v.unlock_cost::numeric,
  requires_gemstone_id = (select p.id from public.gemstones p where upper(p.code) = v.requires_code limit 1),
  is_available = true
from (values
 ('GARNET','[10,11,13,17,24,36,58,98,176,335]','[150,165,198,257,360,541,865,1470,2646,5028]',2880,0,null),
 ('MOONSTONE','[9,10,12,15,22,32,52,88,159,302]','[135,149,178,232,324,486,778,1323,2382,4525]',1296,194400,'GARNET'),
 ('BLACK_OPAL','[8,9,11,14,19,29,46,78,141,268]','[120,132,158,206,288,432,692,1176,2117,4023]',384,230400,'MOONSTONE'),
 ('AQUAMARINE','[7,8,9,12,17,25,40,69,124,235]','[105,116,139,180,252,378,605,1029,1853,3520]',201.6,302400,'BLACK_OPAL'),
 ('TOPAZ','[6,7,8,10,14,22,35,59,106,201]','[90,99,119,154,216,324,519,882,1588,3017]',100.8,302400,'AQUAMARINE'),
 ('AMETHYST','[5,6,7,9,12,18,29,49,88,168]','[75,83,99,129,180,270,432,735,1323,2514]',36,216000,'TOPAZ'),
 ('EMERALD','[4,4,5,7,10,14,23,39,71,134]','[60,66,79,103,144,216,346,588,1059,2011]',11.52,172800,'AMETHYST'),
 ('SAPPHIRE','[3,3,4,5,7,11,17,29,53,101]','[45,50,59,77,108,162,259,441,794,1508]',8.64,151200,'EMERALD'),
 ('RUBY','[2,2,3,3,5,7,12,20,35,67]','[30,33,40,51,72,108,173,294,529,1006]',5.76,115200,'SAPPHIRE'),
 ('DIAMOND','[1,1,1,2,2,4,6,10,18,34]','[15,17,20,26,36,54,86,147,265,503]',2.88,86400,'RUBY')
) as v(code,earning,level_cost,conversion,unlock_cost,requires_code)
where upper(g.code) = v.code;

-- Keep the original free starter Garnet assignment and all existing player balances.
commit;

-- Verification query:
-- select code,name,earning_units_per_minute,level_up_cost_units,units_per_gems,unlock_cost_units
-- from public.gemstones order by case code
--   when 'GARNET' then 1 when 'MOONSTONE' then 2 when 'BLACK_OPAL' then 3
--   when 'AQUAMARINE' then 4 when 'TOPAZ' then 5 when 'AMETHYST' then 6
--   when 'EMERALD' then 7 when 'SAPPHIRE' then 8 when 'RUBY' then 9 else 10 end;
