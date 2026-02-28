-- Mock University Database Schema
-- For Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Blog Posts Table
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    author VARCHAR(100),
    published_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'published', -- draft, published, archived
    views INT DEFAULT 0,
    meta_title VARCHAR(255),
    meta_description TEXT,
    tags TEXT[], -- Array of tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitions Table
CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- faculty, department, custom
    level VARCHAR(50), -- level 1, level 2, level 3, etc.
    season VARCHAR(50),
    format VARCHAR(50) DEFAULT 'league', -- league, cup, knockout
    status VARCHAR(20) DEFAULT 'active', -- active, completed, upcoming
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    logo_url TEXT,
    faculty VARCHAR(100),
    department VARCHAR(100),
    level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches Table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, finished, postponed
    match_date TIMESTAMP NOT NULL,
    venue VARCHAR(255),
    round VARCHAR(50), -- for cup games: group-stage, round-16, quarter-final, etc.
    group_name VARCHAR(10), -- for group stage: A, B, C, etc.
    is_cup_match BOOLEAN DEFAULT FALSE,
    match_time INT DEFAULT 0, -- current match time in minutes
    half_time_home_score INT DEFAULT 0,
    half_time_away_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player Stats Table
CREATE TABLE player_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    player_name VARCHAR(255) NOT NULL,
    goals INT DEFAULT 0,
    assists INT DEFAULT 0,
    yellow_cards INT DEFAULT 0,
    red_cards INT DEFAULT 0,
    minutes_played INT DEFAULT 0,
    position VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- League Standings Table (auto-calculated but cached)
CREATE TABLE league_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    played INT DEFAULT 0,
    won INT DEFAULT 0,
    drawn INT DEFAULT 0,
    lost INT DEFAULT 0,
    goals_for INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    goal_difference INT DEFAULT 0,
    points INT DEFAULT 0,
    position INT,
    form VARCHAR(20), -- last 5 results: WWDLL
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, team_id)
);

-- Cup Groups Table
CREATE TABLE cup_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    group_name VARCHAR(10) NOT NULL, -- A, B, C, D, etc.
    played INT DEFAULT 0,
    won INT DEFAULT 0,
    drawn INT DEFAULT 0,
    lost INT DEFAULT 0,
    goals_for INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    goal_difference INT DEFAULT 0,
    points INT DEFAULT 0,
    position INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, team_id, group_name)
);

-- Contact Submissions Table
CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    message TEXT NOT NULL,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    whatsapp_numbers TEXT[], -- array of numbers message was sent to
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
);

-- Admin Users Table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs Table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50), -- blog_post, match, competition, etc.
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media Library Table
CREATE TABLE media_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    uploaded_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_date ON blog_posts(published_date DESC);
CREATE INDEX idx_matches_competition ON matches(competition_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_player_stats_match ON player_stats(match_id);
CREATE INDEX idx_league_standings_competition ON league_standings(competition_id);
CREATE INDEX idx_cup_groups_competition ON cup_groups(competition_id);
CREATE INDEX idx_contact_submissions_date ON contact_submissions(submitted_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cup_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PUBLIC READ POLICIES (for frontend)
-- ============================================================================

-- Public read access for published blog posts
CREATE POLICY "Public read published blog posts" 
ON blog_posts FOR SELECT 
USING (status = 'published');

-- Public read access for competitions
CREATE POLICY "Public read competitions" 
ON competitions FOR SELECT 
USING (true);

-- Public read access for teams
CREATE POLICY "Public read teams" 
ON teams FOR SELECT 
USING (true);

-- Public read access for matches
CREATE POLICY "Public read matches" 
ON matches FOR SELECT 
USING (true);

-- Public read access for player stats
CREATE POLICY "Public read player stats" 
ON player_stats FOR SELECT 
USING (true);

-- Public read access for league standings
CREATE POLICY "Public read league standings" 
ON league_standings FOR SELECT 
USING (true);

-- Public read access for cup groups
CREATE POLICY "Public read cup groups" 
ON cup_groups FOR SELECT 
USING (true);

-- ============================================================================
-- ADMIN-ONLY POLICIES (requires authentication + admin table verification)
-- ============================================================================

-- Helper function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the authenticated user exists in admin_users table
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Blog Posts - Admin full access
CREATE POLICY "Admins full access blog posts" 
ON blog_posts FOR ALL 
USING (is_admin());

-- Competitions - Admin full access
CREATE POLICY "Admins full access competitions" 
ON competitions FOR ALL 
USING (is_admin());

-- Teams - Admin full access
CREATE POLICY "Admins full access teams" 
ON teams FOR ALL 
USING (is_admin());

-- Matches - Admin full access
CREATE POLICY "Admins full access matches" 
ON matches FOR ALL 
USING (is_admin());

-- Player Stats - Admin full access
CREATE POLICY "Admins full access player stats" 
ON player_stats FOR ALL 
USING (is_admin());

-- League Standings - Admin full access
CREATE POLICY "Admins full access league standings" 
ON league_standings FOR ALL 
USING (is_admin());

-- Cup Groups - Admin full access
CREATE POLICY "Admins full access cup groups" 
ON cup_groups FOR ALL 
USING (is_admin());

-- Contact Submissions - Admin read access
CREATE POLICY "Admins read contact submissions" 
ON contact_submissions FOR SELECT 
USING (is_admin());

-- Contact Submissions - Public insert (for contact form)
CREATE POLICY "Public insert contact submissions" 
ON contact_submissions FOR INSERT 
WITH CHECK (true);

-- Admin Users - Only admins can read admin list
CREATE POLICY "Admins read admin users" 
ON admin_users FOR SELECT 
USING (is_admin());

-- Activity Logs - Admin read access
CREATE POLICY "Admins read activity logs" 
ON activity_logs FOR SELECT 
USING (is_admin());

-- Activity Logs - Admin insert access (for logging their actions)
CREATE POLICY "Admins insert activity logs" 
ON activity_logs FOR INSERT 
WITH CHECK (is_admin());

-- Media Library - Admin full access
CREATE POLICY "Admins full access media library" 
ON media_library FOR ALL 
USING (is_admin());

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. All tables have RLS enabled - NOTHING is accessible without a policy
-- 2. Public can only READ published content (blog posts, teams, matches, etc.)
-- 3. Public can INSERT contact form submissions (but not read them)
-- 4. Admins need authentication + presence in admin_users table
-- 5. The is_admin() function checks auth.jwt() email against admin_users
-- 6. Admin users table is NOT readable publicly - only by other admins

-- Function to update league standings after match
CREATE OR REPLACE FUNCTION update_league_standings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'finished' AND NOT NEW.is_cup_match THEN
        -- Update home team
        INSERT INTO league_standings (competition_id, team_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)
        VALUES (
            NEW.competition_id,
            NEW.home_team_id,
            1,
            CASE WHEN NEW.home_score > NEW.away_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.home_score < NEW.away_score THEN 1 ELSE 0 END,
            NEW.home_score,
            NEW.away_score,
            NEW.home_score - NEW.away_score,
            CASE WHEN NEW.home_score > NEW.away_score THEN 3 WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END
        )
        ON CONFLICT (competition_id, team_id) DO UPDATE SET
            played = league_standings.played + 1,
            won = league_standings.won + CASE WHEN NEW.home_score > NEW.away_score THEN 1 ELSE 0 END,
            drawn = league_standings.drawn + CASE WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            lost = league_standings.lost + CASE WHEN NEW.home_score < NEW.away_score THEN 1 ELSE 0 END,
            goals_for = league_standings.goals_for + NEW.home_score,
            goals_against = league_standings.goals_against + NEW.away_score,
            goal_difference = league_standings.goal_difference + (NEW.home_score - NEW.away_score),
            points = league_standings.points + CASE WHEN NEW.home_score > NEW.away_score THEN 3 WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Update away team
        INSERT INTO league_standings (competition_id, team_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)
        VALUES (
            NEW.competition_id,
            NEW.away_team_id,
            1,
            CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END,
            NEW.away_score,
            NEW.home_score,
            NEW.away_score - NEW.home_score,
            CASE WHEN NEW.away_score > NEW.home_score THEN 3 WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END
        )
        ON CONFLICT (competition_id, team_id) DO UPDATE SET
            played = league_standings.played + 1,
            won = league_standings.won + CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END,
            drawn = league_standings.drawn + CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            lost = league_standings.lost + CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END,
            goals_for = league_standings.goals_for + NEW.away_score,
            goals_against = league_standings.goals_against + NEW.home_score,
            goal_difference = league_standings.goal_difference + (NEW.away_score - NEW.home_score),
            points = league_standings.points + CASE WHEN NEW.away_score > NEW.home_score THEN 3 WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Update cup groups if it's a group stage match
    IF NEW.status = 'finished' AND NEW.is_cup_match AND NEW.round = 'group-stage' THEN
        -- Update home team in cup groups
        INSERT INTO cup_groups (competition_id, team_id, group_name, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)
        VALUES (
            NEW.competition_id,
            NEW.home_team_id,
            NEW.group_name,
            1,
            CASE WHEN NEW.home_score > NEW.away_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.home_score < NEW.away_score THEN 1 ELSE 0 END,
            NEW.home_score,
            NEW.away_score,
            NEW.home_score - NEW.away_score,
            CASE WHEN NEW.home_score > NEW.away_score THEN 3 WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END
        )
        ON CONFLICT (competition_id, team_id, group_name) DO UPDATE SET
            played = cup_groups.played + 1,
            won = cup_groups.won + CASE WHEN NEW.home_score > NEW.away_score THEN 1 ELSE 0 END,
            drawn = cup_groups.drawn + CASE WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            lost = cup_groups.lost + CASE WHEN NEW.home_score < NEW.away_score THEN 1 ELSE 0 END,
            goals_for = cup_groups.goals_for + NEW.home_score,
            goals_against = cup_groups.goals_against + NEW.away_score,
            goal_difference = cup_groups.goal_difference + (NEW.home_score - NEW.away_score),
            points = cup_groups.points + CASE WHEN NEW.home_score > NEW.away_score THEN 3 WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;
        
        -- Update away team in cup groups
        INSERT INTO cup_groups (competition_id, team_id, group_name, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)
        VALUES (
            NEW.competition_id,
            NEW.away_team_id,
            NEW.group_name,
            1,
            CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END,
            NEW.away_score,
            NEW.home_score,
            NEW.away_score - NEW.home_score,
            CASE WHEN NEW.away_score > NEW.home_score THEN 3 WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END
        )
        ON CONFLICT (competition_id, team_id, group_name) DO UPDATE SET
            played = cup_groups.played + 1,
            won = cup_groups.won + CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END,
            drawn = cup_groups.drawn + CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            lost = cup_groups.lost + CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END,
            goals_for = cup_groups.goals_for + NEW.away_score,
            goals_against = cup_groups.goals_against + NEW.home_score,
            goal_difference = cup_groups.goal_difference + (NEW.away_score - NEW.home_score),
            points = cup_groups.points + CASE WHEN NEW.away_score > NEW.home_score THEN 3 WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update standings
CREATE TRIGGER update_standings_after_match
AFTER UPDATE OF status, home_score, away_score ON matches
FOR EACH ROW
EXECUTE FUNCTION update_league_standings();