// Complete Admin Dashboard - All Functions Working
// Match Management, Team Management, Blog, Statistics, Events

class AdminDashboard {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.currentSection = 'dashboard';
        this.init();
    }

    async init() {
    // Check if another script (like main.js) already initialized supabase
    if (!this.supabase) {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        }
    }
        await this.checkAuth();
        this.setupNavigation();
        this.setupLogout();
        this.setupKeyboardShortcuts();
        this.setupModalHandlers();
        await this.loadStats();
        await this.loadUserInfo();
        // Add this to your init() method in admin-dashboard.js
    }

    async checkAuth() {
        if (!this.supabase) { window.location.href = '/admin/'; return; }
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (error || !session || !session.user) { window.location.href = '/admin/'; return; }
            const { data: adminUser, error: adminError } = await this.supabase.from('admin_users').select('id,username,email,role').eq('email', session.user.email).single();
            if (adminError || !adminUser) { await this.supabase.auth.signOut(); window.location.href = '/admin/'; return; }
            this.currentUser = { ...adminUser, supabase_id: session.user.id };
            await this.logActivity('dashboard_access', 'admin_session', null, { username: adminUser.username });
        } catch (error) { console.error('Auth check failed:', error); window.location.href = '/admin/'; }
    }

    async loadUserInfo() {
        if (this.currentUser) document.getElementById('adminUsername').textContent = `${this.currentUser.username}`;
    }

    setupNavigation() {
        document.querySelectorAll('.admin-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.navigateToSection(section, link);
            });
        });
    }

    navigateToSection(section, linkElement) {
        document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
        if (linkElement) linkElement.classList.add('active');
        this.currentSection = section;
        this.loadSectionContent(section);
    }

    async loadSectionContent(section) {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';
        setTimeout(async () => {
            switch (section) {
                case 'dashboard': await this.renderDashboard(); break;
                case 'blog': await this.renderBlogSection(); break;
                case 'matches': await this.renderMatchesSection(); break;
                case 'teams': await this.renderTeamsSection(); break;
                case 'activity': await this.renderActivityLog(); break;
                default: container.innerHTML = `<div class="content-section"><h2>${section}</h2><p>Section ready</p></div>`;
            }
        }, 300);
    }

    async renderDashboard() {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = `
            <div class="content-section">
                <h2>Quick Actions</h2>
                <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem;">
                    <button class="btn btn-primary" onclick="adminDashboard.showMatchForm()">+ New Match</button>
                    <button class="btn btn-primary" onclick="adminDashboard.showTeamForm()">+ New Team</button>
                    <button class="btn btn-primary" onclick="adminDashboard.showBlogForm()">+ New Blog Post</button>
                </div>
            </div>`;
    }

    async renderBlogSection() {
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase.from('blog_posts').select('*').order('published_date', { ascending: false }).limit(20);
            if (error) throw error;
            container.innerHTML = `
                <div class="content-section">
                    <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                        <h2>Blog Posts</h2>
                        <button class="btn btn-primary" onclick="adminDashboard.showBlogForm()">+ New Post</button>
                    </div>
                    ${data.length === 0 ? '<p>No blog posts yet</p>' : `
                        <div style="display:grid;gap:1rem;">
                            ${data.map(post => `
                                <div class="blog-post-card" style="display:flex;gap:1rem;padding:1rem;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color);">
                                    ${post.featured_image ? `
                                        <img src="${post.featured_image}" alt="${this.escapeHtml(post.title)}" style="width:120px;height:120px;object-fit:cover;border-radius:var(--radius-md);">
                                    ` : `
                                        <div style="width:120px;height:120px;background:var(--bg-secondary);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:3rem;">📝</div>
                                    `}
                                    <div style="flex:1;">
                                        <h3 style="margin:0 0 0.5rem 0;">${this.escapeHtml(post.title)}</h3>
                                        <p style="color:var(--text-secondary);font-size:0.875rem;margin:0 0 0.5rem 0;">${this.escapeHtml(post.excerpt || '').substring(0, 100)}...</p>
                                        <div style="display:flex;gap:1rem;align-items:center;font-size:0.875rem;color:var(--text-tertiary);">
                                            <span>${this.escapeHtml(post.author || 'Unknown')}</span>
                                            <span>•</span>
                                            <span>${this.formatDate(post.published_date)}</span>
                                            <span class="badge">${post.status}</span>
                                        </div>
                                    </div>
                                    <div style="display:flex;flex-direction:column;gap:0.5rem;">
                                        <button class="btn-small" onclick="adminDashboard.editBlog('${post.id}')">Edit</button>
                                        <button class="btn-small" onclick="adminDashboard.deleteBlog('${post.id}')">Delete</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>`;
        } catch (error) { console.error('Error loading blog posts:', error); container.innerHTML = '<div class="content-section"><p style="color:var(--color-live);">Failed to load blog posts</p></div>'; }
    }

    async deleteBlog(blogId) {
        if (!confirm('Delete this blog post? This will also delete the associated image.')) return;
        try {
            // Get blog post data to find image
            const { data: post } = await this.supabase.from('blog_posts').select('featured_image').eq('id', blogId).single();
            
            // Delete from database
            const { error } = await this.supabase.from('blog_posts').delete().eq('id', blogId);
            if (error) throw error;
            
            // Delete image from storage if exists
            if (post?.featured_image) {
                await this.deleteImageFromStorage(post.featured_image);
            }
            
            this.showToast('success', 'Deleted', 'Blog post deleted successfully');
            await this.renderBlogSection();
        } catch (error) {
            console.error('Error deleting blog:', error);
            this.showToast('error', 'Error', 'Failed to delete post');
        }
    }

    async deleteImageFromStorage(imageUrl) {
        try {
            // Extract filepath from URL
            const urlParts = imageUrl.split('/blog-images/');
            if (urlParts.length === 2) {
                const filepath = urlParts[1];
                await this.supabase.storage.from('blog-images').remove([filepath]);
            }
        } catch (error) {
            console.error('Error deleting image from storage:', error);
        }
    }
calculateMatchTime(matchDate, status) {
    if (status === 'ht') return "HT";
    if (status !== 'live' || !matchDate) return status;

    const kickoff = new Date(matchDate).getTime();
    const now = Date.now();
    const elapsedMinutes = Math.floor((now - kickoff) / 60000);

    if (elapsedMinutes >= 45 && elapsedMinutes < 50) return "45+"; 
    if (elapsedMinutes >= 90) return "90+"; 
    
    return Math.max(0, elapsedMinutes) + "'";
}
    async renderMatchesSection() {
        
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase.from('matches').select(`*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name),competition:competitions(name)`).order('match_date', { ascending: false }).limit(20);
            if (error) throw error;
            // Add this at the end of renderMatchesSection()
if (this.timerInterval) clearInterval(this.timerInterval);
this.timerInterval = setInterval(() => {
    const badges = document.querySelectorAll('.badge-live');
    badges.forEach(badge => {
        // This regex finds the number inside "LIVE 22'"
        const currentText = badge.innerText;
        const match = currentText.match(/\d+/);
        if (match) {
            const newMin = parseInt(match[0]) + 1;
            badge.innerText = `LIVE ${newMin}'`;
        }
    });
}, 60000); // Update the text every minute
           
            container.innerHTML = `
                <div class="content-section">
                    <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                        <h2>Matches</h2>
                        <button class="btn btn-primary" onclick="adminDashboard.showMatchForm()">+ New Match</button>
                    </div>
                    ${data.length === 0 ? '<p>No matches yet</p>' : `
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Match</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
// Update the <tbody> section to this:
<tbody>${data.map(match => {
    // We call the helper we just added
    const matchTime = this.calculateMatchTime(match.match_date, match.status);
    
    const timeDisplay = match.status === 'live' || match.status === 'ht' 
        ? `<span class="badge badge-live">${matchTime}</span>` 
        : `<span class="badge">${match.status}</span>`;

    return `
        <tr>
            <td>${this.formatDate(match.match_date)}</td>
            <td>${match.home_team.name} vs ${match.away_team.name}</td>
            <td>${match.home_score || 0} - ${match.away_score || 0}</td>
            <td>${timeDisplay}</td>
            <td>
                <button class="btn-small" onclick="adminDashboard.manageMatch('${match.id}')">Manage</button>
            </td>
        </tr>
    `;
}).join('')}</tbody>                       
 </table>
                    `}
                    
                </div>`;
        } catch (error) { console.error('Error loading matches:', error); container.innerHTML = '<div class="content-section"><p style="color:var(--color-live);">Failed to load matches</p></div>'; }
    }

    async renderTeamsSection() {
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase.from('teams').select('*').order('name', { ascending: true });
            if (error) throw error;
            container.innerHTML = `
                <div class="content-section">
                    <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                        <h2>Teams</h2>
                        <button class="btn btn-primary" onclick="adminDashboard.showTeamForm()">+ New Team</button>
                    </div>
                    ${data.length === 0 ? '<p>No teams yet</p>' : `
                        <table class="data-table">
                            <thead><tr><th>Name</th><th>Short Name</th><th>Faculty</th><th>Level</th><th>Actions</th></tr></thead>
                            <tbody>${data.map(team => `
                                <tr>
                                    <td>${this.escapeHtml(team.name)}</td>
                                    <td>${this.escapeHtml(team.short_name)}</td>
                                    <td>${this.escapeHtml(team.faculty || '-')}</td>
                                    <td>${this.escapeHtml(team.level || '-')}</td>
                                    <td>
                                        <button class="btn-small" onclick="adminDashboard.editTeam('${team.id}')">Edit</button>
                                        <button class="btn-small" onclick="adminDashboard.deleteTeam('${team.id}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}</tbody>
                        </table>
                    `}
                </div>`;
        } catch (error) { console.error('Error loading teams:', error); }
    }

    async renderActivityLog() {
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase.from('activity_logs').select('*, admin:admin_users(username)').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            container.innerHTML = `
                <div class="content-section">
                    <h2>Activity Log</h2>
                    ${data.length === 0 ? '<p>No activity logged yet</p>' : `
                        <div style="margin-top:1.5rem;">${data.map(log => `
                            <div style="padding:1rem;border-bottom:1px solid var(--border-light);">
                                <div style="font-weight:600;">${this.escapeHtml(log.admin?.username || 'Unknown')} - ${log.action}</div>
                                <div style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.25rem;">${this.formatDateTime(log.created_at)}</div>
                            </div>
                        `).join('')}</div>
                    `}
                </div>`;
        } catch (error) { console.error('Error loading activity log:', error); }
    }

    // MATCH MANAGEMENT FORMS
    async showMatchForm(matchId = null) {
        const { data: teams } = await this.supabase.from('teams').select('id,name').order('name');
        const { data: competitions } = await this.supabase.from('competitions').select('id,name').order('name');
        
        this.showModal('Create New Match', `
            <form id="matchForm" style="display:grid;gap:1rem;">
                <div><label class="form-label">Competition</label><select id="competition_id" class="form-input" required>${competitions.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <div><label class="form-label">Home Team</label><select id="home_team_id" class="form-input" required>${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
                <div><label class="form-label">Away Team</label><select id="away_team_id" class="form-input" required>${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
                <div><label class="form-label">Match Date & Time</label><input type="datetime-local" id="match_date" class="form-input" required></div>
                <div><label class="form-label">Venue</label><input type="text" id="venue" class="form-input" placeholder="Stadium name"></div>
                <div><label class="form-label">Status</label><select id="status" class="form-input"><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="finished">Finished</option></select></div>
                <div><label class="form-label">Match Duration (minutes)</label><input type="number" id="match_duration" class="form-input" value="90" min="30" max="120"></div>
                <button type="submit" class="btn btn-primary">Create Match</button>
            </form>
        `);
        
        document.getElementById('matchForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveMatch();
        });
    }

    async saveMatch() {
        try {
            const matchData = {
                competition_id: document.getElementById('competition_id').value,
                home_team_id: document.getElementById('home_team_id').value,
                away_team_id: document.getElementById('away_team_id').value,
                match_date: document.getElementById('match_date').value,
                venue: document.getElementById('venue').value,
                status: document.getElementById('status').value,
                match_duration: parseInt(document.getElementById('match_duration').value) || 90,
                home_score: 0,
                away_score: 0,
                match_time: 0
            };
            
            const { data, error } = await this.supabase.from('matches').insert([matchData]).select();
            if (error) throw error;
            
            this.showToast('success', 'Success', 'Match created successfully!');
            this.closeModal();
            await this.renderMatchesSection();
            await this.logActivity('create', 'match', data[0].id, matchData);
        } catch (error) {
            console.error('Error creating match:', error);
            this.showToast('error', 'Error', 'Failed to create match');
        }
    }

    async manageMatch(matchId) {
        const { data: match } = await this.supabase.from('matches').select(`*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)`).eq('id', matchId).single();
        const { data: events } = await this.supabase.from('match_events').select('*').eq('match_id', matchId).order('event_minute', { ascending: false });
        
        this.showModal(`Manage: ${match.home_team.name} vs ${match.away_team.name}`, `
            <div style="display:grid;gap:1rem;">
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;text-align:center;padding:1.5rem;background:var(--bg-secondary);border-radius:var(--radius-md);">
                    <div><h3>${match.home_team.name}</h3><div style="font-size:3rem;font-weight:700;">${match.home_score || 0}</div></div>
                    <div style="display:flex;align-items:center;font-size:2rem;">:</div>
                    <div><h3>${match.away_team.name}</h3><div style="font-size:3rem;font-weight:700;">${match.away_score || 0}</div></div>
                </div>
                
// Find this section inside your manageMatch() function and replace the buttons:
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
    <button class="btn btn-primary" onclick="adminDashboard.addGoal('${matchId}')">⚽ Goal</button>
    <button class="btn" onclick="adminDashboard.addCard('${matchId}')">🟨 Card</button>
    
    ${match.status === 'live' ? `
        <button class="btn btn-secondary" onclick="adminDashboard.setHalfTime('${matchId}')">⏸️ End 1st Half</button>
    ` : ''}

    ${match.status === 'ht' ? `
        <button class="btn btn-primary" onclick="adminDashboard.startSecondHalf('${matchId}')">▶️ Start 2nd Half</button>
    ` : ''}

    <button class="btn" onclick="adminDashboard.endMatchNow('${matchId}')">🏁 End Match</button>
</div>
                <div><h3>Match Events</h3><div style="margin-top:1rem;max-height:300px;overflow-y:auto;">${events.length === 0 ? '<p style="color:var(--text-secondary);">No events yet</p>' : events.map(e => `
                    <div style="padding:0.75rem;background:var(--bg-card);margin-bottom:0.5rem;border-radius:var(--radius-md);display:flex;justify-content:space-between;">
                        <span>${e.event_type === 'goal' ? '⚽' : '🟨'} ${e.player_name} - ${e.event_minute}'</span>
                        <button class="btn-small" onclick="adminDashboard.deleteEvent('${e.id}')">❌</button>
                    </div>
                `).join('')}</div></div>
            </div>
        `);
    }

    async addGoal(matchId) {
        const { data: match } = await this.supabase.from('matches').select(`*,home_team:teams!matches_home_team_id_fkey(id,name),away_team:teams!matches_away_team_id_fkey(id,name)`).eq('id', matchId).single();
        
        this.showModal('Add Goal', `
            <form id="goalForm" style="display:grid;gap:1rem;">
                <div><label class="form-label">Team</label><select id="goal_team" class="form-input" required>
                    <option value="${match.home_team.id}">${match.home_team.name}</option>
                    <option value="${match.away_team.id}">${match.away_team.name}</option>
                </select></div>
                <div><label class="form-label">Player Name</label><input type="text" id="player_name" class="form-input" required placeholder="Enter player name"></div>
                <div><label class="form-label">Minute</label><input type="number" id="goal_minute" class="form-input" required min="1" max="120" value="${match.match_time || 1}"></div>
                <div><label class="form-label">Assist (optional)</label><input type="text" id="assist" class="form-input" placeholder="Player who assisted"></div>
                <button type="submit" class="btn btn-primary">Add Goal</button>
            </form>
        `);
        
        document.getElementById('goalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const assist = document.getElementById('assist').value;
                await this.supabase.from('match_events').insert([{
                    match_id: matchId,
                    team_id: document.getElementById('goal_team').value,
                    player_name: document.getElementById('player_name').value,
                    event_type: 'goal',
                    event_minute: parseInt(document.getElementById('goal_minute').value),
                    details: assist ? { assist: assist } : {}
                }]);
                this.showToast('success', 'Goal Added', '⚽ Goal recorded successfully!');
                this.closeModal();
                await this.renderMatchesSection();
            } catch (error) { console.error('Error adding goal:', error); this.showToast('error', 'Error', 'Failed to add goal'); }
        });
    }

    async addCard(matchId) {
        const { data: match } = await this.supabase.from('matches').select(`*,home_team:teams!matches_home_team_id_fkey(id,name),away_team:teams!matches_away_team_id_fkey(id,name)`).eq('id', matchId).single();
        
        this.showModal('Add Card', `
            <form id="cardForm" style="display:grid;gap:1rem;">
                <div><label class="form-label">Team</label><select id="card_team" class="form-input" required>
                    <option value="${match.home_team.id}">${match.home_team.name}</option>
                    <option value="${match.away_team.id}">${match.away_team.name}</option>
                </select></div>
                <div><label class="form-label">Player Name</label><input type="text" id="card_player" class="form-input" required></div>
                <div><label class="form-label">Card Type</label><select id="card_type" class="form-input" required>
                    <option value="yellow_card">Yellow Card</option>
                    <option value="red_card">Red Card</option>
                </select></div>
                <div><label class="form-label">Minute</label><input type="number" id="card_minute" class="form-input" required min="1" max="120" value="${match.match_time || 1}"></div>
                <button type="submit" class="btn btn-primary">Add Card</button>
            </form>
        `);
        
        document.getElementById('cardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await this.supabase.from('match_events').insert([{
                    match_id: matchId,
                    team_id: document.getElementById('card_team').value,
                    player_name: document.getElementById('card_player').value,
                    event_type: document.getElementById('card_type').value,
                    event_minute: parseInt(document.getElementById('card_minute').value)
                }]);
                this.showToast('success', 'Card Added', 'Card recorded successfully!');
                this.closeModal();
            } catch (error) { console.error('Error adding card:', error); this.showToast('error', 'Error', 'Failed to add card'); }
        });
    }

    async startMatch(matchId) {
        if (!confirm('Start this match now?')) return;
        try {
            await this.supabase.from('matches').update({ status: 'live', match_date: new Date().toISOString(), match_time: 0 }).eq('id', matchId);
            this.showToast('success', 'Match Started', '▶️ Match is now live!');
            this.closeModal();
            await this.renderMatchesSection();
        } catch (error) { console.error('Error starting match:', error); }
    }

    async endMatchNow(matchId) {
        if (!confirm('End this match?')) return;
        try {
            await this.supabase.from('matches').update({ status: 'finished' }).eq('id', matchId);
            this.showToast('success', 'Match Ended', '🏁 Match finished!');
            this.closeModal();
            await this.renderMatchesSection();
        } catch (error) { console.error('Error ending match:', error); }
    }
// Add these to your manageMatch button logic
async setHalfTime(matchId) {
    // This stops the clock and keeps the match visible
    const { error } = await this.supabase
        .from('matches')
        .update({ status: 'ht' })
        .eq('id', matchId);
    
    if (!error) {
        this.showToast('success', 'Half Time', 'Clock paused at HT');
        this.renderMatchesSection();
    }
}

async startSecondHalf(matchId) {
    if (!confirm('Start second half? Timer will resume from 45\'.')) return;
    
    // Logic: Set match_date to exactly 45 minutes ago so the timer starts at 45'
    const fortyFiveMinsAgo = new Date(Date.now() - (45 * 60 * 1000)).toISOString();
    
    const { error } = await this.supabase
        .from('matches')
        .update({ 
            status: 'live', 
            match_date: fortyFiveMinsAgo 
        })
        .eq('id', matchId);

    if (!error) {
        this.showToast('success', 'Live', 'Second half started');
        this.closeModal();
        this.renderMatchesSection();
    }
}  
async deleteEvent(eventId) {
        if (!confirm('Delete this event?')) return;
        try {
            await this.supabase.from('match_events').delete().eq('id', eventId);
            this.showToast('success', 'Deleted', 'Event deleted');
            this.closeModal();
        } catch (error) { console.error('Error deleting event:', error); }
    }

    // TEAM MANAGEMENT
    async showTeamForm(teamId = null) {
        let team = null;
        
        // If editing, load team data
        if (teamId) {
            const { data, error } = await this.supabase.from('teams').select('*').eq('id', teamId).single();
            if (error) {
                this.showToast('error', 'Error', 'Failed to load team data');
                return;
            }
            team = data;
        }
        
        this.showModal(team ? 'Edit Team' : 'Create New Team', `
            <form id="teamForm" style="display:grid;gap:1rem;">
                <div><label class="form-label">Team Name</label><input type="text" id="team_name" class="form-input" required placeholder="Full team name" value="${team ? this.escapeHtml(team.name) : ''}"></div>
                <div><label class="form-label">Short Name</label><input type="text" id="team_short" class="form-input" required placeholder="3-4 letters" maxlength="4" value="${team ? this.escapeHtml(team.short_name) : ''}"></div>
                <div><label class="form-label">Faculty</label><input type="text" id="team_faculty" class="form-input" placeholder="Engineering, Science, etc." value="${team?.faculty ? this.escapeHtml(team.faculty) : ''}"></div>
                <div><label class="form-label">Department</label><input type="text" id="team_dept" class="form-input" placeholder="Computer Science, etc." value="${team?.department ? this.escapeHtml(team.department) : ''}"></div>
                <div><label class="form-label">Level</label><select id="team_level" class="form-input">
                    <option value="">Select level</option>
                    <option value="level 1" ${team?.level === 'level 1' ? 'selected' : ''}>Level 1</option>
                    <option value="level 2" ${team?.level === 'level 2' ? 'selected' : ''}>Level 2</option>
                    <option value="level 3" ${team?.level === 'level 3' ? 'selected' : ''}>Level 3</option>
                    <option value="level 4" ${team?.level === 'level 4' ? 'selected' : ''}>Level 4</option>
                </select></div>
                <button type="submit" class="btn btn-primary">${team ? 'Update Team' : 'Create Team'}</button>
            </form>
        `);
        
        document.getElementById('teamForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveTeam(teamId);
        });
    }

    async saveTeam(teamId = null) {
        try {
            const teamData = {
                name: document.getElementById('team_name').value,
                short_name: document.getElementById('team_short').value.toUpperCase(),
                faculty: document.getElementById('team_faculty').value || null,
                department: document.getElementById('team_dept').value || null,
                level: document.getElementById('team_level').value || null
            };
            
            if (teamId) {
                // Update existing team
                const { error } = await this.supabase.from('teams').update(teamData).eq('id', teamId);
                if (error) throw error;
                this.showToast('success', 'Success', 'Team updated!');
                await this.logActivity('update', 'team', teamId, teamData);
            } else {
                // Create new team
                const { error } = await this.supabase.from('teams').insert([teamData]);
                if (error) throw error;
                this.showToast('success', 'Success', 'Team created!');
                await this.logActivity('create', 'team', null, teamData);
            }
            
            this.closeModal();
            await this.renderTeamsSection();
        } catch (error) { 
            console.error('Error saving team:', error); 
            this.showToast('error', 'Error', 'Failed to save team'); 
        }
    }

    async editTeam(teamId) {
        await this.showTeamForm(teamId);
    }

    async deleteTeam(teamId) {
        if (!confirm('Delete this team? This action cannot be undone.')) return;
        
        try {
            const { error } = await this.supabase.from('teams').delete().eq('id', teamId);
            if (error) throw error;
            
            this.showToast('success', 'Deleted', 'Team deleted successfully');
            await this.logActivity('delete', 'team', teamId);
            await this.renderTeamsSection();
        } catch (error) {
            console.error('Error deleting team:', error);
            if (error.message.includes('foreign key')) {
                this.showToast('error', 'Error', 'Cannot delete team - it has associated matches');
            } else {
                this.showToast('error', 'Error', 'Failed to delete team');
            }
        }
    }

    // BLOG MANAGEMENT
    async showBlogForm() {
        this.showModal('Create Blog Post', `
            <form id="blogForm" style="display:grid;gap:1rem;">
                <div><label class="form-label">Title</label><input type="text" id="blog_title" class="form-input" required></div>
                <div><label class="form-label">Slug</label><input type="text" id="blog_slug" class="form-input" required placeholder="url-friendly-title"></div>
                <div><label class="form-label">Author</label><input type="text" id="blog_author" class="form-input" value="${this.currentUser.username}"></div>
                <div><label class="form-label">Excerpt</label><textarea id="blog_excerpt" class="form-input" rows="2" required></textarea></div>
                <div><label class="form-label">Content</label><textarea id="blog_content" class="form-input" rows="6" required></textarea></div>
                
                <!-- Image Upload Section -->
                <div style="border-top:1px solid var(--border-color);padding-top:1rem;">
                    <label class="form-label">Featured Image</label>
                    <input type="file" id="blog_image" class="form-input" accept="image/jpeg,image/png,image/gif,image/webp">
                    <p style="font-size:0.75rem;color:var(--text-tertiary);margin-top:0.25rem;">Max 5MB. Formats: JPG, PNG, GIF, WEBP</p>
                    <div id="imagePreview" style="margin-top:0.5rem;display:none;">
                        <img id="previewImg" style="max-width:200px;border-radius:var(--radius-md);">
                        <button type="button" class="btn-small" onclick="document.getElementById('blog_image').value='';document.getElementById('imagePreview').style.display='none';">Remove</button>
                    </div>
                </div>
                
                <div><label class="form-label">Status</label><select id="blog_status" class="form-input">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                </select></div>
                <button type="submit" class="btn btn-primary" id="blogSubmitBtn">Create Post</button>
            </form>
        `);
        
        // Auto-generate slug from title
        document.getElementById('blog_title').addEventListener('input', (e) => {
            document.getElementById('blog_slug').value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        });
        
        // Image preview
        document.getElementById('blog_image').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file size
                if (file.size > 5 * 1024 * 1024) {
                    this.showToast('error', 'Error', 'Image must be less than 5MB');
                    e.target.value = '';
                    return;
                }
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('previewImg').src = e.target.result;
                    document.getElementById('imagePreview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        document.getElementById('blogForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBlog();
        });
    }

    async saveBlog() {
        const submitBtn = document.getElementById('blogSubmitBtn');
        submitBtn.disabled = true;
        
        try {
            let featuredImageUrl = null;
            
            // Upload image if selected
            const imageFile = document.getElementById('blog_image').files[0];
            if (imageFile) {
                submitBtn.textContent = 'Compressing image...';
                featuredImageUrl = await this.uploadImage(imageFile, 'blog-posts');
                if (!featuredImageUrl) {
                    throw new Error('Failed to upload image');
                }
            } else {
                submitBtn.textContent = 'Creating post...';
            }
            
            const blogData = {
                title: document.getElementById('blog_title').value,
                slug: document.getElementById('blog_slug').value,
                author: document.getElementById('blog_author').value,
                excerpt: document.getElementById('blog_excerpt').value,
                content: document.getElementById('blog_content').value,
                status: document.getElementById('blog_status').value,
                published_date: new Date().toISOString(),
                featured_image: featuredImageUrl
            };
            
            const { data, error } = await this.supabase.from('blog_posts').insert([blogData]).select();
            if (error) throw error;
            
            // Track uploaded media
            if (featuredImageUrl && data[0]) {
                await this.trackMediaUpload(featuredImageUrl, imageFile, 'blog_post', data[0].id);
            }
            
            this.showToast('success', 'Success', 'Blog post created with optimized image!');
            this.closeModal();
            await this.renderBlogSection();
        } catch (error) { 
            console.error('Error creating blog post:', error); 
            this.showToast('error', 'Error', 'Failed to create post: ' + error.message); 
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Post';
        }
    }

    async uploadImage(file, folder) {
        try {
            // Compress image before uploading
            const compressedFile = await this.compressImage(file);
            
            // Generate unique filename
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const ext = file.name.split('.').pop();
            const filename = `${folder}/${timestamp}-${randomStr}.${ext}`;
            
            // Upload to Supabase Storage
            const { data, error } = await this.supabase.storage
                .from('blog-images')
                .upload(filename, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) throw error;
            
            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('blog-images')
                .getPublicUrl(filename);
            
            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('error', 'Upload Failed', error.message);
            return null;
        }
    }

    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions (max 1920px width)
                    let width = img.width;
                    let height = img.height;
                    const maxWidth = 1920;
                    const maxHeight = 1080;
                    
                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = (height / width) * maxWidth;
                            width = maxWidth;
                        } else {
                            width = (width / height) * maxHeight;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob with compression (0.8 quality = ~80% compression)
                    canvas.toBlob((blob) => {
                        // Create new file from compressed blob
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg', // Convert all to JPEG for better compression
                            lastModified: Date.now()
                        });
                        
                        // Log compression results
                        const originalSize = (file.size / 1024 / 1024).toFixed(2);
                        const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
                        const savings = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
                        console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB (${savings}% smaller)`);
                        
                        resolve(compressedFile);
                    }, 'image/jpeg', 0.8); // 0.8 = 80% quality (good balance)
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }
async editBlog(blogId) {
    try {
        const { data: post, error } = await this.supabase
            .from('blog_posts')
            .select('*')
            .eq('id', blogId)
            .single();

        if (error) throw error;

        // Show the standard form
        await this.showBlogForm();
        
        // Update Modal Title and Button
        document.getElementById('modalTitle').textContent = 'Edit Blog Post';
        const submitBtn = document.querySelector('#blogForm button[type="submit"]');
        submitBtn.textContent = 'Update Post';

        // Fill fields
        document.getElementById('blog_title').value = post.title;
        document.getElementById('blog_slug').value = post.slug;
        document.getElementById('blog_author').value = post.author;
        document.getElementById('blog_excerpt').value = post.excerpt;
        document.getElementById('blog_content').value = post.content;
        document.getElementById('blog_status').value = post.status;
        document.getElementById('blog_category').value = post.category || '';

        // Handle Image Preview if exists
        if (post.featured_image) {
            const preview = document.getElementById('imagePreview');
            document.getElementById('previewImg').src = post.featured_image;
            preview.style.display = 'block';
        }

        // Update the submit listener to handle UPDATE instead of INSERT
        const form = document.getElementById('blogForm');
        const newForm = form.cloneNode(true); // Remove old listeners
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateBlog(blogId, post.featured_image);
        });

    } catch (error) {
        this.showToast('error', 'Error', 'Could not load blog post');
    }
}

async updateBlog(blogId, existingImageUrl) {
    try {
        const file = document.getElementById('blog_image').files[0];
        let imageUrl = existingImageUrl;

        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const { data } = await this.supabase.storage.from('blog-images').upload(`blog-images/${fileName}`, file);
            const { data: { publicUrl } } = this.supabase.storage.from('blog-images').getPublicUrl(`blog-images/${fileName}`);
            imageUrl = publicUrl;
        }

        const blogData = {
            title: document.getElementById('blog_title').value,
            slug: document.getElementById('blog_slug').value,
            author: document.getElementById('blog_author').value,
            excerpt: document.getElementById('blog_excerpt').value,
            content: document.getElementById('blog_content').value,
            featured_image: imageUrl,
            status: document.getElementById('blog_status').value,
            category: document.getElementById('blog_category').value
        };

        const { error } = await this.supabase.from('blog_posts').update(blogData).eq('id', blogId);
        if (error) throw error;

        this.showToast('success', 'Updated', 'Blog post updated!');
        this.closeModal();
        await this.renderBlogSection();
    } catch (error) {
        this.showToast('error', 'Error', 'Update failed');
    }
}
    async trackMediaUpload(filepath, file, entityType, entityId) {
        try {
            await this.supabase.from('media_uploads').insert([{
                filename: file.name,
                filepath: filepath,
                mimetype: file.type,
                size_bytes: file.size,
                uploaded_by: this.currentUser.id,
                entity_type: entityType,
                entity_id: entityId
            }]);
        } catch (error) {
            console.error('Failed to track media:', error);
        }
    }

    // STATISTICS & MISC
    async loadStats() {
        if (!this.supabase) return;
        try {
            const [posts, live, fixtures, contacts] = await Promise.all([
                this.supabase.from('blog_posts').select('id', { count: 'exact', head: true }),
                this.supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'live'),
                this.supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
                this.supabase.from('contact_submissions').select('id', { count: 'exact', head: true })
            ]);
            document.getElementById('statPosts').textContent = posts.count || 0;
            document.getElementById('statLive').textContent = live.count || 0;
            document.getElementById('statFixtures').textContent = fixtures.count || 0;
            document.getElementById('statContacts').textContent = contacts.count || 0;
        } catch (error) { console.error('Error loading stats:', error); }
    }

    async logActivity(action, entityType, entityId, details) {
        if (!this.supabase || !this.currentUser) return;
        try {
            await this.supabase.from('activity_logs').insert({ admin_id: this.currentUser.id, action, entity_type: entityType, entity_id: entityId, details, ip_address: 'browser' });
        } catch (error) { console.error('Failed to log activity:', error); }
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div><strong>${this.escapeHtml(title)}</strong></div><div style="font-size:0.875rem;color:var(--text-secondary);">${this.escapeHtml(message)}</div>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'slideOutRight 0.3s ease-out'; setTimeout(() => toast.remove(), 300); }, 4000);
    }

    setupModalHandlers() {
        const modal = document.getElementById('modal');
        modal.addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    }

    showModal(title, content) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        modal.classList.add('active');
    }

    closeModal() { document.getElementById('modal').classList.remove('active'); }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); this.showMatchForm(); }
        });
    }

    setupLogout() {
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            if (!this.supabase) return;
            try {
                await this.logActivity('logout', 'admin_session', null, { username: this.currentUser?.username });
                await this.supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/admin/';
            } catch (error) { console.error('Logout error:', error); }
        });
    }

    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    formatDate(dateString) { const date = new Date(dateString); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    formatDateTime(dateString) { const date = new Date(dateString); return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}

const style = document.createElement('style');
style.textContent = `.data-table{width:100%;border-collapse:collapse;}.data-table th{text-align:left;padding:0.75rem;border-bottom:2px solid var(--border-color);font-weight:600;}.data-table td{padding:0.75rem;border-bottom:1px solid var(--border-light);}.badge{display:inline-block;padding:0.25rem 0.75rem;border-radius:var(--radius-full);font-size:0.75rem;font-weight:600;background:var(--bg-secondary);}.badge-live{background:var(--color-live);color:white;}.badge-scheduled{background:var(--accent-color);color:white;}.badge-finished{background:var(--color-finished);color:white;}`;
document.head.appendChild(style);

let adminDashboard;
document.addEventListener('DOMContentLoaded', () => { adminDashboard = new AdminDashboard(); });