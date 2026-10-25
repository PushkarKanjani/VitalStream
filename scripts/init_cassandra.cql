-- VitalStream — Cassandra Keyspace + Table Initialization
-- Run (PowerShell): Get-Content scripts/init_cassandra.cql | docker exec -i vs_cassandra cqlsh
-- Run (bash):       docker exec -i vs_cassandra cqlsh < scripts/init_cassandra.cql

-- ── KEYSPACE ──────────────────────────────────────────────────────────────────
CREATE KEYSPACE IF NOT EXISTS vitalstream
  WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
  };

USE vitalstream;

-- ── PRIMARY VITALS TABLE ──────────────────────────────────────────────────────
-- Partitioned by (patient_id, reading_date) for efficient single-patient queries.
-- Clustered by timestamp DESC so newest readings come first.
CREATE TABLE IF NOT EXISTS vitals_by_patient_day (
    patient_id   TEXT,
    reading_date DATE,        -- YYYY-MM-DD (partition bucket, one row per reading)
    ts           TIMESTAMP,   -- full precision timestamp
    or_id        TEXT,
    hr           FLOAT,       -- heart rate (bpm)
    syst_bp      FLOAT,       -- systolic BP (mmHg)
    dias_bp      FLOAT,       -- diastolic BP (mmHg)
    o2_sat       FLOAT,       -- SpO2 (%)
    temp_c       FLOAT,       -- temperature (°C)
    etco2        FLOAT,       -- end-tidal CO2 (mmHg), nullable
    raw_source   TEXT,        -- 'vitaldb' or 'synthetic'
    PRIMARY KEY ((patient_id, reading_date), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 2592000  -- 30-day TTL
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

-- ── OR-LEVEL VIEW TABLE ────────────────────────────────────────────────────────
-- Partitioned by (or_id, reading_date) for the OR grid dashboard query.
CREATE TABLE IF NOT EXISTS vitals_by_or_day (
    or_id        TEXT,
    reading_date DATE,
    ts           TIMESTAMP,
    patient_id   TEXT,
    hr           FLOAT,
    syst_bp      FLOAT,
    dias_bp      FLOAT,
    o2_sat       FLOAT,
    temp_c       FLOAT,
    PRIMARY KEY ((or_id, reading_date), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 86400    -- 1-day TTL (live dashboard only)
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

-- ── WAVEFORM DOWNSAMPLED TABLE ────────────────────────────────────────────────
-- 30-minute waveform: 1-second buckets for the chart display
CREATE TABLE IF NOT EXISTS waveform_30min (
    patient_id   TEXT,
    window_start TIMESTAMP,   -- start of the 30-min window
    ts           TIMESTAMP,
    hr           FLOAT,
    syst_bp      FLOAT,
    o2_sat       FLOAT,
    PRIMARY KEY ((patient_id, window_start), ts)
) WITH CLUSTERING ORDER BY (ts ASC)
  AND default_time_to_live = 7200;    -- 2h TTL

-- ── MATERIALIZED: Latest reading per OR ──────────────────────────────────────
-- Used by the OR-wall dashboard to show the latest snapshot without ALLOW FILTERING
CREATE TABLE IF NOT EXISTS latest_vitals_by_or (
    or_id      TEXT PRIMARY KEY,
    patient_id TEXT,
    ts         TIMESTAMP,
    hr         FLOAT,
    syst_bp    FLOAT,
    dias_bp    FLOAT,
    o2_sat     FLOAT,
    temp_c     FLOAT
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ON vitals_by_patient_day (or_id);

-- ── MIGRATION (idempotent) ───────────────────────────────────────────────────
-- CREATE ... IF NOT EXISTS never changes an existing table, so enforce the
-- 1-day TWCS window explicitly for databases created with an older schema.
ALTER TABLE vitals_by_patient_day WITH compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
};
ALTER TABLE vitals_by_or_day WITH compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
};
