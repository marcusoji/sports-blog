// Configuration for Mock University Website
// Supports both environment variables (production) and hardcoded values (development)

const CONFIG = {
    // Supabase Configuration - uses env vars if available, falls back to hardcoded
    supabase: {
        url: (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || '',
        anonKey: (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || '',
        // For admin operations (keep secure, use environment variables in production)
        serviceRoleKey: (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) || ''
    },
    
    // WhatsApp Integration (for Contact Form)
    whatsapp: {
        // WhatsApp numbers to receive contact form submissions
        recipients: [
            '+2349042007583',
            '+2349159048395'
        ],
        // API endpoint for sending WhatsApp messages (use Twilio, WhatsApp Business API, or similar)
        apiEndpoint: '/api/send-whatsapp',
        // Optional: Use a service like Twilio
        twilioAccountSid: (typeof process !== 'undefined' && process.env?.TWILIO_ACCOUNT_SID) || 'YOUR_TWILIO_ACCOUNT_SID',
        twilioAuthToken: (typeof process !== 'undefined' && process.env?.TWILIO_AUTH_TOKEN) || 'YOUR_TWILIO_AUTH_TOKEN',
        twilioWhatsAppNumber: (typeof process !== 'undefined' && process.env?.TWILIO_WHATSAPP_NUMBER) || 'whatsapp:+14155238886'
    },
    
    // Site Configuration
    site: {
        name: 'Mock University',
        domain: (typeof process !== 'undefined' && process.env?.SITE_DOMAIN) || 'www.mockuniversity.com',
        description: 'Official website of Mock University - News, Sports, and Campus Life',
        logo: '/assets/logo.svg',
        email: 'info@mockuniversity.com',
        socialMedia: {
            facebook: 'https://facebook.com/mockuniversity',
            twitter: 'https://twitter.com/mockuniversity',
            instagram: 'https://instagram.com/mockuniversity',
            linkedin: 'https://linkedin.com/company/mockuniversity'
        }
    },
    
    // Caching Configuration
    cache: {
        blogPosts: 3600000, // 1 hour in milliseconds
        leagueTables: 60000, // 1 minute
        liveScores: 5000, // 5 seconds (no cache, real-time polling)
        fixtures: 300000, // 5 minutes
        images: 604800000 // 1 week
    },
    
    // Real-time Updates
    realtime: {
        liveScoresInterval: 10000, // Poll every 10 seconds
        leagueTableInterval: 60000, // Update every minute
        enableSupabaseRealtime: true // Use Supabase Realtime subscriptions
    },
    
    // SEO Configuration
    seo: {
        defaultTitle: 'Mock University - Official Website',
        titleTemplate: '%s | Mock University',
        defaultDescription: 'Stay updated with Mock University news, sports scores, fixtures, and campus events.',
        defaultImage: '/assets/og-image.jpg',
        twitterHandle: '@mockuniversity'
    },
    
    // Footer External Links
    footer: {
        externalLinks: [
            {
                name: 'Partner University 1',
                url: 'https://www.mockpartner1.com',
                icon: '🎓'
            },
            {
                name: 'Partner University 2',
                url: 'https://www.mockpartner2.com',
                icon: '🏛️'
            }
        ]
    },
    
    // Admin Panel Configuration
    admin: {
        sessionTimeout: 3600000, // 1 hour
        maxLoginAttempts: 5,
        lockoutDuration: 900000 // 15 minutes
    },
    
    // API Endpoints
    api: {
        baseUrl: '/api',
        endpoints: {
            blog: '/blog',
            matches: '/matches',
            competitions: '/competitions',
            teams: '/teams',
            standings: '/standings',
            contact: '/contact',
            admin: '/admin'
        }
    }
};

// Add this so the browser can see it globally
window.CONFIG = CONFIG;

// Keep this for later if you use Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
