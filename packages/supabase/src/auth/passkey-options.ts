// Shared `auth` options for every Supabase client the Next apps build.
//
// Passkeys are a beta Supabase Auth feature: `auth.signInWithPasskey()`,
// `auth.registerPasskey()`, `auth.passkey.*` and `auth.admin.passkey.*` all
// throw unless the client was created with this opt-in. Only web-admin calls
// them today, but the flag is inert for everyone else (it gates method
// availability, not behaviour), so it lives in one place rather than being
// threaded through each app's client factory.
export const PASSKEY_AUTH_OPTIONS = {
  experimental: { passkey: true },
} as const;
