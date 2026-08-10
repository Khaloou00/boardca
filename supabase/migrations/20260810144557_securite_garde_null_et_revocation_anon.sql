-- ============================================================================
-- Durcissement de sécurité — 2026-08-10
-- ============================================================================

-- 1. `soumettre_rapport_action` : la garde comparait `responsable_id <> auth.uid()`
--    sans tester le cas NULL. Pour un appelant ANONYME, auth.uid() vaut NULL,
--    la comparaison vaut NULL, et plpgsql traite NULL comme faux : l'exception
--    n'était donc JAMAIS levée. Seul le NOT NULL sur action_rapports.auteur_id
--    faisait échouer l'insertion ensuite — un garde-fou accidentel, pas voulu.
--    Règle générale : toute garde comparée à auth.uid() doit tester `is null`.
create or replace function public.soumettre_rapport_action(
  p_action_id uuid,
  p_texte text,
  p_avancement integer,
  p_fichier_path text default null,
  p_fichier_nom text default null,
  p_fichier_type text default null,
  p_fichier_taille bigint default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_action public.actions;
  v_uid uuid := auth.uid();
  v_rapport_id uuid;
  v_statut text;
  v_auteur text;
  v_membre record;
begin
  -- Correctif 2026-08-10 : refuser explicitement l'appelant non authentifié.
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_action from public.actions where id = p_action_id;
  if v_action.id is null then raise exception 'Action introuvable'; end if;
  if v_action.responsable_id is distinct from v_uid then
    raise exception 'Seul le responsable de l''action peut soumettre un rapport';
  end if;
  if v_action.statut = 'terminee' then
    raise exception 'Cette action est déjà clôturée';
  end if;
  if p_texte is null or char_length(btrim(p_texte)) = 0 then
    raise exception 'Le rapport doit contenir un texte';
  end if;
  if p_avancement < 0 or p_avancement > 100 then
    raise exception 'Avancement invalide';
  end if;

  insert into public.action_rapports(action_id, auteur_id, texte, avancement,
    fichier_path, fichier_nom, fichier_type, fichier_taille)
  values (p_action_id, v_uid, btrim(p_texte), p_avancement,
    p_fichier_path, p_fichier_nom, p_fichier_type, p_fichier_taille)
  returning id into v_rapport_id;

  v_statut := case when p_avancement >= 100 then 'a_valider' else 'en_cours' end;
  update public.actions set avancement = p_avancement, statut = v_statut where id = p_action_id;

  select nom into v_auteur from public.profiles where id = v_uid;
  for v_membre in
    select id from public.profiles
    where role in ('secretaire','administrateur','super_admin') and id <> v_uid
  loop
    perform private.push_notification(
      v_membre.id, 'action',
      case when p_avancement >= 100
        then 'Action à confirmer : ' || v_action.titre
        else 'Rapport d''avancement : ' || v_action.titre end,
      coalesce(v_auteur, 'Le responsable') || ' — avancement ' || p_avancement || ' %',
      'action', p_action_id
    );
  end loop;

  return v_rapport_id;
end $function$;

-- 2. Retirer de l'API anonyme les fonctions SECURITY DEFINER qui n'ont aucune
--    raison d'y figurer. Elles refusaient déjà un appelant anonyme via leur
--    garde interne (`is_secretaire() or is_super_admin()`), mais les exposer
--    sur /rest/v1/rpc/* est une surface d'attaque gratuite.
--
--    NON TOUCHÉES VOLONTAIREMENT :
--      - current_pca_email() : appelée par la page /auth alors que l'utilisateur
--        est encore anonyme (carte « PCA »). À traiter avec la refonte de
--        l'écran de connexion, pas ici — la révoquer casserait la connexion.
--      - is_ca_member() / is_pca() / is_secretaire() : référencées par les
--        policies RLS ; révoquer l'EXECUTE transformerait un résultat vide en
--        erreur Postgres pour certaines requêtes.
do $$
declare
  f text;
  fonctions text[] := array[
    'public.confirmer_cloture_action(uuid)',
    'public.renvoyer_action(uuid, text)',
    'public.renvoyer_pv(uuid)',
    'public.reporter_seance(uuid, date, time without time zone, text, text)',
    'public.soumettre_rapport_action(uuid, text, integer, text, text, text, bigint)',
    'public.valider_paiement_jetons(uuid, uuid[])'
  ];
begin
  foreach f in array fonctions loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- 3. Fonctions de TRIGGER : jamais destinées à être appelées en RPC. Appelées
--    hors contexte de trigger elles échouent, mais elles n'ont rien à faire
--    dans l'API REST publique.
revoke all on function public.notify_presence() from public, anon, authenticated;
revoke all on function public.notify_pv_observation() from public, anon, authenticated;
revoke all on function public.notify_vote_clos() from public, anon, authenticated;
