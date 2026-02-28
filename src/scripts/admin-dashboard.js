// Admin Dashboard - Secure Version with proper Supabase Auth
// Includes: Toast notifications, Keyboard shortcuts, Activity logging, Lazy loading

class AdminDashboard {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.currentSection = 'dashboard';
        this.shortcuts = {};
        
        this.init();
    }

    async init() {
        // Initialize Supabase
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );
        }

        // CRITICAL: Check authentication first
        await this.checkAuth();
        
        // Setup event listeners
        this.setupNavigation();
        this.setupLogout();
        this.setupKeyboardShortcuts();
        this.setupModalHandlers();
        
        // Load initial data
        await this.loadStats();
        await this.loadUserInfo();
    }

    // SECURE AUTHENTICATION CHECK
    async checkAuth() {
        if (!this.supabase) {
            this.showToast('error', 'System Error', 'Database connection unavailable');
            window.location.href = '/admin/';
            return;
        }

        try {
            // Get current session from Supabase
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) throw error;
            
            if (!session || !session.user) {
                // No valid session, redirect to login
                console.error('No active session');
                window.location.href = '/admin/';
                return;
            }

            // Verify user is actually in admin_users table
            const { data: adminUser, error: adminError } = await this.supabase
                .from('admin_users')
                .select('id, username, email, role')
                .eq('email', session.user.email)
                .single();
            
            if (adminError || !adminUser) {
                // Not an admin, sign out and redirect
                console.error('User not authorized as admin');
                await this.supabase.auth.signOut();
                window.location.href = '/admin/';
                return;
            }
            
            // Valid admin user
            this.currentUser = {
                ...adminUser,
                supabase_id: session.user.id
            };
            
            console.log('✅ Authenticated as admin:', adminUser.username);
            
            // Log this session
            await this.logActivity('dashboard_access', 'admin_session', null, {
                username: adminUser.username,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showToast('error', 'Auth Error', 'Authentication verification failed');
            window.location.href = '/admin/';
        }
    }

    async loadUserInfo() {
        if (this.currentUser) {
            document.getElementById('adminUsername').textContent = `Welcome, ${this.currentUser.username}`;
        }
    }

    // NAVIGATION
    setupNavigation() {
        const navLinks = document.querySelectorAll('.admin-nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.navigateToSection(section, link);
            });
        });
    }

    navigateToSection(section, linkElement) {
        // Update active state
        document.querySelectorAll('.admin-nav-link').forEach(link => {
            link.classList.remove('active');
        });
        if (linkElement) {
            linkElement.classList.add('active');
        }

        // Update current section
        this.currentSection = section;

        // Load section content
        this.loadSectionContent(section);
    }

    async loadSectionContent(section) {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';

        // Simulate lazy loading
        setTimeout(async () => {
            switch (section) {
                case 'dashboard':
                    await this.renderDashboard();
                    break;
                case 'blog':
                    await this.renderBlogSection();
                    break;
                case 'matches':
                    await this.renderMatchesSection();
                    break;
                case 'teams':
                    await this.renderTeamsSection();
                    break;
                case 'activity':
                    await this.renderActivityLog();
                    break;
                default:
                    container.innerHTML = `<div class="content-section"><h2>${section}</h2><p>Section under development</p></div>`;
            }
        }, 300);
    }

    async renderDashboard() {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = `
            <div class="content-section">
                <h2>Quick Actions</h2>
                <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem;">
                    <button class="btn btn-primary" onclick="adminDashboard.showModal('newPost')">+ New Blog Post</button>
                    <button class="btn btn-primary" onclick="adminDashboard.showModal('newMatch')">+ New Match</button>
                    <button class="btn btn-primary" onclick="adminDashboard.showModal('newTeam')">+ New Team</button>
                </div>
            </div>
            <div class="content-section">
                <h2>Keyboard Shortcuts</h2>
                <p style="margin-top:1rem;"><strong>Ctrl+N</strong> - New item | <strong>Esc</strong> - Close modal | <strong>Ctrl+S</strong> - Save</p>
            </div>
        `;
    }

    async renderBlogSection() {
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase
                .from('blog_posts')
                .select('*')
                .order('published_date', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            container.innerHTML = `
                <div class="content-section">
                    <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                        <h2>Blog Posts</h2>
                        <button class="btn btn-primary" onclick="adminDashboard.showModal('newPost')">+ New Post</button>
                    </div>
                    ${data.length === 0 ? '<p>No blog posts yet</p>' : `
                        <table class="data-table">
                            <thead><tr><th>Title</th><th>Author</th><th>Date</th><th>Status</th></tr></thead>
                            <tbody>
                                ${data.map(post => `
                                    <tr>
                                        <td>${this.escapeHtml(post.title)}</td>
                                        <td>${this.escapeHtml(post.author || 'Unknown')}</td>
                                        <td>${this.formatDate(post.published_date)}</td>
                                        <td>${post.status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Error loading blog posts:', error);
            this.showToast('error', 'Error', 'Failed to load blog posts');
            container.innerHTML = '<div class="content-section"><p style="color:var(--color-live);">Failed to load blog posts</p></div>';
        }
    }

    async renderMatchesSection() {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = `
            <div class="content-section">
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                    <h2>Matches</h2>
                    <button class="btn btn-primary" onclick="adminDashboard.showModal('newMatch')">+ New Match</button>
                </div>
                <p>Match management interface will be implemented here</p>
            </div>
        `;
    }

    async renderTeamsSection() {
        const container = document.getElementById('dashboardContent');
        container.innerHTML = `
            <div class="content-section">
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;">
                    <h2>Teams</h2>
                    <button class="btn btn-primary" onclick="adminDashboard.showModal('newTeam')">+ New Team</button>
                </div>
                <p>Team management interface will be implemented here</p>
            </div>
        `;
    }

    async renderActivityLog() {
        const container = document.getElementById('dashboardContent');
        try {
            const { data, error } = await this.supabase
                .from('activity_logs')
                .select('*, admin:admin_users(username)')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            container.innerHTML = `
                <div class="content-section">
                    <h2>Activity Log</h2>
                    ${data.length === 0 ? '<p>No activity logged yet</p>' : `
                        <div style="margin-top:1.5rem;">
                            ${data.map(log => `
                                <div style="padding:1rem;border-bottom:1px solid var(--border-light);">
                                    <div style="font-weight:600;">${this.escapeHtml(log.admin?.username || 'Unknown')} - ${log.action}</div>
                                    <div style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.25rem;">${this.formatDateTime(log.created_at)}</div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Error loading activity log:', error);
            container.innerHTML = '<div class="content-section"><p style="color:var(--color-live);">Failed to load activity log</p></div>';
        }
    }

    // STATISTICS
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
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showToast('error', 'Error', 'Failed to load statistics');
        }
    }

    // ACTIVITY LOGGING
    async logActivity(action, entityType, entityId, details) {
        if (!this.supabase || !this.currentUser) return;

        try {
            let ipAddress = 'unknown';
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                ipAddress = data.ip;
            } catch (e) {
                // Silently fail
            }

            await this.supabase
                .from('activity_logs')
                .insert({
                    admin_id: this.currentUser.id,
                    action: action,
                    entity_type: entityType,
                    entity_id: entityId,
                    details: details,
                    ip_address: ipAddress
                });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    // TOAST NOTIFICATIONS
    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div><strong>${this.escapeHtml(title)}</strong></div>
            <div style="font-size:0.875rem;color:var(--text-secondary);">${this.escapeHtml(message)}</div>
        `;
        
        container.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // MODAL HANDLERS
    setupModalHandlers() {
        const modal = document.getElementById('modal');
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    showModal(type) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.textContent = type.replace(/([A-Z])/g, ' $1').trim();
        body.innerHTML = `<p>Form for ${type} will be implemented here</p><button class="btn btn-primary" onclick="adminDashboard.closeModal()">Close</button>`;
        
        modal.classList.add('active');
        modal.focus();
    }

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }

    // KEYBOARD SHORTCUTS
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape - Close modal
            if (e.key === 'Escape') {
                this.closeModal();
            }

            // Ctrl/Cmd + N - New item
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.showModal('newPost');
            }

            // Ctrl/Cmd + S - Save (prevent default browser save)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.showToast('info', 'Save', 'Save functionality will be implemented');
            }
        });
    }

    // LOGOUT
    setupLogout() {
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            if (!this.supabase) return;

            try {
                // Log the logout activity
                await this.logActivity('logout', 'admin_session', null, {
                    username: this.currentUser?.username,
                    timestamp: new Date().toISOString()
                });

                // Sign out from Supabase
                await this.supabase.auth.signOut();

                // Clear any local data
                localStorage.clear();
                sessionStorage.clear();

                // Redirect to login
                window.location.href = '/admin/';
            } catch (error) {
                console.error('Logout error:', error);
                this.showToast('error', 'Error', 'Failed to logout properly');
            }
        });
    }

    // UTILITY FUNCTIONS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize dashboard
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});