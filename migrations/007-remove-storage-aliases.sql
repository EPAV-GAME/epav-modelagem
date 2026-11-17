-- Apply only after publishing the API that queries epav_internal directly.
-- RESTRICT deliberately prevents removal if another database object still uses them.
DROP VIEW IF EXISTS epav_data.record_fields;
DROP VIEW IF EXISTS epav_data.records;
