-- ============================================================================
-- Performance — 2026-08-10 : auth.uid() ré-évalué à chaque ligne (45 policies)
--
-- Écrit `auth.uid()` nu, Postgres le ré-évalue POUR CHAQUE LIGNE examinée.
-- Enveloppé dans `(select auth.uid())`, il devient un InitPlan évalué UNE fois
-- par requête. Sémantiquement identique (la fonction est STABLE), mais le coût
-- passe de O(lignes) à O(1) sur chaque lecture soumise à RLS — c'est-à-dire
-- sur la totalité des lectures de l'application.
--
-- Les policies sont réécrites à partir de leur définition réelle en base
-- (pg_policies), pas retranscrites à la main : aucune divergence possible.
--
-- Vérifié après application : 45 policies réécrites, 0 restante, 71 policies au
-- total (inchangé), et lecture réelle avec un compte `administrateur` — les
-- notifications restent filtrées à 10 lignes sur 46 en base, donc le
-- cloisonnement par utilisateur est bien préservé.
-- ============================================================================
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
  v_n int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
      and coalesce(qual, '') !~ '\( SELECT auth\.uid\(\)'
      and coalesce(with_check, '') !~ '\( SELECT auth\.uid\(\)'
  loop
    v_using := regexp_replace(r.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    v_check := regexp_replace(r.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');

    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    -- Une policy INSERT n'a pas de USING, une policy DELETE pas de WITH CHECK :
    -- on ne rajoute que la clause réellement présente à l'origine.
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
    v_n := v_n + 1;
  end loop;
  raise notice 'Policies réécrites : %', v_n;
end $$;
