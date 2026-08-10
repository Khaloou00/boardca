-- ============================================================================
-- Performance — 2026-08-10 : index de couverture des clés étrangères
--
-- Postgres n'indexe PAS automatiquement le côté « enfant » d'une clé étrangère.
-- Sans index, toute jointure sur cette colonne, et surtout toute suppression
-- de la ligne parente, provoquent un balayage séquentiel de la table enfant.
-- Invisible sur 2 réunions et 10 profils ; très visible sur trois ans
-- d'archives et une séance à 15 connectés.
--
-- Non traitées volontairement : `demandes_invite` et `resolutions`, tables
-- mortes (plus lues par aucun code) destinées à être supprimées.
-- ============================================================================

create index if not exists idx_action_commentaires_action_id on public.action_commentaires (action_id);
create index if not exists idx_action_commentaires_auteur_id on public.action_commentaires (auteur_id);
create index if not exists idx_action_rapports_auteur_id on public.action_rapports (auteur_id);
create index if not exists idx_actions_assigne_par on public.actions (assigne_par);
create index if not exists idx_actions_responsable_id on public.actions (responsable_id);
create index if not exists idx_actions_reunion_id on public.actions (reunion_id);
create index if not exists idx_annotations_partage_avec_user_id on public.annotations (partage_avec_user_id);
create index if not exists idx_audit_log_user_id on public.audit_log (user_id);
create index if not exists idx_baremes_jetons_updated_by on public.baremes_jetons (updated_by);
create index if not exists idx_board_books_genere_par on public.board_books (genere_par);
create index if not exists idx_bulletins_user_id on public.bulletins (user_id);
create index if not exists idx_comite_membres_user_id on public.comite_membres (user_id);
create index if not exists idx_comites_president_id on public.comites (president_id);
create index if not exists idx_consultation_reponses_user_id on public.consultation_reponses (user_id);
create index if not exists idx_consultations_ouverte_par on public.consultations (ouverte_par);
create index if not exists idx_convocations_user_id on public.convocations (user_id);
create index if not exists idx_discussion_messages_auteur_id on public.discussion_messages (auteur_id);
create index if not exists idx_discussion_messages_epingle_par on public.discussion_messages (epingle_par);
create index if not exists idx_discussions_created_by on public.discussions (created_by);
create index if not exists idx_documents_point_oj_id on public.documents (point_oj_id);
create index if not exists idx_documents_reunion_id on public.documents (reunion_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_jetons_presence_paye_par on public.jetons_presence (paye_par);
create index if not exists idx_ordre_du_jour_reunion_id on public.ordre_du_jour (reunion_id);
create index if not exists idx_presences_user_id on public.presences (user_id);
create index if not exists idx_procurations_de_user_id on public.procurations (de_user_id);
create index if not exists idx_procurations_vers_user_id on public.procurations (vers_user_id);
create index if not exists idx_pv_observations_user_id on public.pv_observations (user_id);
create index if not exists idx_reports_seance_reporte_par on public.reports_seance (reporte_par);
create index if not exists idx_reunions_comite_id on public.reunions (comite_id);
create index if not exists idx_reunions_created_by on public.reunions (created_by);
create index if not exists idx_reunions_president_seance_id on public.reunions (president_seance_id);
create index if not exists idx_signalements_action_id on public.signalements (action_id);
create index if not exists idx_signalements_auteur_id on public.signalements (auteur_id);
create index if not exists idx_signatures_user_id on public.signatures (user_id);
create index if not exists idx_votes_reunion_id on public.votes (reunion_id);

-- Index morts confirmés par les advisors (jamais utilisés, sur tables mortes).
drop index if exists public.consultations_statut_idx;
drop index if exists public.demandes_invite_statut_idx;
