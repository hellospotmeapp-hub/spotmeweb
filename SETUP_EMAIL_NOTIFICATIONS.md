# Setting Up Admin Email Notifications

  Every time someone submits a need for review, SpotMe will email you automatically.
  You need to do this ONE TIME after merging the PR.

  ---

  ## Step 1 — Get a free Resend account

  1. Go to [resend.com](https://resend.com) and sign up (free tier is plenty)
  2. Go to **API Keys** → **Create API Key**
  3. Name it "SpotMe" and copy the key (starts with `re_`)

  ---

  ## Step 2 — Verify your sending domain

  In Resend → **Domains** → **Add Domain** → enter `spotmeone.com`

  Follow the DNS instructions (add the TXT/MX records Resend shows you).
  This lets emails come from `notifications@spotmeone.com` instead of a Resend address.

  > If you don't want to do DNS setup right now, change the `from` line in  
  > `supabase/functions/notify-admin/index.ts` to use `onboarding@resend.dev`  
  > (Resend's test address — works immediately, no domain needed).

  ---

  ## Step 3 — Store the API key in Supabase

  1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
  2. Select your SpotMe project (**wjhxrpwobnyntokegrtx**)
  3. Click **Edge Functions** in the left sidebar
  4. Click **Manage secrets**
  5. Add a new secret:
     - **Name:** `RESEND_API_KEY`
     - **Value:** your key from Step 1

  ---

  ## Step 4 — Deploy the edge function

  Install the Supabase CLI if you haven't:
  ```bash
  npm install -g supabase
  ```

  Then from the root of this repo:
  ```bash
  supabase login
  supabase link --project-ref wjhxrpwobnyntokegrtx
  supabase functions deploy notify-admin
  ```

  That's it. The next time anyone submits a need, you'll get an email like this:

  ---

  **Subject:** New Need for Review: "Groceries for the week" — $75.00

  > From: Sharron P · Detroit  
  > Need: Groceries for the week  
  > Amount: $75.00  
  > Category: Food  
  >
  > [Review in Admin Panel →]

  ---

  ## Emails go to
  - thehallsales@gmail.com  
  - vargas122@gmail.com

  To change these, edit `ADMIN_EMAILS` at the top of  
  `supabase/functions/notify-admin/index.ts`.
  