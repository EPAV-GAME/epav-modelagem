CREATE SCHEMA IF NOT EXISTS epav_migration;
REVOKE ALL ON SCHEMA epav_migration FROM PUBLIC;

CREATE TABLE IF NOT EXISTS epav_migration.snapshots (
    id uuid PRIMARY KEY,
    source_database text NOT NULL,
    source_read_time timestamptz NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now(),
    document_count bigint NOT NULL CHECK (document_count >= 0),
    UNIQUE (source_database, source_read_time)
);

CREATE TABLE IF NOT EXISTS epav_migration.documents (
    snapshot_id uuid NOT NULL REFERENCES epav_migration.snapshots(id) ON DELETE CASCADE,
    path text NOT NULL,
    collection_path text NOT NULL,
    document_id text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    firestore_fields jsonb NOT NULL CHECK (jsonb_typeof(firestore_fields) = 'object'),
    CHECK (path = collection_path || '/' || document_id),
    PRIMARY KEY (snapshot_id, path)
);

CREATE INDEX IF NOT EXISTS epav_migration_documents_collection_idx
    ON epav_migration.documents (snapshot_id, collection_path, document_id);

CREATE OR REPLACE VIEW epav_migration.current_documents AS
SELECT d.*
FROM epav_migration.documents AS d
JOIN (
    SELECT DISTINCT ON (source_database) id
    FROM epav_migration.snapshots
    ORDER BY source_database, source_read_time DESC
) AS latest ON latest.id = d.snapshot_id;

REVOKE ALL ON ALL TABLES IN SCHEMA epav_migration FROM PUBLIC;
