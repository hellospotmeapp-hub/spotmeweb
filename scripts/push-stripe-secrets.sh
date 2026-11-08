#!/bin/sh
# Sets the Stripe secret key on a Supabase project from .env.secrets, without printing it.
#   scripts/push-stripe-secrets.sh prod      -> STRIPE_SECRET_KEY_LIVE on production
#   scripts/push-stripe-secrets.sh staging   -> STRIPE_SECRET_KEY_TEST on the staging project
# Staging needs STAGING_PROJECT_REF in .env.secrets.
set -e
cd "$(dirname "$0")/.."
val() { grep "^$1=" .env.secrets | head -1 | cut -d= -f2- | tr -d "\"' \r"; }

case "$1" in
  prod)    REF=wjhxrpwobnyntokegrtx;     KEY=$(val STRIPE_SECRET_KEY_LIVE); PREFIX=sk_live_ ;;
  staging) REF=$(val STAGING_PROJECT_REF); KEY=$(val STRIPE_SECRET_KEY_TEST); PREFIX=sk_test_ ;;
  *) echo "usage: $0 prod|staging"; exit 1 ;;
esac

[ -n "$REF" ] || { echo "STAGING_PROJECT_REF is not set in .env.secrets"; exit 1; }
case "$KEY" in "$PREFIX"*) ;; *) echo "Expected a $PREFIX key in .env.secrets for $1"; exit 1 ;; esac

supabase secrets set --project-ref "$REF" STRIPE_SECRET_KEY="$KEY"
echo "STRIPE_SECRET_KEY ($PREFIX...) set on $REF. Webhook signing secrets: set STRIPE_WEBHOOK_SECRET (live) / STRIPE_WEBHOOK_SECRET_2 (test) the same way."
