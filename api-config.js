// API Configuration
const API_CONFIG = {
    newsapi: {
        baseUrl: 'https://newsapi.org/v2',
        // Free tier: 100 requests/day
        // Replace with your own key from https://newsapi.org
        apiKey: 'e84d76a31f934f83ac4d6e5ce76ce849',
        endpoints: {
            topHeadlines: '/top-headlines',
            everything: '/everything'
        }
    },
    
    reddit: {
        baseUrl: 'https://www.reddit.com',
        // No API key needed for public endpoints
    },

    twitter: {
        baseUrl: 'https://api.twitter.com/2',
        // Add your bearer token from Twitter Developer Portal
        bearerToken: 'YOUR_TWITTER_BEARER_TOKEN',
    },

    // Add more APIs as needed
    mediastack: {
        baseUrl: 'https://api.mediastack.com/v1',
        // Get key from https://mediastack.com
        apiKey: 'YOUR_MEDIASTACK_KEY',
    },
};

// Category definitions
const CATEGORIES = {
    entertainment: {
        icon: 'fas fa-film',
        keywords: ['movie', 'music', 'celebrity', 'entertainment'],
    },
    politics: {
        icon: 'fas fa-landmark',
        keywords: ['politics', 'election', 'congress', 'government'],
    },
    finance: {
        icon: 'fas fa-chart-line',
        keywords: ['stock', 'crypto', 'market', 'finance', 'business'],
    },
    tech: {
        icon: 'fas fa-microchip',
        keywords: ['technology', 'tech', 'software', 'startup', 'ai'],
    },
    rumors: {
        icon: 'fas fa-question-circle',
        keywords: ['alleged', 'rumor', 'unconfirmed', 'reported'],
    },
};

console.log('📝 API Config Loaded');