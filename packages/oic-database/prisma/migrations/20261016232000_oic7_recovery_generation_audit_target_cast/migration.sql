DO $$
DECLARE
  function_definition text;
  search_text text := 'event."targetId" = NEW."id"';
  replacement_text text := 'event."targetId" = NEW."id"::text';
  occurrence_count integer;
BEGIN
  SELECT pg_get_functiondef('oic_7_guard_recovery_generation()'::regprocedure)
  INTO function_definition;

  IF function_definition IS NULL
    OR position('OIC7_PACKET76_EXECUTION_RECOVERY_GENERATION_V3' IN function_definition) = 0
    OR position('NOT BETWEEN 1 AND 3' IN function_definition) = 0 THEN
    RAISE EXCEPTION 'OIC-7 third recovery generation guard definition is not the expected version';
  END IF;

  occurrence_count := (length(function_definition) - length(replace(function_definition, search_text, ''))) / length(search_text);
  IF occurrence_count <> 2 THEN
    RAISE EXCEPTION 'OIC-7 recovery generation audit target identity cast count was unexpected';
  END IF;

  function_definition := replace(function_definition, search_text, replacement_text);
  EXECUTE function_definition;
END $$;
