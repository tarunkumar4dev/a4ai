-- supabase/migrations/20240101000000_enhanced_questions.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===================== ENUM Types =====================
DO $$ BEGIN
    CREATE TYPE cognitive_level AS ENUM ('recall', 'understand', 'apply', 'analyze');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM ('mcq', 'short', 'long', 'numerical', 'case_based');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE language_code AS ENUM ('en', 'hi', 'bi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE board_type AS ENUM ('CBSE', 'ICSE', 'State');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE solution_style AS ENUM ('steps', 'concise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===================== Enhanced Tables =====================

-- Enhanced questions table with cognitive levels
CREATE TABLE IF NOT EXISTS enhanced_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic information
    subject TEXT NOT NULL,
    board board_type NOT NULL DEFAULT 'CBSE',
    class_num INTEGER NOT NULL CHECK (class_num >= 1 AND class_num <= 12),
    chapter TEXT NOT NULL,
    topic TEXT,
    
    -- Question metadata
    type question_type NOT NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'medium',
    cognitive cognitive_level NOT NULL DEFAULT 'understand',
    language language_code NOT NULL DEFAULT 'en',
    
    -- Question content
    stem TEXT NOT NULL,
    options JSONB,
    answer JSONB NOT NULL,
    
    -- Marks and assessment
    marks INTEGER NOT NULL DEFAULT 1,
    negative_marking DECIMAL(3,2) DEFAULT 0,
    units_required BOOLEAN DEFAULT false,
    
    -- Media and attachments
    images TEXT[],
    
    -- Solution details
    solution_style solution_style DEFAULT 'steps',
    solution_text TEXT,
    
    -- Enhanced metadata
    meta JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_marks CHECK (marks > 0),
    CONSTRAINT valid_negative_marking CHECK (negative_marking >= -10 AND negative_marking <= 0)
);

-- Enhanced test generations table
CREATE TABLE IF NOT EXISTS enhanced_test_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Generation request
    blueprint JSONB NOT NULL,
    status generation_status NOT NULL DEFAULT 'pending',
    
    -- Results
    questions JSONB,
    score_report JSONB,
    total_questions INTEGER DEFAULT 0,
    total_marks INTEGER DEFAULT 0,
    
    -- Output files
    pdf_url TEXT,
    docx_url TEXT,
    csv_url TEXT,
    json_url TEXT,
    
    -- Analytics
    cognitive_distribution JSONB,
    difficulty_distribution JSONB,
    quality_score DECIMAL(3,2),
    generation_time INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 1)
);

-- Question buckets table for template management
CREATE TABLE IF NOT EXISTS question_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Bucket configuration
    config JSONB NOT NULL,
    
    -- Metadata
    is_template BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[],
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced analytics table
CREATE TABLE IF NOT EXISTS enhanced_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Generation metrics
    total_generations INTEGER DEFAULT 0,
    successful_generations INTEGER DEFAULT 0,
    failed_generations INTEGER DEFAULT 0,
    
    -- Question metrics
    total_questions_generated INTEGER DEFAULT 0,
    average_quality_score DECIMAL(3,2),
    average_generation_time INTEGER,
    
    -- Cognitive distribution
    cognitive_breakdown JSONB DEFAULT '{"recall": 0, "understand": 0, "apply": 0, "analyze": 0}'::JSONB,
    difficulty_breakdown JSONB DEFAULT '{"easy": 0, "medium": 0, "hard": 0}'::JSONB,
    
    -- Subject distribution
    subject_breakdown JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== Indexes =====================

-- Indexes for enhanced_questions
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_user_id ON enhanced_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_subject ON enhanced_questions(subject);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_class_num ON enhanced_questions(class_num);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_chapter ON enhanced_questions(chapter);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_type ON enhanced_questions(type);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_difficulty ON enhanced_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_cognitive ON enhanced_questions(cognitive);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_created_at ON enhanced_questions(created_at);
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_meta_score ON enhanced_questions((meta->>'score'));
CREATE INDEX IF NOT EXISTS idx_enhanced_questions_full_text ON enhanced_questions USING GIN (to_tsvector('english', stem));

-- Indexes for enhanced_test_generations
CREATE INDEX IF NOT EXISTS idx_enhanced_test_generations_user_id ON enhanced_test_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_test_generations_status ON enhanced_test_generations(status);
CREATE INDEX IF NOT EXISTS idx_enhanced_test_generations_created_at ON enhanced_test_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_enhanced_test_generations_quality_score ON enhanced_test_generations(quality_score);

-- Indexes for question_buckets
CREATE INDEX IF NOT EXISTS idx_question_buckets_user_id ON question_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_question_buckets_is_template ON question_buckets(is_template);
CREATE INDEX IF NOT EXISTS idx_question_buckets_is_public ON question_buckets(is_public);
CREATE INDEX IF NOT EXISTS idx_question_buckets_tags ON question_buckets USING GIN (tags);

-- Indexes for enhanced_analytics
CREATE INDEX IF NOT EXISTS idx_enhanced_analytics_user_id ON enhanced_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_analytics_date ON enhanced_analytics(date);

-- ===================== RLS Policies =====================

-- Enable RLS on all tables
ALTER TABLE enhanced_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_test_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for enhanced_questions
DROP POLICY IF EXISTS "Users can view their own questions" ON enhanced_questions;
CREATE POLICY "Users can view their own questions" ON enhanced_questions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own questions" ON enhanced_questions;
CREATE POLICY "Users can insert their own questions" ON enhanced_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own questions" ON enhanced_questions;
CREATE POLICY "Users can update their own questions" ON enhanced_questions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own questions" ON enhanced_questions;
CREATE POLICY "Users can delete their own questions" ON enhanced_questions
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for enhanced_test_generations
DROP POLICY IF EXISTS "Users can view their own generations" ON enhanced_test_generations;
CREATE POLICY "Users can view their own generations" ON enhanced_test_generations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own generations" ON enhanced_test_generations;
CREATE POLICY "Users can insert their own generations" ON enhanced_test_generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own generations" ON enhanced_test_generations;
CREATE POLICY "Users can update their own generations" ON enhanced_test_generations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own generations" ON enhanced_test_generations;
CREATE POLICY "Users can delete their own generations" ON enhanced_test_generations
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for question_buckets
DROP POLICY IF EXISTS "Users can view their own buckets and public templates" ON question_buckets;
CREATE POLICY "Users can view their own buckets and public templates" ON question_buckets
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert their own buckets" ON question_buckets;
CREATE POLICY "Users can insert their own buckets" ON question_buckets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own buckets" ON question_buckets;
CREATE POLICY "Users can update their own buckets" ON question_buckets
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own buckets" ON question_buckets;
CREATE POLICY "Users can delete their own buckets" ON question_buckets
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for enhanced_analytics
DROP POLICY IF EXISTS "Users can view their own analytics" ON enhanced_analytics;
CREATE POLICY "Users can view their own analytics" ON enhanced_analytics
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own analytics" ON enhanced_analytics;
CREATE POLICY "Users can insert their own analytics" ON enhanced_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own analytics" ON enhanced_analytics;
CREATE POLICY "Users can update their own analytics" ON enhanced_analytics
    FOR UPDATE USING (auth.uid() = user_id);

-- ===================== Functions =====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_enhanced_questions_updated_at ON enhanced_questions;
CREATE TRIGGER update_enhanced_questions_updated_at BEFORE UPDATE ON enhanced_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enhanced_test_generations_updated_at ON enhanced_test_generations;
CREATE TRIGGER update_enhanced_test_generations_updated_at BEFORE UPDATE ON enhanced_test_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_question_buckets_updated_at ON question_buckets;
CREATE TRIGGER update_question_buckets_updated_at BEFORE UPDATE ON question_buckets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enhanced_analytics_updated_at ON enhanced_analytics;
CREATE TRIGGER update_enhanced_analytics_updated_at BEFORE UPDATE ON enhanced_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment bucket usage
CREATE OR REPLACE FUNCTION increment_bucket_usage(bucket_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE question_buckets 
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = bucket_id;
END;
$$ language 'plpgsql';

-- Function to update analytics
CREATE OR REPLACE FUNCTION update_generation_analytics(
    p_user_id UUID,
    p_success BOOLEAN,
    p_questions_count INTEGER,
    p_quality_score DECIMAL,
    p_generation_time INTEGER,
    p_cognitive_breakdown JSONB,
    p_difficulty_breakdown JSONB,
    p_subject TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO enhanced_analytics (
        user_id,
        total_generations,
        successful_generations,
        failed_generations,
        total_questions_generated,
        average_quality_score,
        average_generation_time,
        cognitive_breakdown,
        difficulty_breakdown,
        subject_breakdown
    )
    VALUES (
        p_user_id,
        1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_questions_count,
        p_quality_score,
        p_generation_time,
        p_cognitive_breakdown,
        p_difficulty_breakdown,
        jsonb_build_object(p_subject, 1)
    )
    ON CONFLICT (user_id, date) 
    DO UPDATE SET
        total_generations = enhanced_analytics.total_generations + 1,
        successful_generations = enhanced_analytics.successful_generations + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_generations = enhanced_analytics.failed_generations + CASE WHEN p_success THEN 0 ELSE 1 END,
        total_questions_generated = enhanced_analytics.total_questions_generated + p_questions_count,
        average_quality_score = (enhanced_analytics.average_quality_score * enhanced_analytics.total_generations + p_quality_score) / (enhanced_analytics.total_generations + 1),
        average_generation_time = (enhanced_analytics.average_generation_time * enhanced_analytics.total_generations + p_generation_time) / (enhanced_analytics.total_generations + 1),
        cognitive_breakdown = enhanced_analytics.cognitive_breakdown || p_cognitive_breakdown,
        difficulty_breakdown = enhanced_analytics.difficulty_breakdown || p_difficulty_breakdown,
        subject_breakdown = enhanced_analytics.subject_breakdown || jsonb_build_object(p_subject, COALESCE((enhanced_analytics.subject_breakdown->>p_subject)::INTEGER, 0) + 1),
        updated_at = NOW();
END;
$$ language 'plpgsql';

-- Function to search questions with cognitive filters
CREATE OR REPLACE FUNCTION search_enhanced_questions(
    search_query TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_class_num INTEGER DEFAULT NULL,
    p_chapter TEXT DEFAULT NULL,
    p_type question_type DEFAULT NULL,
    p_difficulty difficulty_level DEFAULT NULL,
    p_cognitive cognitive_level DEFAULT NULL,
    p_min_marks INTEGER DEFAULT NULL,
    p_max_marks INTEGER DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    subject TEXT,
    class_num INTEGER,
    chapter TEXT,
    topic TEXT,
    type question_type,
    difficulty difficulty_level,
    cognitive cognitive_level,
    stem TEXT,
    marks INTEGER,
    negative_marking DECIMAL,
    meta JSONB,
    created_at TIMESTAMPTZ,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eq.id,
        eq.subject,
        eq.class_num,
        eq.chapter,
        eq.topic,
        eq.type,
        eq.difficulty,
        eq.cognitive,
        eq.stem,
        eq.marks,
        eq.negative_marking,
        eq.meta,
        eq.created_at,
        CASE 
            WHEN search_query IS NOT NULL THEN 
                ts_rank(to_tsvector('english', eq.stem), plainto_tsquery('english', search_query))
            ELSE 1
        END as similarity_score
    FROM enhanced_questions eq
    WHERE 
        (search_query IS NULL OR to_tsvector('english', eq.stem) @@ plainto_tsquery('english', search_query))
        AND (p_subject IS NULL OR eq.subject = p_subject)
        AND (p_class_num IS NULL OR eq.class_num = p_class_num)
        AND (p_chapter IS NULL OR eq.chapter = p_chapter)
        AND (p_type IS NULL OR eq.type = p_type)
        AND (p_difficulty IS NULL OR eq.difficulty = p_difficulty)
        AND (p_cognitive IS NULL OR eq.cognitive = p_cognitive)
        AND (p_min_marks IS NULL OR eq.marks >= p_min_marks)
        AND (p_max_marks IS NULL OR eq.marks <= p_max_marks)
    ORDER BY 
        CASE WHEN search_query IS NOT NULL THEN 
            ts_rank(to_tsvector('english', eq.stem), plainto_tsquery('english', search_query))
        ELSE 1 END DESC,
        eq.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ language 'plpgsql';

-- ===================== Grant Permissions =====================
GRANT ALL ON enhanced_questions TO authenticated;
GRANT ALL ON enhanced_test_generations TO authenticated;
GRANT ALL ON question_buckets TO authenticated;
GRANT ALL ON enhanced_analytics TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;