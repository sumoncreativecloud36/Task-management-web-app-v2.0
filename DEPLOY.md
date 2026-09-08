# Deploying: zip → GitHub → Vercel

## 1. Upload the code to GitHub

Unzip `task-manager.zip`. You get the project folder — `package.json`, `src/`,
`supabase/` and so on. **Do not** commit `node_modules/` or `dist/`; neither is
in the zip, and `.gitignore` already excludes them.

Either drag the files into GitHub's web uploader on your empty repository, or
from a terminal in the unzipped folder:

```bash
git init
git add -A
git commit -m "Task Manager"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> If you use GitHub's **web** uploader, check afterwards that the dot-files
> `.gitignore` and `.env.example` actually arrived — some browsers silently skip
> hidden files when you drag a folder in. If they are missing, add them with
> "Add file → Create new file".

## 2. Import into Vercel

1. Vercel → **Add New… → Project** → import the GitHub repository.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
   `vercel.json` already sets these, so the defaults should be correct.
3. Deploy.

At this point the app is live and fully usable — it stores data in the
browser. Add the two variables below to switch it to Supabase.

## 3. Connect Supabase (optional)

In Vercel → **Project → Settings → Environment Variables**, add both for
Production, Preview and Development:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's publishable / anon key |

These are read at **build** time by Vite, so **redeploy** after adding them
(Deployments → ⋯ → Redeploy). Until they are set, the app runs in local mode.

The anon key is designed to be public — every table is protected by row-level
security, so it grants nothing on its own. Never put the **service role** key in
this project.

### Apply the database schema

In the Supabase dashboard → **SQL Editor**, paste the whole of
`supabase/migrations/0001_init.sql` and run it. It is idempotent, so running it
twice is harmless.

### Turn off email confirmation (required for instant sign-up)

The app is built so a new account logs in **immediately** with just an email and
password — no confirmation email. For that to work you must turn confirmation
off once:

Supabase → **Authentication → Sign In / Providers → Email** → turn **off**
**Confirm email** → save.

Leave it on and sign-up will create the account but the app will tell the user
the project still requires confirmation (and where to disable it).

### Point Supabase Auth at your domain

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/**` and, if you develop
  locally, `http://localhost:5173/**`

## Troubleshooting

**Build fails on Vercel but works locally** — make sure `package-lock.json` was
committed, and that Node 18+ is selected under Settings → General.

**App loads but still says "This browser" under Settings → Storage** — the env
vars are missing or the project was not redeployed after adding them. Vite
inlines `VITE_*` at build time; changing them requires a new build.

**Sign-in works but no data appears** — the migration has not been run on that
project, or it was run on a different project than the URL points to.
