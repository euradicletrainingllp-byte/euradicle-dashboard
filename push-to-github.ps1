# ── ELOP: Push to GitHub + Deploy to Vercel ──────────────────────────────────
# Run this from the elop/ folder in PowerShell:
#   cd "C:\Users\RevanthRamKallepalli\EuRadicle Dashboard\elop"
#   .\push-to-github.ps1

$GITHUB_USERNAME = "YOUR_GITHUB_USERNAME"   # ← change this
$REPO_NAME       = "euradicle-dashboard"
$GITHUB_TOKEN    = "YOUR_GITHUB_PAT"        # ← change this (github.com/settings/tokens → New classic token → repo scope)

# ── Step 1: Create GitHub repo ────────────────────────────────────────────────
Write-Host "`n[1/4] Creating GitHub repo '$REPO_NAME'..." -ForegroundColor Cyan
$headers = @{
    Authorization = "Bearer $GITHUB_TOKEN"
    Accept        = "application/vnd.github+json"
}
$body = @{
    name        = $REPO_NAME
    description = "EuRadicle Learning Operations Platform (ELOP) — Phase 1"
    private     = $false
    auto_init   = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json" | Out-Null
Write-Host "   Repo created (or already exists)." -ForegroundColor Green

# ── Step 2: Git init & push ───────────────────────────────────────────────────
Write-Host "`n[2/4] Initialising git and pushing code..." -ForegroundColor Cyan

git init
git config user.email "euradicletrainingllp@gmail.com"
git config user.name "EuRadicle"
git add -A
git commit -m "feat: ELOP Phase 1 Sprint 1 - full stack foundation

- 15-table PostgreSQL schema on Supabase
- Express API: auth, users, orgs, cohorts, enrollments, assessments
- React frontend: 3D particle login, Super Admin dashboard
- Vercel deployment config"

git branch -M main

$remoteUrl = "https://${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
git remote add origin $remoteUrl 2>$null || git remote set-url origin $remoteUrl
git push -u origin main --force

Write-Host "   Code pushed to: https://github.com/$GITHUB_USERNAME/$REPO_NAME" -ForegroundColor Green

# ── Step 3: Install Vercel CLI & deploy ───────────────────────────────────────
Write-Host "`n[3/4] Deploying to Vercel..." -ForegroundColor Cyan
npm install -g vercel 2>$null

Write-Host "`n   Vercel will now ask you to log in. Follow the prompts." -ForegroundColor Yellow
Write-Host "   When asked for project settings, use these answers:" -ForegroundColor Yellow
Write-Host "   - Link to existing project? NO" -ForegroundColor White
Write-Host "   - Project name: euradicle-dashboard" -ForegroundColor White
Write-Host "   - Root directory: ./ (default)" -ForegroundColor White
Write-Host "   - Build command: cd client && npm install && npm run build" -ForegroundColor White
Write-Host "   - Output dir: client/dist" -ForegroundColor White
Write-Host ""

vercel --prod

Write-Host "`n[4/4] Done! Set these env vars in Vercel dashboard:" -ForegroundColor Cyan
Write-Host "   SUPABASE_URL         = https://lkfqoqwvjuuharlkxlwf.supabase.co" -ForegroundColor White
Write-Host "   SUPABASE_SERVICE_KEY = <your service role key>" -ForegroundColor White
Write-Host "   JWT_SECRET           = <random 32+ char string>" -ForegroundColor White
Write-Host "   NODE_ENV             = production" -ForegroundColor White
Write-Host ""
Write-Host "   Dashboard: https://vercel.com/dashboard" -ForegroundColor Green
