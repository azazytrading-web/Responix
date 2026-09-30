CREATE FUNCTION "oic_audit_event_immutable"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'OIC audit events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "OicAuditEvent_no_update_delete"
BEFORE UPDATE OR DELETE ON "OicAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "oic_audit_event_immutable"();

CREATE TRIGGER "OicAuditEvent_no_truncate"
BEFORE TRUNCATE ON "OicAuditEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "oic_audit_event_immutable"();