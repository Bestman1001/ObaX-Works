# FixAm 9ja Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Go to Project Settings > API.
5. Copy the Project URL and anon public key into `supabase-config.js`.
6. Go to Authentication > URL Configuration.
7. Set Site URL to `https://bestman1001.github.io/FixAm-9ja/`.
8. Add `https://bestman1001.github.io/FixAm-9ja/account.html` to Redirect URLs.
9. Create an admin user in Authentication > Users.
10. Add the admin user to `public.admin_profiles`.

Use this after creating the Supabase Auth user, replacing the email:

```sql
insert into public.admin_profiles (user_id, email)
select id, email
from auth.users
where email = 'you@example.com'
on conflict (user_id) do update set email = excluded.email;
```

The public website gets insert access to `quote_requests`, `artisan_applications`, customer reviews, media metadata, the public `fixam-media` Storage bucket, and the private `fixam-verification` Storage bucket for identity proof uploads. Anonymous visitors can read active artisan profiles, public review summaries, public media metadata, and artisan standing so marketplace listings and ratings can update. Anonymous visitors cannot read private quote/customer details or identity verification media.

## Artisan Directory Flow

1. Artisan submits the public onboarding form with NIN consent and a selfie/liveness proof.
2. Admin opens `admin.html` and reviews the application.
3. Admin clicks `Create artisan profile`.
4. The profile is inserted into `public.artisans` and appears in the public directory when its profile status is `active`.
5. Admin can manage profile status, plan, verification, and quality standing from the dashboard.

## Review Flow

1. Admin opens `admin.html`.
2. Admin copies a review link from a quote request after the job is done.
3. Customer opens the link and submits `review.html`.
4. Review publishes automatically.
5. Admin can hide/flag unsafe reviews, or mark an artisan as warning, suspended, or removed.

## Accounts + Media Flow

1. Run the latest `schema.sql` to create `user_profiles`, `media_uploads`, and the `fixam-media` Storage bucket.
2. Customers or artisans open `account.html` and create/sign into an account.
3. Public quote requests, artisan applications, and reviews can attach up to four image/video files per submission.
4. Artisans can claim a listed profile when their account phone number matches an unowned artisan profile.
5. Claimed artisans can see a quote-lead count for customer requests sent to their artisan profile.
6. Claimed artisans can upload portfolio media from the account dashboard.

## NIN + Selfie/Liveness Verification Edge Function

The browser must never call an identity provider directly. Deploy `supabase/functions/verify-nin` and store VerifyMe/QoreID, Youverify, or another provider's credentials as Supabase Edge Function secrets.

Minimum deploy flow:

```bash
supabase functions deploy verify-nin
```

Production secrets:

```bash
supabase secrets set IDENTITY_PROVIDER_NAME=your_provider_name
supabase secrets set IDENTITY_PROVIDER_URL=https://provider.example/verify-identity
supabase secrets set IDENTITY_PROVIDER_API_KEY=provider_secret_key
```

QoreID workflow/session verification secrets:

```bash
supabase secrets set IDENTITY_PROVIDER_NAME=qoreid
supabase secrets set IDENTITY_PROVIDER_MODE=live
supabase secrets set QOREID_CLIENT_ID=your_qoreid_client_id
supabase secrets set QOREID_CLIENT_SECRET=your_qoreid_client_secret
supabase secrets set QOREID_WORKFLOW_ID=1949
supabase secrets set QOREID_PRODUCT_CODE=fixam-artisan-identity
```

When `IDENTITY_PROVIDER_NAME=qoreid` and `QOREID_WORKFLOW_ID` is set, the function creates a QoreID session with `POST https://api.qoreid.com/v1/sessions` using a short `QOREID_PRODUCT_CODE`. The browser then shows a secure "Continue identity verification" link for the artisan to complete identity checks in QoreID. If `QOREID_WORKFLOW_ID` is not set, the function falls back to the direct NIN face verification endpoint.

Optional secrets:

```bash
supabase secrets set IDENTITY_PROVIDER_AUTH_HEADER=Authorization
supabase secrets set IDENTITY_PROVIDER_MODE=mock
supabase secrets set QOREID_BASE_URL=https://api.qoreid.com
supabase secrets set QOREID_CALLBACK_URL=https://your-domain.example/qoreid-webhook
supabase secrets set QOREID_REDIRECT_URL=https://bestman1001.github.io/FixAm-9ja/account.html
```

The older `NIN_PROVIDER_*` names also work for compatibility. `IDENTITY_PROVIDER_MODE=mock` is for local/product testing only. Do not use mock mode for launch. If no provider URL/key is set, applications remain `pending` and the function records that the provider is not configured.

The function stores only:

- `nin_last4`
- NIN and liveness consent timestamps
- private selfie/liveness media count
- verification status
- provider reference
- small response summary

It does not store raw NIN. Selfie/liveness files are uploaded to the private `fixam-verification` bucket and are not public portfolio media.

When a provider URL/key is configured, the Edge Function creates temporary signed URLs for the private selfie/liveness files and sends those URLs to the provider. The files remain private in Supabase Storage.
