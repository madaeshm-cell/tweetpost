{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "public",
  "env": {
    "NEWSAPI_KEY": "@newsapi_key",
    "TWITTER_BEARER_TOKEN": "@twitter_bearer_token"
  },
  "routes": [
    {
      "src": "/.*",
      "dest": "/"
    }
  ]
}