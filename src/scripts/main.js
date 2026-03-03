// Mock University - Main JavaScript
// Handles theme management, real-time updates, navigation, and core functionality

class mockuniversity {
    constructor() {
        this.theme = this.getTheme();
        this.supabase = null;
        this.liveScoreInterval = null;
        this.init();
    }

    // Initialize the application
    init() {
        this.initTheme();
        this.initNavigation();
        this.initSupabase();
        this.setupEventListeners();
        this.detectSystemTheme();
    }

    // Initialize Supabase connection
    initSupabase() {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            try {
                this.supabase = window.supabase ? window.supabase.createClient(
                    CONFIG.supabase.url,
                    CONFIG.supabase.anonKey
                ) : null;
                console.log('✅ Supabase initialized');
            } catch (error) {
                console.error('❌ Supabase initialization failed:', error);
            }
        }
    }

    // Theme Management
    getTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme;
        
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateThemeIcon();
    }

    initTheme() {
        this.setTheme(this.theme);
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    updateThemeIcon() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = this.theme === 'light' ? '🌙' : '☀️';
            themeToggle.setAttribute('aria-label', `Switch to ${this.theme === 'light' ? 'dark' : 'light'} mode`);
        }
    }

    detectSystemTheme() {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Navigation Management
    initNavigation() {
        this.updateActiveNavLink();
        window.addEventListener('popstate', () => this.updateActiveNavLink());
    }

    updateActiveNavLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPath || (currentPath.startsWith(href) && href !== '/')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    toggleMobileMenu() {
        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu) {
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
        }
    }

    closeMobileMenu() {
        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Event Listeners Setup
    setupEventListeners() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu());
        }

        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMobileMenu());
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileMenu();
            }
        });

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // --- Time Calculation Helper ---
    calculateMatchTime(kickoff, status) {
    if (status === 'ht') return 'HT';
    if (status !== 'live') return status;
    
    const diff = Math.floor((new Date() - new Date(kickoff)) / 60000);
    
    if (diff >= 45 && diff < 50) return '45+\''; // Added '
    if (diff >= 90) return '90+\'';              // Added '
    return Math.max(0, diff) + "'";
}

   // Replace both fetchLiveScores and renderLiveScores with this one function
async fetchLiveScores(containerId = 'live-scores') {
    const container = document.getElementById(containerId);
    if (!container || !this.supabase) return;

    try {
        // 1. Fetch data with match_events for scorers
        const { data: matches, error } = await this.supabase
            .from('matches')
            .select(`
                *,
                home_team:teams!matches_home_team_id_fkey(name, logo_url),
                away_team:teams!matches_away_team_id_fkey(name, logo_url),
                match_events(*)
            `)
            .or('status.eq.live,status.eq.ht') // Ensures HT matches show up
            .order('match_date', { ascending: false });

        if (error) throw error;

        if (!matches || matches.length === 0) {
            container.innerHTML = '<div class="no-matches">No live matches currently.</div>';
            return;
        }

        // 2. Render HTML
        container.innerHTML = matches.map(match => {
            // Calculate time or show HT
            const timeDisplay = this.calculateMatchTime(match.match_date, match.status);

            // Filter scorers from events
            const homeScorers = match.match_events
                .filter(e => e.event_type === 'goal' && e.team_id === match.home_team_id)
                .map(e => `<span>${e.player_name} ${e.event_minute}'</span>`)
                .join('');

            const awayScorers = match.match_events
                .filter(e => e.event_type === 'goal' && e.team_id === match.away_team_id)
                .map(e => `<span>${e.player_name} ${e.event_minute}'</span>`)
                .join('');

            return `
                <div class="live-card">
                    <div class="live-header">
                        <span class="live-indicator ${match.status === 'ht' ? 'ht-badge' : ''}">
                            ${match.status === 'ht' ? 'HALF TIME' : 'LIVE'}
                        </span>
                        <span class="live-time">${timeDisplay}</span>
                    </div>
                    <div class="live-body">
                        <div class="team-col">
                            <img src="${match.home_team.logo_url || 'assets/default.png'}" class="team-logo">
                            <span class="team-name">${match.home_team.name}</span>
                            <div class="scorers-list">${homeScorers}</div>
                        </div>
                       <div class="score-col">${match.home_score || 0} - ${match.away_score || 0}</div>
                        <div class="team-col">
                            <img src="${match.away_team.logo_url || 'assets/default.png'}" class="team-logo">
                            <span class="team-name">${match.away_team.name}</span>
                            <div class="scorers-list">${awayScorers}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error in live scores:', error);
    }
}
    

// Add this inside the mockuniversity class
getSmartTime(status, minute) {
    const min = parseInt(minute) || 0;
    
    // Priority 1: Check for manual Half Time/Full Time status
    if (status === 'ht') return '<span class="status-badge ht">HT</span>';
    if (status === 'ft') return '<span class="status-badge ft">FT</span>';
    
    // Priority 2: Automatic transition rules
    if (min >= 50 && status === 'live' && min < 60) return '<span class="status-badge ht">HT</span>';
    if (min >= 100) return '<span class="status-badge ft">FT</span>';

    // Priority 3: Injury time formatting
    if (min > 45 && min < 50) return `45+${min - 45}'`;
    if (min > 90 && min < 100) return `90+${min - 90}'`;
    
    return min + "'";
}
startLiveScoreUpdates(interval = 10000) {
    this.fetchLiveScores();

        if (this.liveScoreInterval) {
            clearInterval(this.liveScoreInterval);
        }

        this.liveScoreInterval = setInterval(() => {
            this.fetchLiveScores();
        }, interval);

        if (this.supabase && CONFIG.realtime.enableSupabaseRealtime) {
            this.subscribeToMatchUpdates();
        }
    }

    subscribeToMatchUpdates() {
        this.supabase
            .channel('matches')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'matches' },
                (payload) => {
                    console.log('Match update received:', payload);
                    this.fetchLiveScores();
                }
            )
            .subscribe();
    }

    stopLiveScoreUpdates() {
        if (this.liveScoreInterval) {
            clearInterval(this.liveScoreInterval);
            this.liveScoreInterval = null;
        }
    }

    // Fetch Recent Blog Posts
    async fetchBlogPosts(limit = 6) {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('blog_posts')
                .select('*')
                .eq('status', 'published')
                .order('published_date', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching blog posts:', error);
            return [];
        }
    }

    async renderBlogPosts(containerId, limit = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const posts = await this.fetchBlogPosts(limit);
        
        // FIX: Guard against null or undefined posts
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="text-center text-secondary">No posts available</p>';
            return;
        }

        const html = posts.map(post => `
            <div class="card">
                ${post.featured_image ? `
                    <img src="${post.featured_image}" alt="${post.title}" class="card-image">
                ` : ''}
                <div class="card-content">
                    <h3 class="card-title">${this.escapeHtml(post.title)}</h3>
                    <p class="card-text">${this.escapeHtml(post.excerpt || (post.content ? post.content.substring(0, 150) : '') + '...')}</p>
                    <div class="card-meta">
                        <span>📅 ${this.formatDate(post.published_date)}</span>
                        ${post.author ? `<span>✍️ ${this.escapeHtml(post.author)}</span>` : ''}
                    </div>
                    <a href="/blog-detail.html?slug=${post.slug}" class="btn btn-primary mt-2">Read More</a>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error("Error rendering blog posts:", error);
        container.innerHTML = '<p class="text-center text-danger">Failed to load posts.</p>';
    }
}

    // Fetch Upcoming Fixtures
    async fetchUpcomingFixtures(limit = 5) {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('matches')
                .select(`
                    *,
                    home_team:teams!matches_home_team_id_fkey(name, short_name),
                    away_team:teams!matches_away_team_id_fkey(name, short_name),
                    competition:competitions(name)
                `)
                .eq('status', 'scheduled')
                .gte('match_date', new Date().toISOString())
                .order('match_date', { ascending: true })
                .limit(limit);

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching fixtures:', error);
            return [];
        }
    }

    async renderFixtures(containerId, limit = 5) {
        const fixtures = await this.fetchUpcomingFixtures(limit) || [];
        const container = document.getElementById(containerId);
        
        if (!container) return;

        if (fixtures.length === 0) {
            container.innerHTML = '<p class="text-center text-secondary">No upcoming fixtures</p>';
            return;
        }

        const html = fixtures.map(fixture => `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-competition">${fixture.competition.name}</span>
                    <span class="match-status scheduled">${this.formatDateTime(fixture.match_date)}</span>
                </div>
                <div class="match-teams">
                    <div class="team">
                        <span class="team-name">${fixture.home_team.name}</span>
                    </div>
                    <div style="text-align: center; color: var(--text-tertiary); font-weight: 600;">VS</div>
                    <div class="team">
                        <span class="team-name">${fixture.away_team.name}</span>
                    </div>
                </div>
                ${fixture.venue ? `<div style="text-align: center; color: var(--text-tertiary); font-size: 0.875rem; margin-top: 0.5rem;">📍 ${fixture.venue}</div>` : ''}
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Utility Functions
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showLoader(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';
        }
    }

    // SEO Helper
    updatePageMeta(title, description, image, type = 'website') {
        document.title = title;
        this.updateMetaTag('name', 'description', description);
        this.updateMetaTag('property', 'og:title', title);
        this.updateMetaTag('property', 'og:description', description);
        this.updateMetaTag('property', 'og:type', type);
        this.updateMetaTag('property', 'og:url', window.location.href);
        
        if (image) {
            this.updateMetaTag('property', 'og:image', image);
            this.updateMetaTag('name', 'twitter:image', image);
        }
        
        this.updateMetaTag('name', 'twitter:card', 'summary_large_image');
        this.updateMetaTag('name', 'twitter:title', title);
        this.updateMetaTag('name', 'twitter:description', description);
    }

    updateMetaTag(attribute, key, value) {
        let element = document.querySelector(`meta[${attribute}="${key}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attribute, key);
            document.head.appendChild(element);
        }
        element.setAttribute('content', value);
    }

    generateStructuredData(type, data) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        const structuredData = {
            "@context": "https://schema.org",
            "@type": type,
            ...data
        };
        script.textContent = JSON.stringify(structuredData);
        const existing = document.querySelector('script[type="application/ld+json"]');
        if (existing) {
            existing.remove();
        }
        document.head.appendChild(script);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mockUniversity = new mockuniversity(); 
    console.log('🎓 Mock University website initialized');
    
    // Auto-start live scores if the element exists on page
    if (document.getElementById('live-scores')) {
        window.mockUniversity.startLiveScoreUpdates();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = mockuniversity;
}