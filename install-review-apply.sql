BEGIN;
CREATE OR REPLACE FUNCTION public.ip_dashboard_apply_review(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  entry jsonb;
  existing jsonb;
  changes jsonb;
  n integer := 0;
  changed integer := 0;
  key_name text;
  backup_name text;
  stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  allowed_keys text[] := ARRAY['originalType','genre','logline','premise','mainCharacters','strengths','risks','targetAudience','productionDifficulty','castingDirection','comparables','recommendation','rightsStatus','rightsInfo','reactionMetrics','formatSuggestion','scores','scoreRationales','characterAnalysis','adaptableElements','sourceInfo','recommendationReason','notes'];
BEGIN
  IF public.ip_dashboard_can_write() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Only the dashboard owner may apply a review' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'array' OR jsonb_array_length(payload) <> 211 THEN
    RAISE EXCEPTION 'Expected the complete 211-work review';
  END IF;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(payload)) <> 211 THEN
    RAISE EXCEPTION 'Review IDs must be distinct';
  END IF;
  LOCK TABLE public.kdrama_ips IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT count(*) FROM public.kdrama_ips) <> 211 THEN
    RAISE EXCEPTION 'The work list has changed; refresh the review before applying';
  END IF;
  -- Check every item before creating a backup or changing any analysis.
  FOR entry IN SELECT value FROM jsonb_array_elements(payload) LOOP
    SELECT content INTO existing FROM public.kdrama_ips WHERE id = entry->>'id';
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown work ID: %', entry->>'id'; END IF;
    IF jsonb_typeof(entry->'expected') IS DISTINCT FROM 'object'
       OR jsonb_typeof(entry->'patch') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Expected and patch must be objects';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(entry->'expected')) = 0 THEN
      RAISE EXCEPTION 'Missing concurrency checks';
    END IF;
    FOR key_name IN SELECT jsonb_object_keys(entry->'patch') LOOP
      IF NOT key_name = ANY(allowed_keys) THEN
        RAISE EXCEPTION 'Protected or unknown field: %', key_name;
      END IF;
      IF NOT (entry->'expected' ? key_name) THEN
        RAISE EXCEPTION 'Missing expected value for field: %', key_name;
      END IF;
    END LOOP;
    FOR key_name IN SELECT jsonb_object_keys(entry->'expected') LOOP
      IF NOT key_name = ANY(allowed_keys) THEN RAISE EXCEPTION 'Invalid expected field'; END IF;
      IF coalesce(existing->key_name, 'null'::jsonb) IS DISTINCT FROM entry->'expected'->key_name THEN
        RAISE EXCEPTION 'Analysis changed since review: % (%)', entry->>'id', key_name;
      END IF;
    END LOOP;
    changes := existing || (entry->'patch');
    IF coalesce(changes->>'recommendation','') NOT IN ('추천','보류','리서치 필요')
       OR coalesce(changes->>'rightsStatus','') NOT IN ('열림','확인 필요','선점','영상화 완료') THEN
      RAISE EXCEPTION 'Invalid recommendation or rights status';
    END IF;
    IF jsonb_typeof(changes->'scores') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Missing scores'; END IF;
    FOREACH key_name IN ARRAY ARRAY['dramaFit','marketPotential','originality','scalability','characterAppeal','productionFeasibility','globalPotential'] LOOP
      IF jsonb_typeof(changes->'scores'->key_name) IS DISTINCT FROM 'number'
         OR (changes->'scores'->>key_name)::numeric NOT BETWEEN 0 AND 10 THEN
        RAISE EXCEPTION 'Invalid score: %', key_name;
      END IF;
    END LOOP;
    n := n + 1;
  END LOOP;
  backup_name := 'kdrama_ips_backup_' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD_HH24MISS_US') || '_review';
  EXECUTE format('CREATE TABLE public.%I AS TABLE public.kdrama_ips', backup_name);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', backup_name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', backup_name);
  IF has_table_privilege('anon', format('public.%I', backup_name), 'SELECT')
     OR has_table_privilege('authenticated', format('public.%I', backup_name), 'SELECT') THEN
    RAISE EXCEPTION 'Backup access is inherited; aborting safely';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(payload) LOOP
    IF entry->'patch' <> '{}'::jsonb THEN
      UPDATE public.kdrama_ips
      SET content = content || (entry->'patch') || jsonb_build_object('updatedAt',stamp),
          "updatedAt" = stamp
      WHERE id = entry->>'id';
      changed := changed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reviewed',n,'updated',changed,'backup',backup_name,'updatedAt',stamp);
END;
$function$;
REVOKE ALL ON FUNCTION public.ip_dashboard_apply_review(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ip_dashboard_apply_review(jsonb) TO authenticated;
COMMIT;
