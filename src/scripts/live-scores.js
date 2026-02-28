// Live Scores JavaScript
// Handles fetching, filtering, and displaying live match scores

class LiveScores {
    constructor() {
        this.supabase = null;
        this.matches = [];
        this.filters = {
            competitionType: '',
            level: ''
        };
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        // Initialize Supabase
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );
        }

        // Setup filter listeners
        this.setupFilters();
        
        // Load initial data
        this.loadMatches();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        // Subscribe to real-time updates
        this.subscribeToUpdates();
    }

    setupFilters() {
        const competitionTypeSelect = document.getElementById('competitionType');
        const levelFilterSelect = document.getElementById('levelFilter');
        
        if (competitionTypeSelect) {
            competitionTypeSelect.addEventListener('change', (e) => {
                this.filters.competitionType = e.target.value;
                this.renderMatches();
            });
        }
        
        if (levelFilterSelect) {
            levelFilterSelect.addEventListener('change', (e) => {
                this.filters.level = e.target.value;
                this.renderMatches();
            });
        }
    }

    async loadMatches() {
        if (!this.supabase) {
            this.showError('Database connection not available');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('matches')
                .select(`
                    *,
                    home_team:teams!matches_home_team_id_fkey(id, name, short_name, logo_url),
                    away_team:teams!matches_away_team_id_fkey(id, name, short_name, logo_url),
                    competition:competitions(id, name, type, level)
                `)
                .eq('status', 'live')
                .order('match_date', { ascending: false });

            if (error) throw error;
            
            this.matches = data || [];
            this.renderMatches();
            
        } catch (error) {
            console.error('Error loading matches:', error);
            this.showError('Failed to load live matches');
        }
    }

    filterMatches() {
        let filtered = [...this.matches];
        
        // Filter by competition type
        if (this.filters.competitionType) {
            filtered = filtered.filter(match => 
                match.competition.type === this.filters.competitionType
            );
        }
        
        // Filter by level
        if (this.filters.level) {
            filtered = filtered.filter(match => 
                match.competition.level === this.filters.level
            );
        }
        
        return filtered;
    }

    renderMatches() {
        const container = document.getElementById('liveMatches');
        if (!container) return;
        
        const filtered = this.filterMatches();
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="card" style="padding: 3rem; text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">⚽</div>
                    <h3>No Live Matches</h3>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">
                        There are no live matches at the moment. Check back soon or view upcoming fixtures.
                    </p>
                    <a href="/fixtures.html" class="btn btn-primary" style="margin-top: 1rem;">View Fixtures</a>
                </div>
            `;
            return;
        }
        
        const html = filtered.map(match => this.renderMatchCard(match)).join('');
        container.innerHTML = html;
    }

    renderMatchCard(match) {
        const isLive = match.status === 'live';
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        
        return `
            <div class="match-detail-card" data-match-id="${match.id}">
                <div class="match-header">
                    <span class="match-competition">
                        ${match.competition.name}
                        ${match.competition.level ? ` - ${match.competition.level}` : ''}
                    </span>
                    <span class="match-status ${match.status}">
                        ${isLive ? `<span style="display: inline-block; width: 8px; height: 8px; background-color: var(--color-live); border-radius: 50%; margin-right: 6px; animation: pulse 2s infinite;"></span>` : ''}
                        ${isLive ? `LIVE ${match.match_time || 0}'` : match.status.toUpperCase()}
                    </span>
                </div>
                
                <div class="score-display">
                    <div class="team-display">
                        <div class="team-logo">${match.home_team.logo_url || '⚽'}</div>
                        <div class="team-name" style="font-weight: 600; margin-bottom: 0.5rem;">${match.home_team.name}</div>
                        <div class="score">${homeScore}</div>
                    </div>
                    
                    <div class="vs-separator">:</div>
                    
                    <div class="team-display">
                        <div class="team-logo">${match.away_team.logo_url || '⚽'}</div>
                        <div class="team-name" style="font-weight: 600; margin-bottom: 0.5rem;">${match.away_team.name}</div>
                        <div class="score">${awayScore}</div>
                    </div>
                </div>
                
                <div class="match-details">
                    <span>📅 ${this.formatDate(match.match_date)}</span>
                    ${match.venue ? `<span>📍 ${match.venue}</span>` : ''}
                </div>
                
                ${match.half_time_home_score !== null ? `
                    <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light); font-size: 0.875rem; color: var(--text-tertiary);">
                        HT: ${match.half_time_home_score} - ${match.half_time_away_score}
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    startAutoRefresh() {
        // Refresh every 10 seconds
        this.updateInterval = setInterval(() => {
            this.loadMatches();
        }, 10000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    subscribeToUpdates() {
        if (!this.supabase) return;
        
        // Subscribe to match updates
        this.supabase
            .channel('live-matches')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'matches', filter: 'status=eq.live' },
                (payload) => {
                    console.log('Live match update:', payload);
                    this.loadMatches();
                }
            )
            .subscribe();
    }

    showError(message) {
        const container = document.getElementById('liveMatches');
        if (container) {
            container.innerHTML = `
                <div class="card" style="padding: 2rem; text-align: center; border-color: var(--color-live);">
                    <p style="color: var(--color-live);">⚠️ ${message}</p>
                </div>
            `;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.liveScores = new LiveScores();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.liveScores) {
            window.liveScores.destroy();
        }
    });
});