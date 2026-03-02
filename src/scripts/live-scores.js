// Live Scores JavaScript - PROPER Implementation
// Features: Persistent timer, goal scorers, match statistics, real-time updates

class LiveScores {
    constructor() {
        this.supabase = null;
        this.matches = [];
        this.filters = { competitionType: '', level: '' };
        this.updateInterval = null;
        this.isAdmin = false;
        this.init();
    }

    async init() {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        }
        await this.checkAdminStatus();
        this.setupFilters();
        await this.loadMatches();
        this.startAutoRefresh();
        this.subscribeToUpdates();
    }

    async checkAdminStatus() {
        if (!this.supabase) return;
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                const { data: adminUser } = await this.supabase.from('admin_users').select('id').eq('email', session.user.email).single();
                this.isAdmin = !!adminUser;
            }
        } catch (error) { this.isAdmin = false; }
    }

    setupFilters() {
        ['competitionType', 'levelFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => { 
                this.filters[id === 'levelFilter' ? 'level' : 'competitionType'] = e.target.value; 
                this.renderMatches(); 
            });
        });
    }

    async loadMatches() {
        if (!this.supabase) return this.showError('Database connection not available');
        try {
            // Get live matches with events (goals, cards, etc.)
            const { data: matches, error: matchError } = await this.supabase
                .from('matches')
                .select(`
                    *,
                    home_team:teams!matches_home_team_id_fkey(id, name, short_name, logo_url),
                    away_team:teams!matches_away_team_id_fkey(id, name, short_name, logo_url),
                    competition:competitions(id, name, type, level)
                `)
                .eq('status', 'live')
                .order('match_date', { ascending: false });

            if (matchError) throw matchError;

            // For each match, get the events (goals, cards, etc.)
            for (const match of matches || []) {
                const { data: events, error: eventsError } = await this.supabase
                    .from('match_events')
                    .select('*')
                    .eq('match_id', match.id)
                    .order('event_minute', { ascending: true });
                
                if (!eventsError) {
                    match.events = events || [];
                }
            }

            this.matches = matches || [];
            this.calculateCurrentTime();
            this.renderMatches();
            
        } catch (error) { 
            console.error('Error loading matches:', error); 
            this.showError('Failed to load live matches'); 
        }
    }

    calculateCurrentTime() {
        // Calculate elapsed time based on match start time (PERSISTENT)
        const now = new Date();
        
        this.matches.forEach(match => {
            if (match.status === 'live' && match.match_date) {
                const startTime = new Date(match.match_date);
                const elapsedMs = now - startTime;
                const elapsedMinutes = Math.floor(elapsedMs / 60000); // Convert to minutes
                
                const duration = match.match_duration || 90;
                
                // Calculate actual match time (can't exceed duration + extra time)
                match.calculated_time = Math.min(elapsedMinutes, duration + 10); // Max 10 min extra time
                
                // Determine half
                const halfTime = duration / 2;
                match.current_half = match.calculated_time <= halfTime ? 1 : 2;
                match.is_half_time = match.calculated_time === halfTime;
            }
        });
    }

    filterMatches() {
        let filtered = [...this.matches];
        if (this.filters.competitionType) filtered = filtered.filter(m => m.competition.type === this.filters.competitionType);
        if (this.filters.level) filtered = filtered.filter(m => m.competition.level === this.filters.level);
        return filtered;
    }

    renderMatches() {
        const container = document.getElementById('liveMatches');
        if (!container) return;
        
        const filtered = this.filterMatches();
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="card" style="padding:3rem;text-align:center;">
                    <div style="font-size:4rem;margin-bottom:1rem;">⚽</div>
                    <h3>No Live Matches</h3>
                    <p style="color:var(--text-secondary);margin-top:1rem;">No live matches at the moment.</p>
                    <a href="/fixtures.html" class="btn btn-primary" style="margin-top:1rem;">View Fixtures</a>
                </div>`;
            return;
        }
        
        container.innerHTML = filtered.map(match => this.renderMatchCard(match)).join('');
        if (this.isAdmin) this.addGlobalControls();
    }

    renderMatchCard(match) {
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        const duration = match.match_duration || 90;
        const currentTime = match.calculated_time || match.match_time || 0;
        const currentHalf = match.current_half || 1;
        
        // Get goal scorers
        const homeGoals = match.events?.filter(e => e.event_type === 'goal' && e.team_id === match.home_team.id) || [];
        const awayGoals = match.events?.filter(e => e.event_type === 'goal' && e.team_id === match.away_team.id) || [];
        
        return `
            <div class="match-detail-card" data-match-id="${match.id}" onclick="window.location.href='/match-detail.html?id=${match.id}'" style="cursor:pointer;">
                <div class="match-header">
                    <span class="match-competition">${match.competition.name}${match.competition.level ? ` - ${match.competition.level}` : ''}</span>
                    <span class="match-status live">
                        <span class="live-pulse"></span>LIVE ${currentTime}' ${currentHalf === 1 ? '(1st Half)' : '(2nd Half)'}
                    </span>
                </div>
                
                <div class="score-display">
                    <div class="team-display">
                        <div class="team-logo">${match.home_team.logo_url || '⚽'}</div>
                        <div class="team-name">${match.home_team.name}</div>
                        <div class="score">${homeScore}</div>
                    </div>
                    
                    <div class="vs-separator">:</div>
                    
                    <div class="team-display">
                        <div class="team-logo">${match.away_team.logo_url || '⚽'}</div>
                        <div class="team-name">${match.away_team.name}</div>
                        <div class="score">${awayScore}</div>
                    </div>
                </div>
                
                ${homeGoals.length > 0 || awayGoals.length > 0 ? `
                    <div class="goal-scorers">
                        <div class="goal-list home">
                            ${homeGoals.map(g => `<div class="goal-item">⚽ ${g.player_name} ${g.event_minute}'</div>`).join('')}
                        </div>
                        <div class="goal-list away">
                            ${awayGoals.map(g => `<div class="goal-item">⚽ ${g.player_name} ${g.event_minute}'</div>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="match-details">
                    <span>📅 ${this.formatDate(match.match_date)}</span>
                    ${match.venue ? `<span>📍 ${match.venue}</span>` : ''}
                    <span style="color:var(--primary-color);font-weight:600;">👆 Tap for details</span>
                </div>
                
                ${match.half_time_home_score !== null ? `
                    <div class="half-time-score">HT: ${match.half_time_home_score} - ${match.half_time_away_score}</div>
                ` : ''}
                
                ${this.isAdmin ? `
                    <div class="admin-controls" onclick="event.stopPropagation();">
                        <button class="btn-small btn-primary" onclick="liveScores.quickGoal('${match.id}','home')">⚽ Home</button>
                        <button class="btn-small btn-primary" onclick="liveScores.quickGoal('${match.id}','away')">⚽ Away</button>
                        <button class="btn-small btn-secondary" onclick="liveScores.endMatch('${match.id}')">🏁 End</button>
                    </div>
                ` : ''}
            </div>`;
    }

    addGlobalControls() {
        const container = document.getElementById('liveMatches');
        if (!container || !this.isAdmin) return;
        const controls = document.createElement('div');
        controls.className = 'global-admin-controls';
        controls.innerHTML = `
            <div class="card" style="padding:1rem;margin-bottom:1rem;background:var(--bg-secondary);">
                <strong>⚙️ Admin Controls</strong>
                <a href="/admin/dashboard.html" class="btn-small" style="margin-left:1rem;text-decoration:none;">
                    📊 Dashboard
                </a>
                <button class="btn-small" onclick="liveScores.loadMatches()" style="margin-left:0.5rem;">🔄 Refresh</button>
            </div>`;
        container.insertBefore(controls, container.firstChild);
    }

    async quickGoal(matchId, team) {
        if (!this.supabase || !this.isAdmin) return;
        const match = this.matches.find(m => m.id === matchId);
        if (!match) return;
        
        const playerName = prompt(`Enter player name for ${team} team goal:`);
        if (!playerName) return;
        
        const currentTime = match.calculated_time || match.match_time || 0;
        
        try {
            // Add goal event
            await this.supabase.from('match_events').insert({
                match_id: matchId,
                team_id: team === 'home' ? match.home_team.id : match.away_team.id,
                player_name: playerName,
                event_type: 'goal',
                event_minute: currentTime
            });
            
            // Score will auto-update via trigger
            await this.loadMatches();
            this.showToast(`⚽ Goal! ${playerName} ${currentTime}'`);
        } catch (error) { 
            console.error('Error adding goal:', error); 
            this.showToast('Failed to add goal', 'error'); 
        }
    }

    async endMatch(matchId) {
        if (!this.supabase || !this.isAdmin || !confirm('End this match?')) return;
        try { 
            await this.supabase.from('matches').update({ status: 'finished' }).eq('id', matchId); 
            await this.loadMatches(); 
            this.showToast('🏁 Match ended!'); 
        } catch (error) { 
            console.error('Error ending match:', error); 
            this.showToast('Failed to end match', 'error'); 
        }
    }

    formatDate(dateString) { 
        const date = new Date(dateString); 
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
    }
    
    startAutoRefresh() { 
        // Refresh every 10 seconds
        this.updateInterval = setInterval(() => this.loadMatches(), 10000); 
    }
    
    stopAutoRefresh() { 
        if (this.updateInterval) { 
            clearInterval(this.updateInterval); 
            this.updateInterval = null; 
        } 
    }
    
    subscribeToUpdates() { 
        if (!this.supabase) return; 
        this.supabase.channel('live-matches')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'matches', 
                filter: 'status=eq.live' 
            }, () => this.loadMatches())
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'match_events' 
            }, () => this.loadMatches())
            .subscribe(); 
    }
    
    showError(message) { 
        const container = document.getElementById('liveMatches'); 
        if (container) container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><p style="color:var(--color-live);">⚠️ ${message}</p></div>`; 
    }
    
    showToast(message, type = 'success') { 
        const toast = document.createElement('div'); 
        toast.style.cssText = `position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:${type === 'error' ? 'var(--color-live)' : 'var(--color-finished)'};color:white;border-radius:8px;z-index:10000;`; 
        toast.textContent = message; 
        document.body.appendChild(toast); 
        setTimeout(() => toast.remove(), 3000); 
    }
    
    destroy() { this.stopAutoRefresh(); }
}

const style = document.createElement('style');
style.textContent = `
    .live-pulse{display:inline-block;width:8px;height:8px;background-color:var(--color-live);border-radius:50%;margin-right:6px;animation:pulse 2s infinite;}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(1.2);}}
    .goal-scorers{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-light);font-size:0.875rem;}
    .goal-list{display:flex;flex-direction:column;gap:0.25rem;}
    .goal-list.home{text-align:left;}
    .goal-list.away{text-align:right;}
    .goal-item{color:var(--text-secondary);padding:0.25rem 0;}
    .half-time-score{text-align:center;margin-top:0.5rem;font-size:0.875rem;color:var(--text-tertiary);}
    .admin-controls{display:flex;gap:0.5rem;margin-top:1rem;padding-top:1rem;border-top:2px dashed var(--primary-color);flex-wrap:wrap;}
    .btn-small{padding:0.5rem 0.75rem;font-size:0.875rem;border:none;border-radius:var(--radius-md);cursor:pointer;transition:all var(--transition-fast);}
    .btn-small.btn-primary{background:var(--primary-color);color:white;}
    .btn-small.btn-secondary{background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);}
    .btn-small:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm);}
    .global-admin-controls{position:sticky;top:0;z-index:100;}
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => { 
    window.liveScores = new LiveScores(); 
    window.addEventListener('beforeunload', () => { if (window.liveScores) window.liveScores.destroy(); }); 
});