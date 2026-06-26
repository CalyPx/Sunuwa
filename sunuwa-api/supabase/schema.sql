-- ============================================================
-- SUNUWA (सुनुवाइ) — Supabase Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- Run in ORDER — do not skip any step
-- ============================================================

-- STEP 1: Enable pgvector (MUST be first)
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: Create tables

CREATE TABLE IF NOT EXISTS wards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ne TEXT NOT NULL,
  municipality TEXT,
  district TEXT,
  province TEXT,
  lat FLOAT,
  lng FLOAT
);

CREATE TABLE IF NOT EXISTS ministries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ne TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category_en TEXT,
  category_ne TEXT,
  severity INTEGER DEFAULT 5,
  summary_en TEXT,
  summary_ne TEXT,
  ward_id INTEGER REFERENCES wards(id),
  ministry_id INTEGER REFERENCES ministries(id),
  cluster_id INTEGER,
  escalation_level INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  tracking_code TEXT,
  followup_data JSONB,
  officer_notes TEXT[] DEFAULT '{}',
  referred_to TEXT,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clusters (
  id SERIAL PRIMARY KEY,
  category_en TEXT,
  category_ne TEXT,
  ward_id INTEGER REFERENCES wards(id),
  ministry_id INTEGER REFERENCES ministries(id),
  complaint_count INTEGER DEFAULT 0,
  avg_severity FLOAT DEFAULT 5,
  summary_en TEXT,
  summary_ne TEXT,
  escalation_level INTEGER DEFAULT 1,
  urgency_score FLOAT DEFAULT 0,
  days_unresolved INTEGER DEFAULT 0,
  is_in_news BOOLEAN DEFAULT FALSE,
  lat FLOAT,
  lng FLOAT,
  last_clustered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefs (
  id SERIAL PRIMARY KEY,
  ministry_id INTEGER REFERENCES ministries(id),
  content_ne TEXT,
  content_en TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_items (
  id SERIAL PRIMARY KEY,
  title TEXT,
  summary TEXT,
  url TEXT,
  source TEXT,
  category_en TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ward_official', 'minister', 'admin')),
  ward_id INTEGER REFERENCES wards(id),
  ministry_slug TEXT REFERENCES ministries(slug)
);

-- STEP 3: Create indexes
-- Use HNSW (works on any dataset size, unlike IVFFlat which needs 1000+ rows)
CREATE INDEX IF NOT EXISTS complaints_embedding_idx ON complaints USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS complaints_ward_idx ON complaints (ward_id);
CREATE INDEX IF NOT EXISTS complaints_category_idx ON complaints (category_en);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints (status);
CREATE INDEX IF NOT EXISTS complaints_created_idx ON complaints (created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_tracking_idx ON complaints (tracking_code);
CREATE INDEX IF NOT EXISTS clusters_ministry_idx ON clusters (ministry_id);
CREATE INDEX IF NOT EXISTS clusters_urgency_idx ON clusters (urgency_score DESC);
CREATE INDEX IF NOT EXISTS clusters_ward_idx ON clusters (ward_id);

-- STEP 4: Seed ministries (8 main ones)
INSERT INTO ministries (name, name_ne, slug) VALUES
  ('Ministry of Education and Sports', 'शिक्षा तथा खेलकुद मन्त्रालय', 'education'),
  ('Ministry of Infrastructure Development', 'भौतिक पूर्वाधार विकास मन्त्रालय', 'infrastructure'),
  ('Ministry of Health and Food Security', 'स्वास्थ्य तथा खाद्य सुरक्षा मन्त्रालय', 'health'),
  ('Ministry of Energy, Water Resources and Irrigation', 'ऊर्जा, जलस्रोत तथा सिंचाइ मन्त्रालय', 'energy-water'),
  ('Ministry of Home Affairs', 'गृह मन्त्रालय', 'home-affairs'),
  ('Ministry of Agriculture, Forests and Environment', 'कृषि, वन तथा वातावरण मन्त्रालय', 'environment'),
  ('Commission for the Investigation of Abuse of Authority (CIAA)', 'अख्तियार दुरूपयोग अनुसन्धान आयोग', 'ciaa'),
  ('Ministry of Women, Children and Social Security', 'महिला, बालबालिका तथा समाज कल्याण मन्त्रालय', 'women-social')
ON CONFLICT (slug) DO NOTHING;

-- STEP 5: Seed wards (10 wards across Nepal for MVP)
INSERT INTO wards (name, name_ne, municipality, district, province, lat, lng) VALUES
  ('Ward 1', 'वडा १', 'Kathmandu Metropolitan City', 'Kathmandu', 'Bagmati', 27.7172, 85.3240),
  ('Ward 10', 'वडा १०', 'Kathmandu Metropolitan City', 'Kathmandu', 'Bagmati', 27.7089, 85.3176),
  ('Ward 14', 'वडा १४', 'Kathmandu Metropolitan City', 'Kathmandu', 'Bagmati', 27.6952, 85.3127),
  ('Ward 32', 'वडा ३२', 'Kathmandu Metropolitan City', 'Kathmandu', 'Bagmati', 27.7251, 85.3388),
  ('Ward 1', 'वडा १', 'Lalitpur Metropolitan City', 'Lalitpur', 'Bagmati', 27.6644, 85.3188),
  ('Ward 4', 'वडा ४', 'Lalitpur Metropolitan City', 'Lalitpur', 'Bagmati', 27.6588, 85.3247),
  ('Ward 2', 'वडा २', 'Bhaktapur Municipality', 'Bhaktapur', 'Bagmati', 27.6724, 85.4270),
  ('Ward 2', 'वडा २', 'Pokhara Metropolitan City', 'Kaski', 'Gandaki', 28.2096, 83.9856),
  ('Ward 5', 'वडा ५', 'Biratnagar Metropolitan City', 'Morang', 'Koshi', 26.4567, 87.2718),
  ('Ward 3', 'वडा ३', 'Butwal Sub-Metropolitan City', 'Rupandehi', 'Lumbini', 27.7005, 83.4532)
ON CONFLICT DO NOTHING;

-- STEP 6: Migration — run this block if the DB already exists (safe to run multiple times)
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS followup_data JSONB;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS officer_notes TEXT[] DEFAULT '{}';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS referred_to TEXT;
CREATE INDEX IF NOT EXISTS complaints_tracking_idx ON complaints (tracking_code) WHERE tracking_code IS NOT NULL;

-- STEP 7: Verify everything looks good
SELECT 'ministries' as table_name, count(*) as row_count FROM ministries
UNION ALL
SELECT 'wards', count(*) FROM wards
UNION ALL
SELECT 'complaints', count(*) FROM complaints
UNION ALL
SELECT 'clusters', count(*) FROM clusters;
