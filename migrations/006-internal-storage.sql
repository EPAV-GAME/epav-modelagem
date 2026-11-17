-- Preserve a Neon branch before applying to production.
-- Move live support data; remove only the retired import copies, without CASCADE.
CREATE SCHEMA epav_internal;
ALTER TABLE epav_data.records SET SCHEMA epav_internal;
ALTER TABLE epav_data.record_fields SET SCHEMA epav_internal;
ALTER TYPE epav_migration.firestore_kind SET SCHEMA epav_internal;

-- PL/pgSQL bodies contain qualified SQL strings, so update them explicitly.
DO $$
DECLARE f record; definition varchar;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='epav_data' AND p.prokind='f'
  LOOP
    definition:=pg_get_functiondef(f.oid);
    definition:=replace(definition,'epav_data.record_fields','epav_internal.record_fields');
    definition:=replace(definition,'epav_data.records','epav_internal.records');
    definition:=replace(definition,'epav_migration.firestore_kind','epav_internal.firestore_kind');
    EXECUTE definition;
  END LOOP;
END $$;

-- Temporary compatibility for the API version still serving requests.
CREATE VIEW epav_data.records AS SELECT * FROM epav_internal.records;
CREATE VIEW epav_data.record_fields AS SELECT * FROM epav_internal.record_fields;

DROP VIEW epav_migration.current_documents;
DROP TABLE epav_migration.document_fields;
DROP TABLE epav_migration.documents;
DROP TABLE epav_migration.snapshots;
DROP SCHEMA epav_migration;

REVOKE ALL ON SCHEMA epav_internal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA epav_internal FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='epav_runtime_20261117') THEN
    GRANT USAGE ON SCHEMA epav_internal TO epav_runtime_20261117;
    GRANT USAGE ON TYPE epav_internal.firestore_kind TO epav_runtime_20261117;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA epav_internal TO epav_runtime_20261117;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA epav_internal TO epav_runtime_20261117;
    GRANT SELECT ON epav_data.records,epav_data.record_fields TO epav_runtime_20261117;
  END IF;
END $$;
