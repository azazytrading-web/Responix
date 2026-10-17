-- Dynamic EXECUTE does not update PL/pgSQL FOUND. The parent application's
-- non-null UUID itself proves that a row was found; compare it directly.
CREATE OR REPLACE FUNCTION oic_evaluation_assert_parent_scope() RETURNS trigger AS $$
DECLARE
  parent_id UUID;
  parent_application UUID;
  parent_tenant UUID;
BEGIN
  parent_id := NULLIF(to_jsonb(NEW)->>TG_ARGV[1], '')::uuid;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT "applicationId", "tenantId" FROM %I WHERE "id" = $1', TG_ARGV[0])
    INTO parent_application, parent_tenant USING parent_id;
  IF parent_application IS DISTINCT FROM NEW."applicationId" OR parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'OIC evaluation scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
