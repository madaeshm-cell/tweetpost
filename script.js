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
    updateIntervalTime: 60000, // 60 seconds (increased from 30)
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
    
    // Fetch news with better error handling
    fetchAllNews().then(() => {
        startAutoUpdate();
    }).catch(err => {
        console.error('Initial fetch failed:', err);
        showToast('Loading sample news...', 'warning');
        loadSampleNews();
        startAutoUpdate();
    });
    
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
        DOM.sortBtn.textContent = newsApp.currentSort === 'latest' 
            ? '<i class="fas fa-sort"></i> Latest' 
            : '<i class="fas fa-sort"></i> Oldest';
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

// ==================== FETCH ALL NEWS ====================
async function fetchAllNews() {
    try {
        showLoadingState(true);
        newsApp.allNews = [];

        console.log('📡 Fetching from multiple sources...');

        // Create promises for all sources
        const sources = [
            fetchFromNewsAPI(),
            fetchFromRedddit(),
            fetchRumors(),
        ];

        // Use Promise.allSettled to handle failures gracefully
        const results = await Promise.allSettled(sources);
        
        let successCount = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const articles = result.value || [];
                if (articles.length > 0) {
                    console.log(`✅ Source ${index + 1}: ${articles.length} articles`);
                    newsApp.allNews = [...newsApp.allNews, ...articles];
                    successCount++;
                }
            } else {
                console.warn(`⚠️ Source ${index + 1} failed:`, result.reason.message);
            }
        });

        if (successCount === 0) {
            console.error('❌ All sources failed!');
            throw new Error('Unable to fetch from any news source');
        }

        // Remove duplicates and sort
        newsApp.allNews = removeDuplicates(newsApp.allNews);
        newsApp.allNews = newsApp.allNews.sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
        );

        console.log(`✅ Successfully loaded ${newsApp.allNews.length} unique articles`);
        
        filterAndDisplayNews();
        updateTrending();
        updateLastUpdateTime();
        showToast(`Loaded ${newsApp.allNews.length} articles`, 'success');
        
    } catch (error) {
        console.error('❌ Critical Error:', error);
        showToast('Failed to fetch news. Using fallback data...', 'error');
        loadSampleNews();
    } finally {
        showLoadingState(false);
    }
}

// ==================== FETCH FROM NEWSAPI ====================
async function fetchFromNewsAPI() {
    try {
        // Using a free API key - replace with your own
        const apiKey = 'e84d76a31f934f83ac4d6e5ce76ce849';
        
        const endpoints = [
            `https://newsapi.org/v2/top-headlines?country=us&pageSize=20&apiKey=${apiKey}`,
            `https://newsapi.org/v2/everything?q=technology&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`,
            `https://newsapi.org/v2/everything?q=entertainment&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`,
            `https://newsapi.org/v2/everything?q=business&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`,
        ];

        let articles = [];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    headers: {
                        'Accept': 'application/json',
                    }
                });

                if (!response.ok) {
                    console.warn(`⚠️ NewsAPI returned ${response.status}`);
                    if (response.status === 401) {
                        throw new Error('Invalid NewsAPI key');
                    }
                    continue;
                }

                const data = await response.json();
                
                if (data.articles && Array.isArray(data.articles)) {
                    articles = articles.concat(data.articles);
                }
            } catch (err) {
                console.warn('Single endpoint failed:', err);
                continue;
            }
        }

        if (articles.length === 0) {
            console.warn('⚠️ NewsAPI: No articles found');
            return [];
        }

        return articles.map(article => ({
            id: `newsapi-${article.url}`,
            title: article.title || 'Untitled',
            description: article.description || article.content || 'No description available',
            urlToImage: article.urlToImage || null,
            url: article.url,
            source: article.source?.name || 'NewsAPI',
            publishedAt: article.publishedAt || new Date().toISOString(),
            category: categorizeArticle(article.title + ' ' + (article.description || '')),
            isRumor: false,
            sourceType: 'newsapi',
            author: article.author,
        }));

    } catch (error) {
        console.error('❌ NewsAPI Error:', error.message);
        return [];
    }
}

// ==================== FETCH FROM REDDIT ====================
async function fetchFromRedddit() {
    try {
        const subreddits = ['news', 'technology', 'worldnews', 'entertainment'];
        let articles = [];

        for (const subreddit of subreddits) {
            try {
                const response = await fetch(
                    `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
                    { 
                        headers: { 
                            'User-Agent': 'NewsFlow-App/1.0'
                        }
                    }
                );
                
                if (!response.ok) {
                    console.warn(`⚠️ Reddit ${subreddit}: Status ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                const posts = data.data?.children || [];

                const mappedPosts = posts
                    .filter(post => !post.data.is_self) // Filter out text posts
                    .map(post => ({
                        id: `reddit-${post.data.id}`,
                        title: post.data.title || 'Untitled',
                        description: post.data.selftext?.substring(0, 200) || post.data.title,
                        urlToImage: (post.data.preview?.images?.[0]?.source?.url || post.data.thumbnail)
                            && (post.data.preview?.images?.[0]?.source?.url || post.data.thumbnail).startsWith('http') 
                            ? (post.data.preview?.images?.[0]?.source?.url || post.data.thumbnail)
                            : null,
                        url: `https://reddit.com${post.data.permalink}`,
                        source: `r/${subreddit}`,
                        publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
                        category: categorizeArticle(post.data.title),
                        isRumor: detectRumor(post.data.title),
                        sourceType: 'reddit',
                        author: post.data.author,
                    }));

                articles = articles.concat(mappedPosts);
            } catch (err) {
                console.warn(`⚠️ Reddit ${subreddit} failed:`, err.message);
                continue;
            }
        }

        console.log(`Reddit: Fetched ${articles.length} posts`);
        return articles;

    } catch (error) {
        console.error('❌ Reddit Error:', error.message);
        return [];
    }
}

// ==================== FETCH RUMORS ====================
async function fetchRumors() {
    try {
        const apiKey = 'e84d76a31f934f83ac4d6e5ce76ce849';
        const rumorQueries = ['unconfirmed reports', 'alleged', 'rumored', 'sources claim'];
        let rumors = [];

        for (const query of rumorQueries) {
            try {
                const response = await fetch(
                    `https://newsapi.org/v2/everything?q="${query}"&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`,
                    {
                        headers: {
                            'Accept': 'application/json',
                        }
                    }
                );
                
                if (!response.ok) continue;
                
                const data = await response.json();
                const articles = data.articles || [];

                rumors = rumors.concat(articles.map(article => ({
                    id: `rumor-${article.url}`,
                    title: article.title || 'Untitled',
                    description: article.description || 'Unconfirmed report',
                    urlToImage: article.urlToImage || null,
                    url: article.url,
                    source: article.source?.name || 'Rumor Source',
                    publishedAt: article.publishedAt || new Date().toISOString(),
                    category: 'rumors',
                    isRumor: true,
                    sourceType: 'rumor',
                    author: article.author,
                })));
            } catch (err) {
                console.warn(`⚠️ Rumor query "${query}" failed`);
                continue;
            }
        }

        console.log(`Rumors: Fetched ${rumors.length} reports`);
        return rumors;

    } catch (error) {
        console.error('❌ Rumor fetch error:', error.message);
        return [];
    }
}

// ==================== LOAD SAMPLE NEWS (FALLBACK) ====================
function loadSampleNews() {
    console.log('📚 Loading sample news...');
    
    const sampleNews = [
        {
            id: 'sample-1',
            title: 'Revolutionary AI Model Achieves Major Breakthrough',
            description: 'Researchers announce groundbreaking advancement in artificial intelligence with new capabilities.',
            urlToImage: 'https://via.placeholder.com/340x200?text=AI+Breakthrough',
            url: '#',
            source: 'Tech News',
            publishedAt: new Date().toISOString(),
            category: 'tech',
            isRumor: false,
            sourceType: 'sample',
        },
        {
            id: 'sample-2',
            title: 'Stock Market Hits Record High',
            description: 'Financial markets reach all-time high amid economic optimism.',
            urlToImage: 'https://via.placeholder.com/340x200?text=Stock+Market',
            url: '#',
            source: 'Finance Daily',
            publishedAt: new Date().toISOString(),
            category: 'finance',
            isRumor: false,
            sourceType: 'sample',
        },
        {
            id: 'sample-3',
            title: 'Celebrity Announces Surprise Project',
            description: 'Major entertainment news as celebrity reveals unexpected collaboration.',
            urlToImage: 'https://via.placeholder.com/340x200?text=Entertainment',
            url: '#',
            source: 'Entertainment Now',
            publishedAt: new Date().toISOString(),
            category: 'entertainment',
            isRumor: false,
            sourceType: 'sample',
        },
        {
            id: 'sample-4',
            title: 'Government Announces New Policy Initiative',
            description: 'Officials unveil comprehensive plan to address key concerns.',
            urlToImage: 'https://via.placeholder.com/340x200?text=Politics',
            url: '#',
            source: 'Political News',
            publishedAt: new Date().toISOString(),
            category: 'politics',
            isRumor: false,
            sourceType: 'sample',
        },
        {
            id: 'sample-5',
            title: '⚠️ Alleged Rumors About Industry Changes',
            description: 'Unconfirmed reports suggest significant changes coming to the industry.',
            urlToImage: 'https://via.placeholder.com/340x200?text=Rumors',
            url: '#',
            source: 'Rumor Mill',
            publishedAt: new Date().toISOString(),
            category: 'rumors',
            isRumor: true,
            sourceType: 'sample',
        },
    ];

    newsApp.allNews = sampleNews;
    filterAndDisplayNews();
    updateTrending();
    updateLastUpdateTime();
}

// ==================== CATEGORIZATION ====================
function categorizeArticle(text) {
    if (!text) return 'all';
    
    const textLower = text.toLowerCase();

    if (textLower.match(/\b(movie|film|music|celebrity|actor|actress|entertainment|oscar|grammy|concert|netflix|hollywood)\b/i)) {
        return 'entertainment';
    }
    if (textLower.match(/\b(election|congress|senate|president|politician|policy|government|parliament|vote|parliament|minister)\b/i)) {
        return 'politics';
    }
    if (textLower.match(/\b(stock|crypto|bitcoin|market|finance|economy|earnings|trading|investment|bank|currency|forex)\b/i)) {
        return 'finance';
    }
    if (textLower.match(/\b(tech|ai|artificial intelligence|software|hardware|app|startup|innovation|coding|programming|app|digital|computer|internet)\b/i)) {
        return 'tech';
    }

    return 'all';
}

// ==================== RUMOR DETECTION ====================
function detectRumor(text) {
    if (!text) return false;
    
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
        'said to',
        'believed to',
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
        filtered = filtered.filter(news => {
            if (newsApp.currentCategory === 'rumors') {
                return news.isRumor;
            }
            return news.category === newsApp.currentCategory;
        });
    }

    // Search filter
    if (newsApp.currentSearch) {
        const searchTerm = newsApp.currentSearch.toLowerCase();
        filtered = filtered.filter(news =>
            (news.title && news.title.toLowerCase().includes(searchTerm)) ||
            (news.description && news.description.toLowerCase().includes(searchTerm))
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
            if (url !== '#') {
                window.open(url, '_blank');
            }
        });
    });
}

function createNewsCard(news) {
    const timeAgo = getTimeAgo(news.publishedAt);
    const rumorBadge = news.isRumor ? '<span class="rumor-badge">⚠️ RUMOR</span>' : '';
    const categoryClass = news.category || 'all';

    return `
        <div class="news-card" data-url="${news.url || '#'}">
            <img 
                src="${news.urlToImage || 'https://via.placeholder.com/340x200?text=No+Image'}" 
                alt="${news.title}"
                class="news-image"
                onerror="this.src='https://via.placeholder.com/340x200?text=No+Image&bg=667eea'"
                loading="lazy"
            >
            <div class="news-card-content">
                <div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
                        <span class="news-category ${categoryClass}">${(news.category || 'general').toUpperCase()}</span>
                        ${rumorBadge}
                    </div>
                    <h3 class="news-title">${news.title || 'Untitled'}</h3>
                    <p class="news-description">${news.description || 'No description available'}</p>
                </div>
                <div class="news-meta">
                    <span class="news-source">
                        <i class="fas fa-globe"></i>
                        ${news.source || 'Unknown'}
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
    
    if (trending.length === 0) {
        DOM.trendingContainer.innerHTML = '<p style="padding: 20px;">Loading trending articles...</p>';
        return;
    }

    DOM.trendingContainer.innerHTML = trending.map(news => `
        <div class="trending-card" onclick="window.open('${news.url || '#'}', '${news.url === '#' ? '' : '_blank'}')">
            <div class="trending-card-content">
                <span class="trending-badge">${(news.category || 'general').toUpperCase()}</span>
                <h3 class="trending-title">${news.title || 'Untitled'}</h3>
                <div class="trending-source">
                    <i class="fas fa-globe"></i>
                    ${news.source || 'Unknown Source'}
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
    if (!newsApp.currentSearch) {
        showToast('Please enter a search term', 'warning');
        return;
    }
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
    DOM.refreshBtn.classList.add('refresh-animate');
    
    fetchAllNews().then(() => {
        showToast('News refreshed!', 'success');
        DOM.refreshBtn.classList.remove('refresh-animate');
    }).catch(err => {
        showToast('Refresh failed. Retrying...', 'error');
        setTimeout(refreshNews, 3000);
    });
}

// ==================== AUTO UPDATE ====================
function startAutoUpdate() {
    newsApp.autoUpdateInterval = setInterval(() => {
        console.log('🔄 Auto-updating news...');
        fetchAllNews().catch(err => {
            console.warn('Auto-update failed, will retry later');
        });
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
    try {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';

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
    } catch (e) {
        return 'recently';
    }
}

function removeDuplicates(articles) {
    const seen = new Set();
    const unique = [];
    
    articles.forEach(article => {
        const key = (article.title || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(article);
        }
    });
    
    return unique;
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add refresh animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    .refresh-animate {
        animation: spin 1s linear !important;
    }
`;
document.head.appendChild(style);

// Cleanup on page unload
window.addEventListener('beforeunload', stopAutoUpdate);

console.log('✅ Script loaded successfully');
