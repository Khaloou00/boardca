-- Ajoute l'envoi d'un email de convocation, en plus du push déjà en place.
-- Même trigger AFTER INSERT ON convocations (jamais sur un renvoi/UPDATE),
-- même mécanique d'appel non bloquant via pg_net que private.push_vers_appareils().
CREATE OR REPLACE FUNCTION public.notify_convocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_titre text; v_date date; v_bb_exists boolean; v_secret text;
begin
  select titre, date_reunion into v_titre, v_date from reunions where id = new.reunion_id;
  select exists(select 1 from board_books where reunion_id = new.reunion_id) into v_bb_exists;

  perform private.push_notification(
    new.user_id,
    'convocation',
    case when v_bb_exists then 'Convocation et Board Book disponibles' else 'Nouvelle convocation' end,
    coalesce(v_titre,'Séance') || ' — ' || to_char(v_date, 'DD/MM/YYYY'),
    'reunion',
    new.reunion_id
  );

  select value into v_secret from public.app_secrets where key = 'push_hook_secret';
  if v_secret is not null then
    begin
      perform net.http_post(
        url     := 'https://yxprzegttqhussmmaggr.supabase.co/functions/v1/convocation-notify',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-push-secret', v_secret
                   ),
        body    := jsonb_build_object(
                     'userId', new.user_id,
                     'reunionId', new.reunion_id
                   ),
        timeout_milliseconds := 5000
      );
    exception when others then
      -- Volontairement non bloquant : un email de convocation non parti est
      -- un désagrément, une convocation qu'on ne peut pas enregistrer est une panne.
      raise warning 'email de convocation non envoyé pour % : %', new.id, sqlerrm;
    end;
  end if;

  return new;
end $function$;
