-- Migration: Add deep scraping columns to articles table
-- Run this in Supabase SQL Editor

-- Add content column for full article text
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add deep scraping tracking
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS deep_scraped BOOLEAN DEFAULT FALSE;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS deep_scraped_at TIMESTAMP WITH TIME ZONE;

-- Create index for finding unscraped articles efficiently
CREATE INDEX IF NOT EXISTS idx_articles_deep_scraped 
ON articles (deep_scraped) 
WHERE deep_scraped = FALSE OR deep_scraped IS NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'articles';
