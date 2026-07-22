-- ─────────────────────────────────────────────────────────────────────────────
-- Matchmaking avanzado — segunda ola de campos.
--
-- Doc de investigación "Cómo hacer que Mergie prediga, puntúe y verifique
-- matches de co-founders" (jul 2026), Bloque 1: 5 campos imprescindibles
-- (máxima señal predictiva, baja fricción) + 3 opcionales, más la ponderación
-- declarada por el usuario para el scoring explicable del Bloque 2.
--
-- Todo nullable: los perfiles existentes siguen siendo válidos y la completitud
-- se recalcula sola en la interfaz.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── imprescindibles ──────────────────────────────────────────────────────────

-- Escala y salida esperada. La desalineación de visión es la fisura más
-- predecible entre co-founders (First Round, HBR).
alter table public.match_profiles
  add column if not exists exit_ideal text
  check (exit_ideal is null or exit_ideal in
    ('no_vender', 'salida_rapida', 'construir_y_vender', 'ipo'));

-- Compromiso proyectado a 6 meses (misma escala que `horas`) + runway personal.
-- La desalineación aquí predice abandono temprano.
alter table public.match_profiles
  add column if not exists horas_6m text
  check (horas_6m is null or horas_6m in ('lt5', '5_15', '15_30', 'full'));

alter table public.match_profiles
  add column if not exists runway_meses text
  check (runway_meses is null or runway_meses in ('0', 'lt3', '3_6', '6_12', 'gt12'));

-- Conflicto situacional: lo que predice durabilidad no es discutir poco, sino
-- saber reparar (Gottman). Texto libre, se analiza en el motor.
alter table public.match_profiles
  add column if not exists conflicto_reparacion text;

-- Áreas de responsabilidad (AoR de First Round): { area: { nivel: 1-10, pasion: bool } }.
-- Da complementariedad medida por cobertura real, no por etiquetas.
alter table public.match_profiles
  add column if not exists areas jsonb not null default '{}'::jsonb;

-- Filosofía de equity y control vs. wealth: la tensión más alta y peor
-- gestionada (Hellmann & Wasserman 2016 — el 73% reparte en el primer mes).
alter table public.match_profiles
  add column if not exists equity_split text
  check (equity_split is null or equity_split in
    ('igual_siempre', 'segun_aporte', 'fundador_mayoria', 'no_lo_he_pensado'));

alter table public.match_profiles
  add column if not exists king_o_rich smallint
  check (king_o_rich is null or king_o_rich between 1 and 4);

-- ── opcionales (desbloqueables tras el onboarding) ───────────────────────────

-- Mini Big Five agregado a 5 escalas 1-5. SEÑAL, nunca criterio único de
-- selección: la propia literatura psicométrica lo advierte explícitamente.
alter table public.match_profiles
  add column if not exists big_five jsonb not null default '{}'::jsonb;

alter table public.match_profiles
  add column if not exists colaboracion_previa text
  check (colaboracion_previa is null or colaboracion_previa in ('nunca', 'bien', 'mal', 'mixto'));

alter table public.match_profiles
  add column if not exists colaboracion_detalle text;

alter table public.match_profiles
  add column if not exists cultura_ideal text;

-- ── ponderación declarada por el usuario (estilo OkCupid) ────────────────────
-- Máx. 2 categorías de la rúbrica marcadas como "muy importante para mí".
alter table public.match_profiles
  add column if not exists pesos_usuario text[] not null default '{}';

alter table public.match_profiles
  drop constraint if exists match_profiles_pesos_usuario_check;
alter table public.match_profiles
  add constraint match_profiles_pesos_usuario_check check (
    array_length(pesos_usuario, 1) is null
    or (
      array_length(pesos_usuario, 1) <= 2
      and pesos_usuario <@ array[
        'vision_valores', 'complementariedad', 'compromiso',
        'riesgo_conflicto', 'personalidad'
      ]::text[]
    )
  );

-- Límites de longitud para el texto libre (coinciden con los maxLength de la UI).
alter table public.match_profiles
  drop constraint if exists match_profiles_texto_libre_check;
alter table public.match_profiles
  add constraint match_profiles_texto_libre_check check (
    length(coalesce(conflicto_reparacion, '')) <= 400
    and length(coalesce(colaboracion_detalle, '')) <= 300
    and length(coalesce(cultura_ideal, '')) <= 200
  );
