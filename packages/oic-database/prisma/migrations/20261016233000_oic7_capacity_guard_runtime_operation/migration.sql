DO $$
DECLARE
  function_definition text;
  search_text text := 'NEW."operation" <> ''text.generate''';
  replacement_text text := 'NEW."operation" <> ''native.invoke.v1''';
  occurrence_count integer;
BEGIN
  SELECT pg_get_functiondef('oic_7_guard_capacity_admission()'::regprocedure)
  INTO function_definition;

  IF function_definition IS NULL
    OR position('OIC-7 supplemental capacity extension unavailable' IN function_definition) = 0 THEN
    RAISE EXCEPTION 'OIC-7 capacity admission guard definition is not the expected version';
  END IF;

  occurrence_count := (length(function_definition) - length(replace(function_definition, search_text, ''))) / length(search_text);
  IF occurrence_count <> 1 THEN
    RAISE EXCEPTION 'OIC-7 capacity admission operation predicate count was unexpected';
  END IF;

  function_definition := replace(function_definition, search_text, replacement_text);
  EXECUTE function_definition;
END $$;
