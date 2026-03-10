-- Expose the retention schema via PostgREST so .schema("retention") queries work
-- from the Supabase JS client (both anon and service_role keys).
-- Without this, PostgREST returns: "Invalid schema: retention"

-- Grant usage on the retention schema to the API roles
GRANT USAGE ON SCHEMA retention TO anon, authenticated, service_role;

-- Grant read/write on all tables in retention schema
GRANT ALL ON ALL TABLES IN SCHEMA retention TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA retention TO anon, authenticated;

-- Grant on sequences (for BIGSERIAL columns)
GRANT ALL ON ALL SEQUENCES IN SCHEMA retention TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA retention TO anon, authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA retention
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA retention
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA retention
  GRANT ALL ON SEQUENCES TO service_role;

-- Expose the retention schema in PostgREST config
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, retention';

-- Reload PostgREST config
NOTIFY pgrst, 'reload config';
