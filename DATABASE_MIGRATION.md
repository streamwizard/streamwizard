# Database Migration for Token Encryption

## Overview

To support encrypted token storage, you need to add new columns to your Supabase tables to store the initialization vector (IV) and authentication tag for each encrypted token.

## Required Migrations

### 1. Update `integrations_twitch` Table

Add columns for access token and refresh token encryption metadata:

```sql
-- Add columns for access token encryption
ALTER TABLE integrations_twitch
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS auth_tag TEXT;

-- Add columns for refresh token encryption
ALTER TABLE integrations_twitch
ADD COLUMN IF NOT EXISTS refresh_iv TEXT,
ADD COLUMN IF NOT EXISTS refresh_auth_tag TEXT;

-- Add comments for documentation
COMMENT ON COLUMN integrations_twitch.iv IS 'Base64-encoded initialization vector for access_token encryption';
COMMENT ON COLUMN integrations_twitch.auth_tag IS 'Base64-encoded authentication tag for access_token encryption';
COMMENT ON COLUMN integrations_twitch.refresh_iv IS 'Base64-encoded initialization vector for refresh_token encryption';
COMMENT ON COLUMN integrations_twitch.refresh_auth_tag IS 'Base64-encoded authentication tag for refresh_token encryption';
```

### 2. Update `twitch_app_token` Table

Add columns for app token encryption metadata:

```sql
-- Add columns for app token encryption
ALTER TABLE twitch_app_token
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS auth_tag TEXT;

-- Add comments for documentation
COMMENT ON COLUMN twitch_app_token.iv IS 'Base64-encoded initialization vector for access_token encryption';
COMMENT ON COLUMN twitch_app_token.auth_tag IS 'Base64-encoded authentication tag for access_token encryption';
```

## Migration Steps

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the SQL migrations above
5. Click **Run** to execute

### Option 2: Using Supabase CLI

1. Create a new migration file:

   ```bash
   supabase migration new add_token_encryption_columns
   ```

2. Edit the generated migration file in `supabase/migrations/` and add the SQL above

3. Apply the migration:
   ```bash
   supabase db push
   ```

## Data Migration (Existing Tokens)

> [!WARNING]
> **IMPORTANT**: Existing plaintext tokens in your database need to be encrypted or re-obtained.

### Option A: Re-authenticate Users (Recommended)

The safest approach is to have users re-authenticate:

1. Apply the schema migrations above
2. Clear existing tokens:

   ```sql
   UPDATE integrations_twitch
   SET access_token = NULL,
       refresh_token = NULL,
       iv = NULL,
       auth_tag = NULL,
       refresh_iv = NULL,
       refresh_auth_tag = NULL;

   UPDATE twitch_app_token
   SET access_token = NULL,
       iv = NULL,
       auth_tag = NULL;
   ```

3. Users will need to re-authenticate through your OAuth flow
4. New tokens will be automatically encrypted

### Option B: Encrypt Existing Tokens (Advanced)

If you need to preserve existing sessions, create a one-time migration script:

```typescript
// scripts/migrate-encrypt-tokens.ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptToken } from "@/server/crypto";

async function migrateTokens() {
  // Migrate user tokens
  const { data: users } = await supabaseAdmin
    .from("integrations_twitch")
    .select("id, access_token, refresh_token")
    .not("access_token", "is", null);

  for (const user of users || []) {
    const encryptedAccess = encryptToken(user.access_token);
    const encryptedRefresh = encryptToken(user.refresh_token);

    await supabaseAdmin
      .from("integrations_twitch")
      .update({
        access_token: encryptedAccess.ciphertext,
        iv: encryptedAccess.iv,
        auth_tag: encryptedAccess.authTag,
        refresh_token: encryptedRefresh.ciphertext,
        refresh_iv: encryptedRefresh.iv,
        refresh_auth_tag: encryptedRefresh.authTag,
      })
      .eq("id", user.id);
  }

  // Migrate app token
  const { data: appToken } = await supabaseAdmin
    .from("twitch_app_token")
    .select("id, access_token")
    .single();

  if (appToken?.access_token) {
    const encrypted = encryptToken(appToken.access_token);

    await supabaseAdmin
      .from("twitch_app_token")
      .update({
        access_token: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
      })
      .eq("id", appToken.id);
  }

  console.log("Migration complete!");
}

migrateTokens();
```

Run with:

```bash
bun run scripts/migrate-encrypt-tokens.ts
```

## Verification

After migration, verify the encryption is working:

1. Check that new columns exist:

   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'integrations_twitch'
   AND column_name IN ('iv', 'auth_tag', 'refresh_iv', 'refresh_auth_tag');
   ```

2. Check that tokens are encrypted (should see base64 strings):

   ```sql
   SELECT
     LEFT(access_token, 20) as access_token_preview,
     LEFT(iv, 20) as iv_preview,
     LEFT(auth_tag, 20) as auth_tag_preview
   FROM integrations_twitch
   LIMIT 1;
   ```

3. Test authentication flow:
   - Log in through Twitch OAuth
   - Verify tokens are stored encrypted
   - Verify API calls work correctly

## Rollback Plan

If you need to rollback:

```sql
-- Remove encryption columns
ALTER TABLE integrations_twitch
DROP COLUMN IF EXISTS iv,
DROP COLUMN IF EXISTS auth_tag,
DROP COLUMN IF EXISTS refresh_iv,
DROP COLUMN IF EXISTS refresh_auth_tag;

ALTER TABLE twitch_app_token
DROP COLUMN IF EXISTS iv,
DROP COLUMN IF EXISTS auth_tag;
```

Then revert the code changes to use plaintext tokens.

## Security Notes

> [!IMPORTANT]
>
> - The encryption key (`NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY`) must be kept secure
> - Use the same key across all environments for the same database
> - Rotating the encryption key requires re-encrypting all tokens
> - Consider using environment-specific keys for dev/staging/production

## Next Steps

1. ✅ Apply database migrations
2. ✅ Add `NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY` to environment variables
3. ✅ Test OAuth flow
4. ✅ Verify API calls work
5. ✅ Monitor for any decryption errors
