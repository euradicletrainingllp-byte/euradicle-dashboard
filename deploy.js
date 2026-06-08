#!/usr/bin/env node
/**
 * ELOP — GitHub Push + Vercel Deploy
 * Zero dependencies — uses only Node.js built-ins.
 * Run: node deploy.js
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const TOKEN    = process.env.GITHUB_TOKEN || ''; // set via: $env:GITHUB_TOKEN="ghp_..."
const REPO     = 'euradicle-dashboard';
const ROOT_DIR = __dirname;

// Files to skip
const SKIP_DIRS  = new Set(['node_modules', '.git', 'dist', '.vercel', 'build']);
const SKIP_FILES = new Set(['deploy.js', 'push-to-github.ps1', 'server/.env', 'package-lock.json', 'server/package-lock.json']);

// ── GitHub API helper ─────────────────────────────────────────────────────────
function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        Authorization:  `Bearer ${TOKEN}`,
        Accept:         'application/vnd.github+json',
        'User-Agent':   'ELOP-Deploy',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Collect files recursively ─────────────────────────────────────────────────
function collectFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result  = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) result.push(...collectFiles(path.join(dir, e.name), rel));
    } else {
      if (!SKIP_FILES.has(rel)) result.push({ abs: path.join(dir, e.name), rel });
    }
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 ELOP Deploy Script\n');

  // 1. Get GitHub username
  console.log('→ Authenticating with GitHub...');
  const me = await ghRequest('GET', '/user');
  if (me.status !== 200) {
    console.error('✗ Auth failed:', me.body.message || me.status);
    process.exit(1);
  }
  const USERNAME = me.body.login;
  console.log(`  Logged in as: ${USERNAME}`);

  // 2. Create repo
  console.log(`\n→ Creating repo "${REPO}"...`);
  const createRes = await ghRequest('POST', '/user/repos', {
    name:        REPO,
    description: 'EuRadicle Learning Operations Platform (ELOP) — Phase 1',
    private:     false,
    auto_init:   false,
  });
  if (createRes.status === 201) {
    console.log(`  ✓ Repo created: https://github.com/${USERNAME}/${REPO}`);
  } else if (createRes.status === 422) {
    console.log(`  ℹ Repo already exists — will update files.`);
  } else {
    console.error('  ✗ Create failed:', createRes.body.message);
    process.exit(1);
  }

  // 3. Collect & push files
  const files = collectFiles(ROOT_DIR);
  console.log(`\n→ Pushing ${files.length} files...\n`);

  let ok = 0, fail = 0;
  for (const { abs, rel } of files) {
    const content = fs.readFileSync(abs).toString('base64');

    // Check if file already exists (need its SHA for update)
    const existing = await ghRequest('GET', `/repos/${USERNAME}/${REPO}/contents/${encodeURIComponent(rel)}`);
    const sha      = existing.status === 200 ? existing.body.sha : undefined;

    const res = await ghRequest('PUT', `/repos/${USERNAME}/${REPO}/contents/${encodeURIComponent(rel)}`, {
      message: sha ? `update: ${rel}` : `add: ${rel}`,
      content,
      ...(sha ? { sha } : {}),
    });

    if (res.status === 200 || res.status === 201) {
      process.stdout.write(`  ✓ ${rel}\n`);
      ok++;
    } else {
      process.stdout.write(`  ✗ ${rel}: ${res.body.message}\n`);
      fail++;
    }
  }

  console.log(`\n  Pushed: ${ok}  Failed: ${fail}`);
  console.log(`\n✅ GitHub: https://github.com/${USERNAME}/${REPO}\n`);

  // 4. Open Vercel deploy URL
  const vercelUrl = `https://vercel.com/new/clone?repository-url=https://github.com/${USERNAME}/${REPO}&project-name=euradicle-dashboard&build-command=cd+client+%26%26+npm+install+%26%26+npm+run+build&output-directory=client%2Fdist&install-command=npm+install+%26%26+cd+server+%26%26+npm+install`;
  console.log('→ Next: Deploy to Vercel');
  console.log(`  Open this URL to deploy in one click:\n`);
  console.log(`  ${vercelUrl}\n`);
  console.log('  Or connect at: https://vercel.com/new\n');

  console.log('→ Set these env vars in Vercel dashboard → Project → Settings → Environment Variables:');
  console.log('  SUPABASE_URL         = https://lkfqoqwvjuuharlkxlwf.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY = <your service role key from Supabase dashboard>');
  console.log('  JWT_SECRET           = elop_jwt_secret_change_in_production_min32chars');
  console.log('  NODE_ENV             = production\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
