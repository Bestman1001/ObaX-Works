# FixAm 9ja Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Go to Project Settings > API.
5. Copy the Project URL and anon public key into `supabase-config.js`.

The public website only gets insert access to `quote_requests`. Anonymous visitors cannot read, update, or delete quote requests because no public policies are created for those actions.
