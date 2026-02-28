// Fixtures JavaScript
// Handles upcoming fixtures loading, filtering, and display

class FixturesManager {
    constructor() {
        this.supabase = null;
        this.fixtures = [];
        this.filters = {
            competitionType: '',
            level: '',
            timePeriod: 'all'
        };
        
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
        
        // Load fixtures
        this.loadFixtures();
    }

    setupFilters() {
        const competitionTypeSelect = document.getElementById('competitionType');
        const levelFilterSelect = document.getElementById('levelFilter');
        const timePeriodSelect = document.getElementById('timePeriod');
        
        if (competitionTypeSelect) {
            competitionTypeSelect.addEventListener('change', (e) => {
                this.filters.competitionType = e.target.value;
                this.renderFixtures();
            });
        }
        
        if (levelFilterSelect) {
            levelFilterSelect.addEventListener('change', (e) => {
                this.filters.level = e.target.value;
                this.renderFixtures();
            });
        }
        
        if (timePeriodSelect) {
            timePeriodSelect.addEventListener('change', (e) => {
                this.filters.timePeriod = e.target.value;
                this.renderFixtures();
            });
        }
    }

    async loadFixtures() {
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
                .eq('status', 'scheduled')
                .gte('match_date', new Date().toISOString())
                .order('match_date', { ascending: true })
                .limit(50);

            if (error) throw error;
            
            this.fixtures = data || [];
            this.renderFixtures();
            
        } catch (error) {
            console.error('Error loading fixtures:', error);
            this.showError('Failed to load fixtures');
        }
    }

    filterFixtures() {
        let filtered = [...this.fixtures];
        
        // Filter by competition type
        if (this.filters.competitionType) {
            filtered = filtered.filter(fixture => 
                fixture.competition.type === this.filters.competitionType
            );
        }
        
        // Filter by level
        if (this.filters.level) {
            filtered = filtered.filter(fixture => 
                fixture.competition.level === this.filters.level
            );
        }
        
        // Filter by time period
        if (this.filters.timePeriod !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const endOfWeek = new Date(today);
            endOfWeek.setDate(endOfWeek.getDate() + 7);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            filtered = filtered.filter(fixture => {
                const fixtureDate = new Date(fixture.match_date);
                
                switch (this.filters.timePeriod) {
                    case 'today':
                        return fixtureDate >= today && fixtureDate < tomorrow;
                    case 'tomorrow':
                        const dayAfterTomorrow = new Date(tomorrow);
                        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
                        return fixtureDate >= tomorrow && fixtureDate < dayAfterTomorrow;
                    case 'week':
                        return fixtureDate >= today && fixtureDate <= endOfWeek;
                    case 'month':
                        return fixtureDate >= today && fixtureDate <= endOfMonth;
                    default:
                        return true;
                }
            });
        }
        
        return filtered;
    }

    renderFixtures() {
        const container = document.getElementById('fixturesByDate');
        if (!container) return;
        
        const filtered = this.filterFixtures();
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="card" style="padding: 3rem; text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📅</div>
                    <h3>No Fixtures Found</h3>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">
                        There are no fixtures matching your criteria. Try adjusting the filters.
                    </p>
                </div>
            `;
            return;
        }
        
        // Group fixtures by date
        const groupedByDate = this.groupByDate(filtered);
        
        let html = '';
        Object.keys(groupedByDate).forEach(dateKey => {
            const fixtures = groupedByDate[dateKey];
            html += this.renderDateGroup(dateKey, fixtures);
        });
        
        container.innerHTML = html;
    }

    groupByDate(fixtures) {
        const grouped = {};
        
        fixtures.forEach(fixture => {
            const date = new Date(fixture.match_date);
            const dateKey = date.toISOString().split('T')[0];
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(fixture);
        });
        
        return grouped;
    }

    renderDateGroup(dateKey, fixtures) {
        const date = new Date(dateKey);
        const isToday = this.isToday(date);
        const isTomorrow = this.isTomorrow(date);
        
        let dateLabel = this.formatDateFull(date);
        if (isToday) dateLabel = 'Today, ' + this.formatDateShort(date);
        if (isTomorrow) dateLabel = 'Tomorrow, ' + this.formatDateShort(date);
        
        return `
            <div class="date-group">
                <div class="date-header">
                    <h3>${dateLabel}</h3>
                    <span class="date-badge">${fixtures.length} ${fixtures.length === 1 ? 'match' : 'matches'}</span>
                </div>
                
                <div class="fixtures-list">
                    ${fixtures.map(fixture => this.renderFixtureCard(fixture)).join('')}
                </div>
            </div>
        `;
    }

    renderFixtureCard(fixture) {
        return `
            <div class="fixture-card">
                <div class="fixture-header">
                    <span class="competition-badge">
                        ${fixture.competition.name}
                        ${fixture.competition.level ? ` - ${fixture.competition.level}` : ''}
                    </span>
                    <span class="time-badge">
                        ⏰ ${this.formatTime(fixture.match_date)}
                    </span>
                </div>
                
                <div class="fixture-teams">
                    <div class="fixture-team home">
                        <div class="team-logo-small">${fixture.home_team.logo_url || '⚽'}</div>
                        <span class="team-name-large">${fixture.home_team.name}</span>
                    </div>
                    
                    <span class="vs-text">VS</span>
                    
                    <div class="fixture-team away">
                        <div class="team-logo-small">${fixture.away_team.logo_url || '⚽'}</div>
                        <span class="team-name-large">${fixture.away_team.name}</span>
                    </div>
                </div>
                
                <div class="fixture-details">
                    ${fixture.venue ? `<span>📍 ${fixture.venue}</span>` : '<span></span>'}
                    ${fixture.round ? `<span>🏆 ${fixture.round}</span>` : '<span></span>'}
                </div>
            </div>
        `;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    isTomorrow(date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return date.getDate() === tomorrow.getDate() &&
               date.getMonth() === tomorrow.getMonth() &&
               date.getFullYear() === tomorrow.getFullYear();
    }

    formatDateFull(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatDateShort(date) {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric'
        });
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showError(message) {
        const container = document.getElementById('fixturesByDate');
        if (container) {
            container.innerHTML = `
                <div class="card" style="padding: 2rem; text-align: center; border-color: var(--color-live);">
                    <p style="color: var(--color-live);">⚠️ ${message}</p>
                </div>
            `;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fixturesManager = new FixturesManager();
});