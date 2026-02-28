// Blog JavaScript
// Handles blog posts loading, search, filtering, and pagination

class BlogManager {
    constructor() {
        this.supabase = null;
        this.allPosts = [];
        this.filteredPosts = [];
        this.currentPage = 1;
        this.postsPerPage = 9;
        this.currentTag = 'all';
        this.searchQuery = '';
        
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

        // Setup event listeners
        this.setupSearch();
        this.setupFilters();
        
        // Load posts
        this.loadPosts();
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.filterAndRender();
            });
        }
    }

    setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-tag');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Apply filter
                this.currentTag = e.target.dataset.tag;
                this.currentPage = 1;
                this.filterAndRender();
            });
        });
    }

    async loadPosts() {
        if (!this.supabase) {
            this.showError('Database connection not available');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('blog_posts')
                .select('*')
                .eq('status', 'published')
                .order('published_date', { ascending: false });

            if (error) throw error;
            
            this.allPosts = data || [];
            this.filterAndRender();
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load blog posts');
        }
    }

    filterAndRender() {
        // Start with all posts
        let filtered = [...this.allPosts];
        
        // Apply tag filter
        if (this.currentTag !== 'all') {
            filtered = filtered.filter(post => 
                post.tags && post.tags.includes(this.currentTag)
            );
        }
        
        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(post => {
                const title = post.title.toLowerCase();
                const content = post.content.toLowerCase();
                const excerpt = (post.excerpt || '').toLowerCase();
                
                return title.includes(this.searchQuery) || 
                       content.includes(this.searchQuery) ||
                       excerpt.includes(this.searchQuery);
            });
        }
        
        this.filteredPosts = filtered;
        this.renderPosts();
        this.renderPagination();
    }

    renderPosts() {
        const container = document.getElementById('blogPosts');
        if (!container) return;
        
        const startIndex = (this.currentPage - 1) * this.postsPerPage;
        const endIndex = startIndex + this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(startIndex, endIndex);
        
        if (postsToShow.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="grid-column: 1 / -1;">
                    <div class="no-results-icon">📝</div>
                    <h3>No posts found</h3>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                        ${this.searchQuery ? 'Try adjusting your search terms' : 'No posts match the selected filter'}
                    </p>
                </div>
            `;
            return;
        }
        
        const html = postsToShow.map(post => this.renderPostCard(post)).join('');
        container.innerHTML = html;
        
        // Add click handlers
        this.addPostClickHandlers();
    }

    renderPostCard(post) {
        const tags = post.tags || [];
        const excerpt = post.excerpt || post.content.substring(0, 150) + '...';
        
        return `
            <article class="blog-card" data-slug="${post.slug}">
                ${post.featured_image ? `
                    <img src="${post.featured_image}" alt="${this.escapeHtml(post.title)}" class="blog-card-image">
                ` : `
                    <div class="blog-card-image" style="display: flex; align-items: center; justify-content: center; font-size: 3rem;">
                        📰
                    </div>
                `}
                
                <div class="blog-card-content">
                    ${tags.length > 0 ? `
                        <div class="blog-card-tags">
                            ${tags.slice(0, 3).map(tag => `<span class="blog-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <h2 class="blog-card-title">${this.escapeHtml(post.title)}</h2>
                    <p class="blog-card-excerpt">${this.escapeHtml(excerpt)}</p>
                    
                    <div class="blog-card-meta">
                        <span>📅 ${this.formatDate(post.published_date)}</span>
                        ${post.author ? `<span>✍️ ${this.escapeHtml(post.author)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }

    addPostClickHandlers() {
        const cards = document.querySelectorAll('.blog-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const slug = card.dataset.slug;
                window.location.href = `/blog/${slug}`;
            });
        });
    }

    renderPagination() {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;
        
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'flex';
        
        let html = '';
        
        // Previous button
        html += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
                ← Previous
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            html += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span style="padding: 0.75rem;">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span style="padding: 0.75rem;">...</span>`;
            }
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // Next button
        html += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
                Next →
            </button>
        `;
        
        paginationContainer.innerHTML = html;
        
        // Add click handlers
        const buttons = paginationContainer.querySelectorAll('.pagination-btn:not(:disabled)');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.currentPage = parseInt(button.dataset.page);
                this.renderPosts();
                this.renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const container = document.getElementById('blogPosts');
        if (container) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1 / -1; padding: 3rem; text-align: center; border-color: var(--color-live);">
                    <p style="color: var(--color-live);">⚠️ ${message}</p>
                </div>
            `;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.blogManager = new BlogManager();
});