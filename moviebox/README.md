# MovieBox
Cinematic movie discovery site. Node/Express backend (secure TMDB proxy) + vanilla JS + Tailwind.

## Run locally
1. Install Node.js 18+ (https://nodejs.org)
2. `npm install`
3. Open `.env` and paste your TMDB **API Read Access Token** into `TMDB_ACCESS_TOKEN` (the API key already works as a fallback)
4. `npm start` then open http://localhost:3000

## Push to GitHub
```
git init
git add .
git commit -m "Initial commit: MovieBox"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/moviebox.git
git push -u origin main
```
(`.env` is git-ignored, so your keys are not uploaded.)

## Deploy on Vercel
1. Go to vercel.com, sign in with GitHub, click **Add New > Project**, import `moviebox`.
2. Leave build settings as they are (`vercel.json` handles it).
3. Open **Environment Variables** and add `TMDB_API_KEY` and `TMDB_ACCESS_TOKEN`.
4. Click **Deploy**. Your site goes live at `https://moviebox-xxxx.vercel.app`.
