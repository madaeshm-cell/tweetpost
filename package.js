{
  "name": "newsflow-app",
  "version": "1.0.0",
  "description": "Real-time News Aggregator Web App",
  "main": "script.js",
  "scripts": {
    "start": "python -m http.server 8000",
    "build": "echo 'No build needed for static site'",
    "deploy": "vercel --prod"
  },
  "keywords": [
    "news",
    "aggregator",
    "real-time",
    "newsapi",
    "reddit",
    "twitter"
  ],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "vercel": "^latest"
  }
}