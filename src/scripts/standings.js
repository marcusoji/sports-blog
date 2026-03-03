// Standings JavaScript - League Tables, Cup Groups, and Player Statistics
class StandingsManager {
    constructor() {
        this.supabase = null;
        this.competitions = [];
        this.currentLeague = null;
        this.currentCup = null;
        this.init();
    }

    init() {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        }
        this.setupTabs();
        this.loadCompetitions();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
            });
        });
    }

    async loadCompetitions() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('competitions').select('*').eq('status', 'active');
            if (error) throw error;
            this.competitions = data || [];
            this.populateSelectors();
        } catch (error) {
            console.error('Error loading competitions:', error);
        }
    }

    populateSelectors() {
        const leagueSelector = document.getElementById('leagueSelector');
        const cupSelector = document.getElementById('cupSelector');
        const leagues = this.competitions.filter(c => c.format === 'league');
        const cups = this.competitions.filter(c => c.format === 'cup');
        
        if (leagues.length > 0) {
            leagueSelector.innerHTML = '<option value="">Select a league...</option>' + 
                leagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            leagueSelector.addEventListener('change', (e) => {
                this.currentLeague = e.target.value;
                this.loadLeagueStandings();
            });
            leagueSelector.value = leagues[0].id;
            this.currentLeague = leagues[0].id;
            this.loadLeagueStandings();
        } else {
            leagueSelector.innerHTML = '<option value="">No leagues available</option>';
        }
        
        if (cups.length > 0) {
            cupSelector.innerHTML = '<option value="">Select a cup...</option>' + 
                cups.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            cupSelector.addEventListener('change', (e) => {
                this.currentCup = e.target.value;
                this.loadCupStandings();
            });
        } else {
            cupSelector.innerHTML = '<option value="">No cup competitions available</option>';
        }
    }

    async loadLeagueStandings() {
        if (!this.supabase || !this.currentLeague) return;
        const container = document.getElementById('leagueStandings');
        container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';
        
        try {
            const { data, error } = await this.supabase
                .from('league_standings')
                .select('*, team:teams(*)')
                .eq('competition_id', this.currentLeague)
                .order('points', { ascending: false })
                .order('goal_difference', { ascending: false });
            if (error) throw error;
            
            // Load player statistics for this competition
            const stats = await this.loadPlayerStatistics(this.currentLeague);
            
            this.renderLeagueTable(data || [], stats);
        } catch (error) {
            console.error('Error loading standings:', error);
            container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--color-live);">⚠️ Failed to load standings</p></div>';
        }
    }

    async loadPlayerStatistics(competitionId) {
        try {
            // Get all matches for this competition
            const { data: matches } = await this.supabase
                .from('matches')
                .select('id')
                .eq('competition_id', competitionId)
                .eq('status', 'finished');
            
            if (!matches || matches.length === 0) {
                return { topScorers: [], topAssisters: [], yellowCards: [], redCards: [] };
            }
            
            const matchIds = matches.map(m => m.id);
            
            // Get all events for these matches
            const { data: events } = await this.supabase
                .from('match_events')
                .select('*')
                .in('match_id', matchIds);
            
            if (!events) {
                return { topScorers: [], topAssisters: [], yellowCards: [], redCards: [] };
            }
            
            // Process goals
            const goalStats = {};
            events.filter(e => e.event_type === 'goal').forEach(event => {
                if (!goalStats[event.player_name]) {
                    goalStats[event.player_name] = { player: event.player_name, goals: 0, team_id: event.team_id };
                }
                goalStats[event.player_name].goals++;
            });
            
            // Process assists
            const assistStats = {};
            events.filter(e => e.event_type === 'goal' && e.details?.assist).forEach(event => {
                const assister = event.details.assist;
                if (!assistStats[assister]) {
                    assistStats[assister] = { player: assister, assists: 0, team_id: event.team_id };
                }
                assistStats[assister].assists++;
            });
            
            // Process yellow cards
            const yellowCardStats = {};
            events.filter(e => e.event_type === 'yellow_card').forEach(event => {
                if (!yellowCardStats[event.player_name]) {
                    yellowCardStats[event.player_name] = { player: event.player_name, cards: 0, team_id: event.team_id };
                }
                yellowCardStats[event.player_name].cards++;
            });
            
            // Process red cards
            const redCardStats = {};
            events.filter(e => e.event_type === 'red_card').forEach(event => {
                if (!redCardStats[event.player_name]) {
                    redCardStats[event.player_name] = { player: event.player_name, cards: 0, team_id: event.team_id };
                }
                redCardStats[event.player_name].cards++;
            });
            
            // Get team names
            const teamIds = [...new Set(events.map(e => e.team_id))];
            const { data: teams } = await this.supabase
                .from('teams')
                .select('id, name, short_name')
                .in('id', teamIds);
            
            const teamMap = {};
            teams?.forEach(t => { teamMap[t.id] = t; });
            
            // Add team names to stats
            const addTeamNames = (stats) => {
                return Object.values(stats).map(s => ({
                    ...s,
                    team_name: teamMap[s.team_id]?.short_name || 'Unknown'
                }));
            };
            
            return {
                topScorers: addTeamNames(goalStats).sort((a, b) => b.goals - a.goals).slice(0, 10),
                topAssisters: addTeamNames(assistStats).sort((a, b) => b.assists - a.assists).slice(0, 10),
                yellowCards: addTeamNames(yellowCardStats).sort((a, b) => b.cards - a.cards).slice(0, 10),
                redCards: addTeamNames(redCardStats).sort((a, b) => b.cards - a.cards).slice(0, 10)
            };
        } catch (error) {
            console.error('Error loading player statistics:', error);
            return { topScorers: [], topAssisters: [], yellowCards: [], redCards: [] };
        }
    }

    renderLeagueTable(standings, stats) {
        const container = document.getElementById('leagueStandings');
        if (standings.length === 0) {
            container.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><h3>No standings data available</h3><p style="color: var(--text-secondary);">Matches need to be completed to generate standings.</p></div>';
            return;
        }
        
        container.innerHTML = `
            <div class="standings-table-wrapper">
                <h3 style="margin-bottom: 1rem;">League Table</h3>
                <div class="table-container">
                    <table class="standings-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Team</th>
                                <th class="center">P</th>
                                <th class="center">W</th>
                                <th class="center">D</th>
                                <th class="center">L</th>
                                <th class="center">GF</th>
                                <th class="center">GA</th>
                                <th class="center">GD</th>
                                <th class="center">Pts</th>
                                <th>Form</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${standings.map((team, index) => `
                                <tr>
                                    <td class="position">${index + 1}</td>
                                    <td>
                                        <div class="team-cell">
                                            <div class="team-logo-tiny">${team.team.logo_url || '⚽'}</div>
                                            <span class="team-name">${team.team.name}</span>
                                        </div>
                                    </td>
                                    <td class="center">${team.played}</td>
                                    <td class="center">${team.won}</td>
                                    <td class="center">${team.drawn}</td>
                                    <td class="center">${team.lost}</td>
                                    <td class="center">${team.goals_for}</td>
                                    <td class="center">${team.goals_against}</td>
                                    <td class="center">${team.goal_difference >= 0 ? '+' : ''}${team.goal_difference}</td>
                                    <td class="center" style="font-weight: 700; color: var(--primary-color);">${team.points}</td>
                                    <td>${this.renderForm(team.form)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Player Statistics Section -->
            <div style="margin-top: 3rem;">
                <h3 style="margin-bottom: 1.5rem;">Player Statistics</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    
                    <!-- Top Scorers -->
                    <div class="card">
                        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            ⚽ Top Scorers
                        </h4>
                        ${stats.topScorers.length === 0 ? '<p style="color: var(--text-secondary);">No goals scored yet</p>' : `
                            <table style="width: 100%;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color);">
                                        <th style="text-align: left; padding: 0.5rem 0;">#</th>
                                        <th style="text-align: left; padding: 0.5rem;">Player</th>
                                        <th style="text-align: left; padding: 0.5rem;">Team</th>
                                        <th style="text-align: center; padding: 0.5rem;">Goals</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stats.topScorers.map((p, i) => `
                                        <tr style="border-bottom: 1px solid var(--border-light);">
                                            <td style="padding: 0.75rem 0; font-weight: 600;">${i + 1}</td>
                                            <td style="padding: 0.75rem 0.5rem;">${p.player}</td>
                                            <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">${p.team_name}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: var(--primary-color);">${p.goals}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                    
                    <!-- Top Assisters -->
                    <div class="card">
                        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            🎯 Top Assisters
                        </h4>
                        ${stats.topAssisters.length === 0 ? '<p style="color: var(--text-secondary);">No assists recorded yet</p>' : `
                            <table style="width: 100%;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color);">
                                        <th style="text-align: left; padding: 0.5rem 0;">#</th>
                                        <th style="text-align: left; padding: 0.5rem;">Player</th>
                                        <th style="text-align: left; padding: 0.5rem;">Team</th>
                                        <th style="text-align: center; padding: 0.5rem;">Assists</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stats.topAssisters.map((p, i) => `
                                        <tr style="border-bottom: 1px solid var(--border-light);">
                                            <td style="padding: 0.75rem 0; font-weight: 600;">${i + 1}</td>
                                            <td style="padding: 0.75rem 0.5rem;">${p.player}</td>
                                            <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">${p.team_name}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: var(--primary-color);">${p.assists}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                    
                    <!-- Yellow Cards -->
                    <div class="card">
                        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            🟨 Disciplinary (Yellow)
                        </h4>
                        ${stats.yellowCards.length === 0 ? '<p style="color: var(--text-secondary);">No yellow cards yet</p>' : `
                            <table style="width: 100%;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color);">
                                        <th style="text-align: left; padding: 0.5rem 0;">#</th>
                                        <th style="text-align: left; padding: 0.5rem;">Player</th>
                                        <th style="text-align: left; padding: 0.5rem;">Team</th>
                                        <th style="text-align: center; padding: 0.5rem;">Cards</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stats.yellowCards.map((p, i) => `
                                        <tr style="border-bottom: 1px solid var(--border-light);">
                                            <td style="padding: 0.75rem 0; font-weight: 600;">${i + 1}</td>
                                            <td style="padding: 0.75rem 0.5rem;">${p.player}</td>
                                            <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">${p.team_name}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #ffd700;">${p.cards}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                    
                    <!-- Red Cards -->
                    <div class="card">
                        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            🟥 Disciplinary (Red)
                        </h4>
                        ${stats.redCards.length === 0 ? '<p style="color: var(--text-secondary);">No red cards yet</p>' : `
                            <table style="width: 100%;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color);">
                                        <th style="text-align: left; padding: 0.5rem 0;">#</th>
                                        <th style="text-align: left; padding: 0.5rem;">Player</th>
                                        <th style="text-align: left; padding: 0.5rem;">Team</th>
                                        <th style="text-align: center; padding: 0.5rem;">Cards</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stats.redCards.map((p, i) => `
                                        <tr style="border-bottom: 1px solid var(--border-light);">
                                            <td style="padding: 0.75rem 0; font-weight: 600;">${i + 1}</td>
                                            <td style="padding: 0.75rem 0.5rem;">${p.player}</td>
                                            <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">${p.team_name}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: var(--color-live);">${p.cards}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                    
                </div>
            </div>
        `;
    }

    renderForm(form) {
        if (!form) return '<div class="form"></div>';
        return `<div class="form">${form.split('').slice(-5).map(result => 
            `<div class="form-result ${result}">${result}</div>`
        ).join('')}</div>`;
    }

    async loadCupStandings() {
        if (!this.supabase || !this.currentCup) return;
        const container = document.getElementById('cupStandings');
        container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';
        
        try {
            const { data, error } = await this.supabase
                .from('cup_groups')
                .select('*, team:teams(*)')
                .eq('competition_id', this.currentCup)
                .order('group_name')
                .order('points', { ascending: false });
            if (error) throw error;
            
            // Load player statistics for this competition
            const stats = await this.loadPlayerStatistics(this.currentCup);
            
            this.renderCupGroups(data || [], stats);
        } catch (error) {
            console.error('Error loading cup standings:', error);
            container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--color-live);">⚠️ Failed to load cup standings</p></div>';
        }
    }

    renderCupGroups(groups, stats) {
        const container = document.getElementById('cupStandings');
        if (groups.length === 0) {
            container.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><h3>No cup data available</h3></div>';
            return;
        }
        
        const groupedData = {};
        groups.forEach(team => {
            if (!groupedData[team.group_name]) groupedData[team.group_name] = [];
            groupedData[team.group_name].push(team);
        });
        
        container.innerHTML = `
            <div class="cup-groups">
                ${Object.keys(groupedData).map(groupName => `
                    <div class="group-card">
                        <div class="group-header">Group ${groupName}</div>
                        <table class="standings-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Team</th>
                                    <th class="center">P</th>
                                    <th class="center">W</th>
                                    <th class="center">D</th>
                                    <th class="center">L</th>
                                    <th class="center">GD</th>
                                    <th class="center">Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groupedData[groupName].map((team, i) => `
                                    <tr>
                                        <td class="position">${i + 1}</td>
                                        <td>
                                            <div class="team-cell">
                                                <div class="team-logo-tiny">${team.team.logo_url || '⚽'}</div>
                                                <span class="team-name">${team.team.name}</span>
                                            </div>
                                        </td>
                                        <td class="center">${team.played}</td>
                                        <td class="center">${team.won}</td>
                                        <td class="center">${team.drawn}</td>
                                        <td class="center">${team.lost}</td>
                                        <td class="center">${team.goal_difference >= 0 ? '+' : ''}${team.goal_difference}</td>
                                        <td class="center" style="font-weight: 700; color: var(--primary-color);">${team.points}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
            
            <!-- Player Statistics for Cup -->
            <div style="margin-top: 3rem;">
                <h3 style="margin-bottom: 1.5rem;">Player Statistics</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    ${this.renderPlayerStats(stats)}
                </div>
            </div>
        `;
    }

    renderPlayerStats(stats) {
    const container = document.getElementById('player-stats-content');
    
    const renderSection = (title, data, type, icon) => {
        const badgeClass = type === 'goals' ? 'goals' : (type === 'yellow' ? 'yellow' : 'red');
        
        return `
            <div class="card" style="border:none; background:transparent;">
                <h3 style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;">
                    ${icon} ${title}
                </h3>
                <div class="stats-list">
                    ${data.length === 0 ? '<p>No data available</p>' : data.slice(0, 5).map((p, i) => `
                        <div class="player-stat-row">
                            <div class="stat-rank">#${i + 1}</div>
                            <div class="stat-player-info">
                                <span class="stat-player-name">${p.player}</span>
                                <span class="stat-team-name">${p.team_name}</span>
                            </div>
                            <div class="stat-value-badge ${badgeClass}">
                                ${type === 'goals' ? p.goals : p.cards}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="stats-card-container">
            ${renderSection('Top Scorers', stats.topScorers, 'goals', '⚽')}
            ${renderSection('Yellow Cards', stats.yellowCards, 'yellow', '🟨')}
            ${renderSection('Red Cards', stats.redCards, 'red', '🟥')}
        </div>
    `;
}
}

document.addEventListener('DOMContentLoaded', () => {
    window.standingsManager = new StandingsManager();
});