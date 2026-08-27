# Deploy Alara on Vercel

Alara keeps jobs, calendar, photos, and posters in **Supabase Storage** (not the Vercel disk). Auth stays on Supabase. Gemini stays on env vars.

## 1. GitHub

Push `school-alara` to a GitHub repo (root of the Next app, or set Root Directory to `school-alara`).

## 2. Vercel project

Import that repo. Framework: Next.js.

## 3. Environment variables

Copy from `.env.local` into Vercel **Production** (and Preview if you want):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional)
- `GEMINI_IMAGE_MODEL` (optional)
- `NEXT_PUBLIC_APP_URL` = `https://YOUR-PROJECT.vercel.app`

After the first deploy, set `NEXT_PUBLIC_APP_URL` to the real Vercel URL if you used a placeholder, then redeploy.

Optional mail: `GOOGLE_CLIENT_ID` / `SECRET`, `MICROSOFT_CLIENT_ID` / `SECRET`.

## 4. Supabase Auth URLs

In Supabase → Authentication → URL configuration:

- Site URL: `https://YOUR-PROJECT.vercel.app`
- Redirect URLs add: `https://YOUR-PROJECT.vercel.app/auth/callback`
- Keep `http://localhost:3001/**` for local login

## 5. Phone APK

```powershell
$env:CAPACITOR_SERVER_URL="https://YOUR-PROJECT.vercel.app"
npm run cap:sync
npm run cap:apk
```

Staff can use mobile data. Your PC does not need to be on.

## Limits

Hobby Vercel request body is about 4.5 MB. Large photo uploads may need a smaller picture or a paid plan.
