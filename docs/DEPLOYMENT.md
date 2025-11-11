# Deployment Guide - Pencas Hípicas

## Prerequisites

- Node.js 18+ installed
- Git repository initialized
- Supabase account
- Vercel account (recommended for Next.js deployment)

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: `pencas-hipicas`
   - Database Password: Generate secure password
   - Region: Choose closest to your users
4. Wait for project to initialize (~2 minutes)

### Get API Keys

1. Go to Project Settings > API
2. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Verify tables created
supabase db remote list
```

### Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy create-penca
supabase functions deploy add-race-batch
supabase functions deploy close-predictions
supabase functions deploy publish-result
supabase functions deploy recalculate-scores
supabase functions deploy join-with-code

# Set secrets for functions
supabase secrets set SUPABASE_URL=your-project-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Configure Auth

1. Go to Authentication > Providers
2. Enable **Email** provider
3. (Optional) Enable **Google OAuth**:
   - Add Google Client ID and Secret
   - Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
4. Go to Authentication > URL Configuration
5. Set Site URL: `https://your-domain.com`
6. Add Redirect URLs: `https://your-domain.com/**`

### Configure Storage

Storage buckets are created via migration. Verify in Storage section:
- `avatars` (public)
- `pencas-assets` (public)

### Enable Realtime

Go to Database > Replication and enable realtime for:
- `scores`
- `races`
- `predictions`

---

## 2. Vercel Deployment

### Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Configure:
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```bash
# Public (visible to client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Secret (server-only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deploy

```bash
# Deploy via Git push
git add .
git commit -m "Initial deployment"
git push origin main

# Or deploy via Vercel CLI
npm install -g vercel
vercel --prod
```

---

## 3. Custom Domain (Optional)

### Add Domain in Vercel

1. Go to Project Settings > Domains
2. Add your domain: `pencas.example.com`
3. Configure DNS:
   - Type: `CNAME`
   - Name: `pencas` (or `@` for root)
   - Value: `cname.vercel-dns.com`

### Update Supabase Auth URLs

1. Go to Supabase > Authentication > URL Configuration
2. Update Site URL: `https://pencas.example.com`
3. Update Redirect URLs: `https://pencas.example.com/**`

---

## 4. Seed Production Data

### Create Admin User

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User"
3. Fill in:
   - Email: `admin@example.com`
   - Password: Generate secure password
   - User Metadata: `{"role": "admin"}`
4. Confirm email manually in dashboard

### OR Update Existing User to Admin

```sql
-- Run in Supabase SQL Editor
UPDATE profiles
SET role = 'admin'
WHERE id = 'user-uuid-here';
```

---

## 5. Monitoring & Maintenance

### Supabase Dashboard

- **Database**: Monitor queries, connections
- **Edge Functions**: View logs, invocations
- **Auth**: Track signups, sessions
- **Storage**: Monitor usage

### Vercel Analytics

- Enable in Project Settings > Analytics
- Track performance, errors

### Set Up Backups

```bash
# Supabase auto-backups (daily)
# Manual backup:
supabase db dump -f backup.sql

# Restore:
supabase db reset --db-url "postgresql://..."
```

---

## 6. Environment-Specific Configs

### Development (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (Vercel)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## 7. Post-Deployment Checklist

- [ ] Test user registration & login
- [ ] Create test penca as admin
- [ ] Add races and entries
- [ ] Test predictions (as regular user)
- [ ] Publish results and verify score calculation
- [ ] Check Realtime updates
- [ ] Verify invite codes work
- [ ] Test mobile responsiveness
- [ ] Check all pages load correctly
- [ ] Review Supabase RLS policies
- [ ] Monitor initial user feedback

---

## 8. Scaling Considerations

### Database

- **Connection Pooling**: Use Supabase's built-in pooler
- **Indexes**: Already created in migrations
- **Archiving**: Consider archiving closed pencas older than 1 year

### Edge Functions

- **Concurrent Requests**: Supabase handles auto-scaling
- **Cold Starts**: First request may be slower (~1-2s)
- **Optimization**: Keep functions under 10MB

### Storage

- **CDN**: Supabase uses Cloudflare CDN automatically
- **Limits**: Free tier = 1GB, Pro = 100GB
- **Cleanup**: Remove unused avatars periodically

### Realtime

- **Connections**: Free tier = 200 concurrent
- **Rate Limits**: 100 messages/second per connection
- **Optimization**: Use presence for active users only

---

## 9. Troubleshooting

### "Unauthorized" Errors

- Check JWT token is valid
- Verify RLS policies allow operation
- Ensure user role is correct

### Edge Function Timeouts

- Default timeout: 60s
- Check function logs in Supabase dashboard
- Optimize database queries

### Realtime Not Working

- Verify replication enabled on tables
- Check client subscriptions
- Ensure RLS policies allow SELECT

### Migration Conflicts

```bash
# Reset local database
supabase db reset

# Re-apply migrations
supabase db push
```

---

## 10. CI/CD Pipeline (Optional)

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## Support

For issues:
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
