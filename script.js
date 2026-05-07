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
    autoUpdateInterval: null,
    updateIntervalTime: 60000,
};

const DOM = {};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NewsFlow Initializing...');
    
    // Initialize DOM references
    DOM.newsContainer = document.getElementById('newsContainer');
    DOM.loadingState = document.getElementById('loadingState');
    DOM.noResults = document.getElementById('noResults');
    DOM.loadMoreBtn = document.getElementById('loadMoreBtn');
    DOM.categoryBtns = document.querySelectorAll('.category-btn');
    DOM.searchInput = document.getElementById('searchInput');
    DOM.searchBtn = document.getElementById('searchBtn');
    DOM.themeToggle = document.getElementById('themeToggle');
    DOM.refreshBtn = document.getElementById('refreshBtn');
    DOM.lastUpdate = document.getElementById('lastUpdate');
    DOM.sortBtn = document.getElementById('sortBtn');
    DOM.sourceFilter = document.getElementById('sourceFilter');
    DOM.trendingContainer = document.getElementById('trendingContainer');
    DOM.activeFilters = document.getElementById('activeFilters');
    DOM.toastContainer = document.getElementById('toastContainer');
    
    initializeTheme();
    attachEventListeners();
    fetchAllNews();
    startAutoUpdate();
});

// ==================== THEME ====================
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        DOM.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    DOM.themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    showToast('Theme updated', 'success');
}

// ==================== EVENT LISTENERS ====================
function attachEventListeners() {
    DOM.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            newsApp.currentCategory = btn.dataset.category;
            newsApp.currentPage = 1;
            filterAndDisplayNews();
        });
    });

    DOM.searchBtn.addEventListener('click', performSearch);
    DOM.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.refreshBtn.addEventListener('click', refreshNews);
    DOM.loadMoreBtn.addEventListener('click', loadMoreNews);

    DOM.sortBtn.addEventListener('click', () => {
        newsApp.currentSort = newsApp.currentSort === 'latest' ? 'oldest' : 'latest';
        DOM.sortBtn.innerHTML = newsApp.currentSort === 'latest' 
            ? '<i class="fas fa-sort"></i> Latest' 
            : '<i class="fas fa-sort"></i> Oldest';
        filterAndDisplayNews();
    });

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
        console.log('📡 Fetching news from multiple RSS feeds...');

        const sources = [
            fetchRSSFeed('http://feeds.bbci.co.uk/news/rss.xml', 'BBC', 'bbc'),
            fetchRSSFeed('http://rss.cnn.com/rss/cnn_topstories.rss', 'CNN', 'cnn'),
            fetchRSSFeed('http://feeds.reuters.com/reuters/topNews', 'Reuters', 'reuters'),
            fetchRSSFeed('https://feeds.feedburner.com/TechCrunch/', 'TechCrunch', 'techcrunch'),
            fetchRSSFeed('http://feeds.bbci.co.uk/news/technology/rss.xml', 'BBC Tech', 'bbc'),
            fetchRSSFeed('http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'BBC Entertainment', 'bbc'),
            fetchRSSFeed('http://feeds.bbci.co.uk/news/business/rss.xml', 'BBC Business', 'bbc'),
            fetchRSSFeed('http://feeds.bbci.co.uk/news/politics/rss.xml', 'BBC Politics', 'bbc'),
            fetchHackerNews(),
            fetchReddit('news'),
            fetchReddit('worldnews'),
            fetchReddit('technology'),
            fetchReddit('entertainment'),
            fetchReddit('finance'),
            fetchReddit('politics'),
        ];

        const results = await Promise.allSettled(sources);
        
        let allArticles = [];
        let successCount = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
                allArticles = allArticles.concat(result.value);
                successCount++;
                console.log(`✅ Source ${index + 1}: ${result.value.length} articles`);
            } else {
                console.warn(`⚠️ Source ${index + 1} failed`);
            }
        });

        if (allArticles.length === 0) {
            console.warn('All sources failed, loading sample data');
            loadSampleNews();
            return;
        }

        // Remove duplicates and sort by date
        newsApp.allNews = removeDuplicates(allArticles)
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        console.log(`✅ Total: ${newsApp.allNews.length} articles from ${successCount} sources`);
        
        filterAndDisplayNews();
        updateTrending();
        updateLastUpdateTime();
        showToast(`Loaded ${newsApp.allNews.length} articles!`, 'success');
        
    } catch (error) {
        console.error('❌ Error:', error);
        loadSampleNews();
    } finally {
        showLoadingState(false);
    }
}

// ==================== FETCH RSS FEED (using rss2json) ====================
async function fetchRSSFeed(rssUrl, sourceName, sourceType) {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'ok' || !data.items) {
            return [];
        }

        return data.items.map((item, index) => ({
            id: `${sourceType}-${Date.now()}-${index}`,
            title: cleanText(item.title) || 'Untitled',
            description: cleanText(stripHTML(item.description || item.content || '')).substring(0, 200),
            urlToImage: item.thumbnail || item.enclosure?.link || extractImageFromContent(item.content) || null,
            url: item.link,
            source: sourceName,
            publishedAt: item.pubDate || new Date().toISOString(),
            category: categorizeArticle(item.title + ' ' + (item.description || '')),
            isRumor: detectRumor(item.title + ' ' + (item.description || '')),
            sourceType: sourceType,
            author: item.author || sourceName,
        }));
    } catch (error) {
        console.warn(`RSS ${sourceName} failed:`, error.message);
        return [];
    }
}

// ==================== FETCH HACKER NEWS ====================
async function fetchHackerNews() {
    try {
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        if (!response.ok) throw new Error('HN failed');
        
        const ids = await response.json();
        const top20 = ids.slice(0, 20);
        
        const stories = await Promise.all(
            top20.map(id => 
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
                    .then(r => r.json())
                    .catch(() => null)
            )
        );

        return stories
            .filter(s => s && s.title)
            .map(story => ({
                id: `hn-${story.id}`,
                title: story.title,
                description: story.text ? stripHTML(story.text).substring(0, 200) : `${story.score} points • ${story.descendants || 0} comments`,
                urlToImage: null,
                url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
                source: 'Hacker News',
                publishedAt: new Date(story.time * 1000).toISOString(),
                category: 'tech',
                isRumor: false,
                sourceType: 'hackernews',
                author: story.by,
            }));
    } catch (error) {
        console.warn('Hacker News failed:', error.message);
        return [];
    }
}

// ==================== FETCH REDDIT ====================
async function fetchReddit(subreddit) {
    try {
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`);
        if (!response.ok) throw new Error(`Reddit ${subreddit} failed`);
        
        const data = await response.json();
        const posts = data.data?.children || [];

        return posts
            .filter(post => post.data && post.data.title)
            .map(post => {
                const d = post.data;
                let image = null;
                
                if (d.preview?.images?.[0]?.source?.url) {
                    image = d.preview.images[0].source.url.replace(/&amp;/g, '&');
                } else if (d.thumbnail && d.thumbnail.startsWith('http')) {
                    image = d.thumbnail;
                }
                
                return {
                    id: `reddit-${d.id}`,
                    title: d.title,
                    description: d.selftext ? d.selftext.substring(0, 200) : `${d.score} upvotes • ${d.num_comments} comments`,
                    urlToImage: image,
                    url: `https://reddit.com${d.permalink}`,
                    source: `r/${subreddit}`,
                    publishedAt: new Date(d.created_utc * 1000).toISOString(),
                    category: subreddit === 'finance' ? 'finance' : 
                              subreddit === 'technology' ? 'tech' :
                              subreddit === 'entertainment' ? 'entertainment' :
                              subreddit === 'politics' ? 'politics' :
                              categorizeArticle(d.title),
                    isRumor: detectRumor(d.title),
                    sourceType: 'reddit',
                    author: d.author,
                };
            });
    } catch (error) {
        console.warn(`Reddit ${subreddit} failed:`, error.message);
        return [];
    }
}

// ==================== HELPERS ====================
function cleanText(text) {
    if (!text) return '';
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function stripHTML(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function extractImageFromContent(content) {
    if (!content) return null;
    const match = content.match(/<img[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
}

function categorizeArticle(text) {
    if (!text) return 'all';
    const t = text.toLowerCase();

    if (/\b(movie|film|music|celebrity|actor|actress|entertainment|oscar|grammy|netflix|hollywood|tv show|streaming)\b/i.test(t)) {
        return 'entertainment';
    }
    if (/\b(election|congress|senate|president|politician|policy|government|parliament|vote|minister|democrat|republican)\b/i.test(t)) {
        return 'politics';
    }
    if (/\b(stock|crypto|bitcoin|market|finance|economy|earnings|trading|investment|bank|currency|inflation|recession)\b/i.test(t)) {
        return 'finance';
    }
    if (/\b(tech|ai|artificial intelligence|software|hardware|app|startup|coding|google|apple|microsoft|meta|programming)\b/i.test(t)) {
        return 'tech';
    }
    return 'all';
}

function detectRumor(text) {
    if (!text) return false;
    const indicators = ['alleged', 'claimed', 'sources say', 'reportedly', 'unconfirmed', 'rumor', 'rumour', 'purportedly', 'supposedly', 'speculation', 'leaked'];
    return indicators.some(i => text.toLowerCase().includes(i));
}

function removeDuplicates(articles) {
    const seen = new Set();
    return articles.filter(article => {
        const key = (article.title || '').toLowerCase().trim().substring(0, 80);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ==================== SAMPLE NEWS FALLBACK ====================
function loadSampleNews() {
    console.log('Loading sample news...');
    newsApp.allNews = [
        { id: 's1', title: 'AI Breakthrough Announced by Major Tech Company', description: 'Revolutionary AI model achieves unprecedented capabilities in language understanding.', urlToImage: 'https://picsum.photos/400/250?random=1', url: '#', source: 'Tech News', publishedAt: new Date().toISOString(), category: 'tech', isRumor: false, sourceType: 'sample' },
        { id: 's2', title: 'Stock Market Reaches New Heights', description: 'Global markets surge to record levels amid economic optimism.', urlToImage: 'https://picsum.photos/400/250?random=2', url: '#', source: 'Finance Daily', publishedAt: new Date().toISOString(), category: 'finance', isRumor: false, sourceType: 'sample' },
        { id: 's3', title: 'Major Movie Premieres This Weekend', description: 'Highly anticipated blockbuster hits theaters worldwide.', urlToImage: 'https://picsum.photos/400/250?random=3', url: '#', source: 'Entertainment Now', publishedAt: new Date().toISOString(), category: 'entertainment', isRumor: false, sourceType: 'sample' },
        { id: 's4', title: 'Government Announces New Policy', description: 'Major legislative changes coming next month.', urlToImage: 'https://picsum.photos/400/250?random=4', url: '#', source: 'Political News', publishedAt: new Date().toISOString(), category: 'politics', isRumor: false, sourceType: 'sample' },
        { id: 's5', title: 'Alleged Industry Shakeup Coming', description: 'Sources claim major changes in the industry are imminent.', urlToImage: 'https://picsum.photos/400/250?random=5', url: '#', source: 'Rumor Mill', publishedAt: new Date().toISOString(), category: 'rumors', isRumor: true, sourceType: 'sample' },
        { id: 's6', title: 'New Smartphone Released', description: 'Latest flagship device features innovative camera technology.', urlToImage: 'https://picsum.photos/400/250?random=6', url: '#', source: 'Tech Daily', publishedAt: new Date().toISOString(), category: 'tech', isRumor: false, sourceType: 'sample' },
    ];
    filterAndDisplayNews();
    updateTrending();
    updateLastUpdateTime();
}

// ==================== FILTER & DISPLAY ====================
function filterAndDisplayNews() {
    let filtered = [...newsApp.allNews];

    if (newsApp.currentCategory !== 'all') {
        filtered = filtered.filter(news => {
            if (newsApp.currentCategory === 'rumors') return news.isRumor;
            return news.category === newsApp.currentCategory;
        });
    }

    if (newsApp.currentSearch) {
        const term = newsApp.currentSearch.toLowerCase();
        filtered = filtered.filter(news =>
            (news.title && news.title.toLowerCase().includes(term)) ||
            (news.description && news.description.toLowerCase().includes(term))
        );
    }

    if (newsApp.currentSource !== 'all') {
        filtered = filtered.filter(news => news.sourceType === newsApp.currentSource);
    }

    if (newsApp.currentSort === 'oldest') {
        filtered.reverse();
    }

    newsApp.filteredNews = filtered;
    displayNews();
    updateActiveFilters();
}

function displayNews() {
    const endIndex = newsApp.currentPage * newsApp.newsPerPage;
    const newsToDisplay = newsApp.filteredNews.slice(0, endIndex);

    if (newsToDisplay.length === 0) {
        DOM.newsContainer.innerHTML = '';
        DOM.noResults.style.display = 'flex';
        DOM.loadMoreBtn.style.display = 'none';
        return;
    }

    DOM.noResults.style.display = 'none';
    DOM.newsContainer.innerHTML = newsToDisplay.map(createNewsCard).join('');
    DOM.loadMoreBtn.style.display = endIndex < newsApp.filteredNews.length ? 'flex' : 'none';

    document.querySelectorAll('.news-card').forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.url;
            if (url && url !== '#') window.open(url, '_blank');
        });
    });
}

function createNewsCard(news) {
    const timeAgo = getTimeAgo(news.publishedAt);
    const rumorBadge = news.isRumor ? '<span class="rumor-badge">⚠️ RUMOR</span>' : '';
    const category = news.category || 'all';
    const imageUrl = news.urlToImage || `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`;

    return `
        <div class="news-card" data-url="${news.url || '#'}">
            <img src="${imageUrl}" alt="news" class="news-image" 
                 onerror="this.src='https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}'" loading="lazy">
            <div class="news-card-content">
                <div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                        <span class="news-category ${category}">${category.toUpperCase()}</span>
                        ${rumorBadge}
                    </div>
                    <h3 class="news-title">${news.title}</h3>
                    <p class="news-description">${news.description || 'Click to read more'}</p>
                </div>
                <div class="news-meta">
                    <span class="news-source"><i class="fas fa-globe"></i> ${news.source}</span>
                    <span class="news-time"><i class="fas fa-clock"></i> ${timeAgo}</span>
                </div>
            </div>
        </div>
    `;
}

function updateTrending() {
    const trending = newsApp.allNews.slice(0, 5);
    if (trending.length === 0) {
        DOM.trendingContainer.innerHTML = '<p style="padding:20px;color:var(--text-secondary);">Loading trending news...</p>';
        return;
    }

    DOM.trendingContainer.innerHTML = trending.map(news => `
        <div class="trending-card" onclick="${news.url && news.url !== '#' ? `window.open('${news.url}', '_blank')` : ''}">
            <div class="trending-card-content">
                <span class="trending-badge">${(news.category || 'NEWS').toUpperCase()}</span>
                <h3 class="trending-title">${news.title}</h3>
                <div class="trending-source"><i class="fas fa-globe"></i> ${news.source}</div>
            </div>
        </div>
    `).join('');
}

function updateActiveFilters() {
    const filters = [];
    if (newsApp.currentSearch) filters.push(`<div class="filter-tag"><i class="fas fa-search"></i> "${newsApp.currentSearch}" <button onclick="clearSearch()">×</button></div>`);
    if (newsApp.currentCategory !== 'all') filters.push(`<div class="filter-tag"><i class="fas fa-filter"></i> ${newsApp.currentCategory} <button onclick="clearCategoryFilter()">×</button></div>`);
    if (newsApp.currentSource !== 'all') filters.push(`<div class="filter-tag"><i class="fas fa-link"></i> ${newsApp.currentSource} <button onclick="clearSourceFilter()">×</button></div>`);
    DOM.activeFilters.innerHTML = filters.join('');
}

function clearSearch() {
    newsApp.currentSearch = '';
    DOM.searchInput.value = '';
    filterAndDisplayNews();
}

function clearCategoryFilter() {
    newsApp.currentCategory = 'all';
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
    filterAndDisplayNews();
}

function clearSourceFilter() {
    newsApp.currentSource = 'all';
    DOM.sourceFilter.value = 'all';
    filterAndDisplayNews();
}

function performSearch() {
    newsApp.currentSearch = DOM.searchInput.value.trim();
    newsApp.currentPage = 1;
    filterAndDisplayNews();
    if (newsApp.currentSearch) showToast(`Searching "${newsApp.currentSearch}"`, 'success');
}

function loadMoreNews() {
    newsApp.currentPage++;
    displayNews();
}

function refreshNews() {
    DOM.refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => DOM.refreshBtn.style.transform = '', 500);
    fetchAllNews();
}

function startAutoUpdate() {
    newsApp.autoUpdateInterval = setInterval(() => {
        console.log('🔄 Auto-update');
        fetchAllNews();
    }, newsApp.updateIntervalTime);
}

function showLoadingState(show) {
    DOM.loadingState.style.display = show ? 'flex' : 'none';
}

function updateLastUpdateTime() {
    const now = new Date();
    DOM.lastUpdate.textContent = `Updated: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function getTimeAgo(dateString) {
    try {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';
        return Math.floor(seconds / 2592000) + 'mo ago';
    } catch { return 'recently'; }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

console.log('✅ NewsFlow Script Loaded');
