-- API Stats Table for tracking API usage metrics
-- This table stores statistics for the Classcastle Developer API

CREATE TABLE IF NOT EXISTS api_stats (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  hits INTEGER DEFAULT 0,
  failures INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on endpoint for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_stats_endpoint ON api_stats(endpoint);

-- Insert initial records for all endpoints
INSERT INTO api_stats (endpoint, hits, failures) VALUES
  ('createroom', 0, 0),
  ('rooms', 0, 0),
  ('roomdetails', 0, 0),
  ('navigate', 0, 0),
  ('activity', 0, 0),
  ('students', 0, 0),
  ('deleteroom', 0, 0)
ON CONFLICT DO NOTHING;

-- Failures by reason table
CREATE TABLE IF NOT EXISTS api_failures (
  id BIGSERIAL PRIMARY KEY,
  reason TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_failures_reason ON api_failures(reason);

-- Global stats table (for uptime and totals)
CREATE TABLE IF NOT EXISTS api_global_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial global stats record
INSERT INTO api_global_stats (id, start_time, total_requests, successful_requests, failed_requests)
VALUES (1, NOW(), 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security policies
ALTER TABLE api_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_global_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public stats endpoint)
CREATE POLICY "Allow public read access to api_stats"
  ON api_stats FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to api_failures"
  ON api_failures FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to api_global_stats"
  ON api_global_stats FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role to update stats (for API functions)
CREATE POLICY "Allow service role to update api_stats"
  ON api_stats FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Allow service role to update api_failures"
  ON api_failures FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Allow service role to update api_global_stats"
  ON api_global_stats FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Allow service role to insert api_failures"
  ON api_failures FOR INSERT
  TO service_role
  WITH CHECK (true);
