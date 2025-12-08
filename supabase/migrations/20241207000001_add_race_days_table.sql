-- Create table to manage race days within a penca
CREATE TABLE race_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    day_name TEXT NOT NULL,
    day_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (penca_id, day_number)
);

-- Add indexes
CREATE INDEX idx_race_days_penca_id ON race_days(penca_id);
CREATE INDEX idx_race_days_penca_day ON race_days(penca_id, day_number);

-- Add comment
COMMENT ON TABLE race_days IS 'Represents different days within a penca where races can be grouped';

-- Modify races table to reference race_days
ALTER TABLE races 
ADD COLUMN race_day_id UUID REFERENCES race_days(id) ON DELETE SET NULL;

-- Add index for the foreign key
CREATE INDEX idx_races_race_day_id ON races(race_day_id);

-- Comment on the new column
COMMENT ON COLUMN races.race_day_id IS 'Optional reference to a race day. NULL for races not assigned to a specific day.';
