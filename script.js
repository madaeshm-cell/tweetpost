// ==================== GLOBAL STATE ====================
const newsApp = {
    currentPage: 1,
    newsPerPage: 12,
    allNews: [],
    filteredNews: [],
    currentCategory: 'all',
    currentSearch: '',
    currentSort: 'latest',
    currentSource: 'all',
    isLoading: false,
    autoUpdateInterval: null,
    updateIntervalTime: 30000, // 30 seconds
};

// ==================== DOM ELEMENTS ====================
const DOM = {
    newsContainer: document.getElementById('newsContainer'),
    loadingState: document.getElementById('loadingState'),
    noResults: document.getElementById('noResults'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    categoryBtns: document.querySelectorAll('.category-btn'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    themeToggle: document.getElementById('themeToggle'),
    refreshBtn: document.getElementById('refreshBtn'),
    lastUpdate: document.getElementById('lastUpdate'),
    sortBtn: document.getElementById('sortBtn'),
    sourceFilter: document.getElementById('sourceFilter'),
    trendingContainer: document.getElementById('trendingContainer'),
    activeFilters: document.getElementById('activeFilters'),
    toastContainer: document.getElementById('toastContainer'),
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NewsFlow App Initializing...');
    
    initializeTheme();
    attachEventListeners();
    fetchAllNews();
    startAutoUpdate();
    
    console.log('✅ NewsFlow App Ready!');
});

// ==================== THEME MANAGEMENT ====================
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon();
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    showToast('Theme updated', 'success');
}

function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-mode');
    DOM.themeToggle.innerHTML = isDark 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
}

// ==================== EVENT LISTENERS ====================
function attachEventListeners() {
    // Category filtering
    DOM.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            newsApp.currentCategory = btn.dataset.category;
            newsApp.currentPage = 1;
            filterAndDisplayNews();
        });
    });

    // Search
    DOM.searchBtn.addEventListener('click', performSearch);
    DOM.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Theme
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Refresh
    DOM.refreshBtn.addEventListener('click', refreshNews);

    // Load More
    DOM.loadMoreBtn.addEventListener('click', loadMoreNews);

    // Sort
    DOM.sortBtn.addEventListener('click', () => {
        newsApp.currentSort = newsApp.currentSort === 'latest' ? 'oldest' : 'latest';
        DOM.sortBtn.textContent = `${newsApp.currentSort === 'latest' ? '📅 Latest' : '📅 Oldest'}`;
        newsApp.currentPage = 1;
        filterAndDisplayNews();
    });

    // Source Filter
    DOM.sourceFilter.addEventListener('change', (e) => {
        newsApp.currentSource = e.target.value;
        newsApp.currentPage = 1;
        filterAndDisplayNews();
    });
}

// ==================== FETCH NEWS ====================
async function fetchAllNews() {
    try {
        showLoadingState(true);
        newsApp.allNews = [];

        // Fetch from multiple sources
        const sources = [
            fetchFromNewsAPI(),
            fetchFromRedddit(),
            fetchFromTwitter(),
            fetchRumors(),
        ];

        const results = await Promise.allSettled(sources);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                newsApp.allNews = [...newsApp.allNews, ...result.value];
            } else {
                console.error(`Source ${index} failed:`, result.reason);
            }
        });

        // Remove duplicates and sort
        newsApp.allNews = removeDuplicates(newsApp.allNews);
        newsApp.allNews = newsApp.allNews.sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
        );

        console.log(`📰 Loaded ${newsApp.allNews.length} articles`);
        filterAndDisplayNews();
        updateTrending();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('❌ Error fetching news:', error);
        showToast('Failed to fetch news. Please try again.', 'error');
        showLoadingState(false);
    }
}

// ==================== FETCH FROM NEWSAPI ====================
async function fetchFromNewsAPI() {
    try {
        const newsApiKey = 'e84d76a31f934f83ac4d6e5ce76ce849'; // You should move this to env
        const endpoints = [
            'https://newsapi.org/v2/top-headlines?country=us&sortBy=publishedAt',
            'https://newsapi.org/v2/top-headlines?category=entertainment&sortBy=publishedAt',
            'https://newsapi.org/v2/top-headlines?category=business&sortBy=publishedAt',
            'https://newsapi.org/v2/top-headlines?category=technology&sortBy=publishedAt',
        ];

        let articles = [];
        for (const endpoint of endpoints) {
            const response = await fetch(`${endpoint}&apiKey=${newsApiKey}`);
            if (!response.ok) throw new Error(`NewsAPI error: ${response.status}`);
            const data = await response.json();
            articles = articles.concat(data.articles || []);
        }

        return articles.map(article => ({
            id: `newsapi-${article.url}`,
            title: article.title,
            description: article.description,
            urlToImage: article.urlToImage,
            url: article.url,
            source: article.source.name,
            publishedAt: article.publishedAt,
            category: categorizeArticle(article.title + ' ' + (article.description || '')),
            isRumor: false,
            sourceType: 'newsapi',
            author: article.author,
            content: article.content,
        }));
    } catch (error) {
        console.error('❌ NewsAPI Error:', error);
        return [];
    }
}

// ==================== FETCH FROM REDDIT ====================
async function fetchFromRedddit() {
    try {
        const subreddits = ['news', 'technology', 'worldnews', 'entertainment', 'finance'];
        let articles = [];

        for (const subreddit of subreddits) {
            const response = await fetch(
                `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
                { headers: { 'User-Agent': 'NewsFlow-App' } }
            );
            
            if (!response.ok) continue;
            
            const data = await response.json();
            const posts = data.data?.children || [];

            articles = articles.concat(posts.map(post => ({
                id: `reddit-${post.data.id}`,
                title: post.data.title,
                description: post.data.selftext?.substring(0, 200) || post.data.title,
                urlToImage: post.data.thumbnail && post.data.thumbnail.startsWith('http') 
                    ? post.data.thumbnail 
                    : null,
                url: `https://reddit.com${post.data.permalink}`,
                source: `r/${subreddit}`,
                publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
                category: categorizeArticle(post.data.title),
                isRumor: detectRumor(post.data.title),
                sourceType: 'reddit',
                author: post.data.author,
            })));
        }

        return articles;
    } catch (error) {
        console.error('❌ Reddit Error:', error);
        return [];
    }
}

// ==================== FETCH FROM TWITTER ====================
async function fetchFromTwitter() {
    try {
        // Using a free Twitter API alternative (Twitter API v2 requires authentication)
        // For production, use official Twitter API
        const response = await fetch('https://api.twitter.com/2/tweets/search/recent?query=news', {
            headers: {
                'Authorization': 'Bearer YOUR_TWITTER_BEARER_TOKEN' // Add your token
            }
        });

        if (!response.ok) {
            console.warn('⚠️ Twitter API not fully configured');
            return [];
        }

        const data = await response.json();
        return data.data?.map(tweet => ({
            id: `twitter-${tweet.id}`,
            title: tweet.text.substring(0, 100),
            description: tweet.text,
            url: `https://twitter.com/search?q=${encodeURIComponent(tweet.text)}`,
            source: 'Twitter',
            publishedAt: tweet.created_at,
            category: categorizeArticle(tweet.text),
            isRumor: detectRumor(tweet.text),
            sourceType: 'twitter',
            urlToImage: null,
        })) || [];
    } catch (error) {
        console.warn('⚠️ Twitter fetch skipped:', error);
        return [];
    }
}

// ==================== FETCH RUMORS ====================
async function fetchRumors() {
    try {
        // Simulating rumor sources - in production, integrate with actual rumor tracking APIs
        const rumorQueries = [
            'alleged',
            'unconfirmed',
            'claims',
            'reported to',
            'sources say',
            'rumor has it',
        ];

        let rumors = [];
        const newsApiKey = 'e84d76a31f934f83ac4d6e5ce76ce849';

        for (const query of rumorQueries) {
            const response = await fetch(
                `https://newsapi.org/v2/everything?q="${query}"&sortBy=publishedAt&pageSize=10&apiKey=${newsApiKey}`
            );
            
            if (!response.ok) continue;
            
            const data = await response.json();
            const articles = data.articles || [];

            rumors = rumors.concat(articles.map(article => ({
                id: `rumor-${article.url}`,
                title: article.title,
                description: article.description,
                urlToImage: article.urlToImage,
                url: article.url,
                source: article.source.name,
                publishedAt: article.publishedAt,
                category: 'rumors',
                isRumor: true,
                sourceType: 'rumor',
                author: article.author,
            })));
        }

        return rumors;
    } catch (error) {
        console.error('❌ Rumor fetch error:', error);
        return [];
    }
}

// ==================== CATEGORIZATION ====================
function categorizeArticle(text) {
    const textLower = text.toLowerCase();

    if (textLower.match(/\b(movie|film|music|celebrity|actor|actress|entertainment|oscar|grammy|concert)\b/i)) {
        return 'entertainment';
    }
    if (textLower.match(/\b(election|congress|senate|president|politician|policy|government|parliament|vote)\b/i)) {
        return 'politics';
    }
    if (textLower.match(/\b(stock|crypto|bitcoin|market|finance|economy|earnings|trading|investment)\b/i)) {
        return 'finance';
    }
    if (textLower.match(/\b(tech|ai|artificial intelligence|software|hardware|app|startup|innovation|coding|programming)\b/i)) {
        return 'tech';
    }

    return 'all';
}

// ==================== RUMOR DETECTION ====================
function detectRumor(text) {
    const rumorIndicators = [
        'alleged',
        'claimed',
        'sources say',
        'reportedly',
        'unconfirmed',
        'rumor has it',
        'purportedly',
        'supposedly',
        'it is believed',
    ];

    return rumorIndicators.some(indicator => 
        text.toLowerCase().includes(indicator)
    );
}

// ==================== FILTERING & DISPLAY ====================
function filterAndDisplayNews() {
    let filtered = [...newsApp.allNews];

    // Category filter
    if (newsApp.currentCategory !== 'all') {
        filtered = filtered.filter(news => 
            news.category === newsApp.currentCategory || 
            (newsApp.currentCategory === 'rumors' && news.isRumor)
        );
    }

    // Search filter
    if (newsApp.currentSearch) {
        const searchTerm = newsApp.currentSearch.toLowerCase();
        filtered = filtered.filter(news =>
            news.title.toLowerCase().includes(searchTerm) ||
            news.description?.toLowerCase().includes(searchTerm)
        );
    }

    // Source filter
    if (newsApp.currentSource !== 'all') {
        filtered = filtered.filter(news => news.sourceType === newsApp.currentSource);
    }

    // Sort
    if (newsApp.currentSort === 'oldest') {
        filtered = filtered.reverse();
    }

    newsApp.filteredNews = filtered;
    newsApp.currentPage = 1;
    displayNews();
    updateActiveFilters();
}

function displayNews() {
    const startIndex = 0;
    const endIndex = newsApp.currentPage * newsApp.newsPerPage;
    const newsToDisplay = newsApp.filteredNews.slice(startIndex, endIndex);

    if (newsToDisplay.length === 0 && newsApp.filteredNews.length === 0) {
        DOM.newsContainer.innerHTML = '';
        DOM.noResults.style.display = 'flex';
        DOM.loadingState.style.display = 'none';
        DOM.loadMoreBtn.style.display = 'none';
        return;
    }

    DOM.noResults.style.display = 'none';
    DOM.loadingState.style.display = 'none';
    DOM.newsContainer.innerHTML = newsToDisplay.map(news => createNewsCard(news)).join('');

    // Update load more button
    if (endIndex >= newsApp.filteredNews.length) {
        DOM.loadMoreBtn.style.display = 'none';
    } else {
        DOM.loadMoreBtn.style.display = 'block';
    }

    // Attach click handlers
    document.querySelectorAll('.news-card').forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.url;
            window.open(url, '_blank');
        });
    });
}

function createNewsCard(news) {
    const timeAgo = getTimeAgo(news.publishedAt);
    const rumorBadge = news.isRumor ? '<span class="rumor-badge">⚠️ RUMOR</span>' : '';

    return `
        <div class="news-card" data-url="${news.url}">
            <img 
                src="${news.urlToImage || 'https://via.placeholder.com/340x200?text=No+Image'}" 
                alt="${news.title}"
                class="news-image"
                onerror="this.src='https://via.placeholder.com/340x200?text=No+Image'"
            >
            <div class="news-card-content">
                <div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                        <span class="news-category ${news.category}">${news.category.toUpperCase()}</span>
                        ${rumorBadge}
                    </div>
                    <h3 class="news-title">${news.title}</h3>
                    <p class="news-description">${news.description || 'No description available'}</p>
                </div>
                <div class="news-meta">
                    <span class="news-source">
                        <i class="fas fa-globe"></i>
                        ${news.source}
                    </span>
                    <span class="news-time">
                        <i class="fas fa-clock"></i>
                        ${timeAgo}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// ==================== TRENDING SECTION ====================
function updateTrending() {
    const trending = newsApp.allNews.slice(0, 5);
    
    DOM.trendingContainer.innerHTML = trending.map(news => `
        <div class="trending-card" onclick="window.open('${news.url}', '_blank')">
            <div class="trending-card-content">
                <span class="trending-badge">${news.category.toUpperCase()}</span>
                <h3 class="trending-title">${news.title}</h3>
                <div class="trending-source">
                    <i class="fas fa-globe"></i>
                    ${news.source}
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== ACTIVE FILTERS ====================
function updateActiveFilters() {
    let filters = [];

    if (newsApp.currentSearch) {
        filters.push(`
            <div class="filter-tag">
                <i class="fas fa-search"></i> "${newsApp.currentSearch}"
                <button onclick="clearSearch()">×</button>
            </div>
        `);
    }

    if (newsApp.currentCategory !== 'all') {
        filters.push(`
            <div class="filter-tag">
                <i class="fas fa-filter"></i> ${newsApp.currentCategory}
                <button onclick="clearCategoryFilter()">×</button>
            </div>
        `);
    }

    if (newsApp.currentSource !== 'all') {
        filters.push(`
            <div class="filter-tag">
                <i class="fas fa-link"></i> ${newsApp.currentSource}
                <button onclick="clearSourceFilter()">×</button>
            </div>
        `);
    }

    DOM.activeFilters.innerHTML = filters.join('');
}

function clearSearch() {
    newsApp.currentSearch = '';
    DOM.searchInput.value = '';
    filterAndDisplayNews();
}

function clearCategoryFilter() {
    newsApp.currentCategory = 'all';
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
    filterAndDisplayNews();
}

function clearSourceFilter() {
    newsApp.currentSource = 'all';
    DOM.sourceFilter.value = 'all';
    filterAndDisplayNews();
}

// ==================== SEARCH ====================
function performSearch() {
    newsApp.currentSearch = DOM.searchInput.value.trim();
    newsApp.currentPage = 1;
    filterAndDisplayNews();
    showToast(`Searching for "${newsApp.currentSearch}"...`, 'success');
}

// ==================== LOAD MORE ====================
function loadMoreNews() {
    newsApp.currentPage++;
    displayNews();
    window.scrollBy({ top: 500, behavior: 'smooth' });
}

// ==================== REFRESH ====================
function refreshNews() {
    DOM.refreshBtn.style.animation = 'none';
    setTimeout(() => {
        DOM.refreshBtn.style.animation = '';
    }, 10);
    
    DOM.refreshBtn.style.transform = 'rotate(360deg)';
    newsApp.currentPage = 1;
    fetchAllNews();
}

// ==================== AUTO UPDATE ====================
function startAutoUpdate() {
    newsApp.autoUpdateInterval = setInterval(() => {
        console.log('🔄 Auto-updating news...');
        fetchAllNews();
    }, newsApp.updateIntervalTime);
}

function stopAutoUpdate() {
    if (newsApp.autoUpdateInterval) {
        clearInterval(newsApp.autoUpdateInterval);
    }
}

// ==================== UTILITIES ====================
function showLoadingState(show) {
    DOM.loadingState.style.display = show ? 'flex' : 'none';
}

function updateLastUpdateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    DOM.lastUpdate.textContent = `Last updated: ${time}`;
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';

    return Math.floor(seconds) + ' seconds ago';
}

function removeDuplicates(articles) {
    const seen = new Set();
    return articles.filter(article => {
        const title = article.title.toLowerCase();
        if (seen.has(title)) return false;
        seen.add(title);
        return true;
    });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', stopAutoUpdate);