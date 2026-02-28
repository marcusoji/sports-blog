// Standings JavaScript - League Tables and Cup Groups
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
            this.renderLeagueTable(data || []);
        } catch (error) {
            console.error('Error loading standings:', error);
            container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--color-live);">⚠️ Failed to load standings</p></div>';
        }
    }

    renderLeagueTable(standings) {
        const container = document.getElementById('leagueStandings');
        if (standings.length === 0) {
            container.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><h3>No standings data available</h3><p style="color: var(--text-secondary);">Matches need to be completed to generate standings.</p></div>';
            return;
        }
        
        container.innerHTML = `
            <div class="standings-table-wrapper">
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
            this.renderCupGroups(data || []);
        } catch (error) {
            console.error('Error loading cup standings:', error);
            container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--color-live);">⚠️ Failed to load cup standings</p></div>';
        }
    }

    renderCupGroups(groups) {
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
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.standingsManager = new StandingsManager();
});
