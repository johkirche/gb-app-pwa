# Directus Backend Configuration Guide

## Overview

This document describes the backend setup required for the authentication / registration
system in the Gesangbuch Ionic app. Registration is handled by a custom Directus endpoint
extension that lives in its own (private) repository and is deployed separately:

```
git@github.com:johkirche/directus-user-register-extension.git
```

It used to be a git submodule here; that was removed because Cloudflare Workers Builds
cannot clone the private repo. The frontend only calls its HTTP endpoint at runtime.

> The extension's own `README.md` is the source of truth for its API. This guide focuses
> on how to deploy it and configure Directus so the app's registration flow works.

## Authentication Flow

1. **User Registration**: User provides email, password, and a registration code (plus
   optional first / last name).
2. **Code Validation**: The extension checks the code exists in `registration_codes` with
   status `open`.
3. **Account Creation**: A new user is created with status `active` and the configured
   default role; the code is marked `registered`.
4. **Auto-Login**: The app automatically logs the user in after a successful registration
   (`useAuth().register()` calls `login()`).
5. **Data Access**: The user can immediately download and access songs.

## Registration Endpoint

The frontend calls the extension from [`src/composables/useAuth.ts`](../src/composables/useAuth.ts):

**Path:** `/directus-user-register-extension/register`
(Directus mounts endpoint extensions under their name, so `router.post('/register', …)`
is exposed at `/<extension-name>/register`.)
**Method:** `POST`
**Request Body:**

```json
{
    "email": "user@example.com",
    "password": "Secret123!",
    "registration_code": "valid-code",
    "first_name": "John",
    "last_name": "Doe"
}
```

- `email`, `password`, `registration_code` are required.
- `first_name` / `last_name` are optional. The extension also accepts a single `name`
  field as a fallback (split on the first space), which the app does not use.

**Success Response (201):**

```json
{
    "success": true,
    "user": { "id": "…", "email": "user@example.com", "first_name": "John", "last_name": "Doe" }
}
```

**Error Response (400 / 409):** Directus error envelope, e.g.

```json
{ "errors": [{ "message": "Invalid or already used registration code", "extensions": { "code": "INVALID_PAYLOAD" } }] }
```

Error codes:

| Code | Status | Cause |
| --- | --- | --- |
| `USER_ALREADY_REGISTERED` | 409 | An account already exists for that email |
| `INVALID_PAYLOAD` | 400 | Missing fields, weak password, or an invalid / used code |

Only the duplicate-account case has its own code; the other causes are distinguished by
message text in [`translateRegistrationError`](../src/services/errorHandler.ts), which maps
the extension's English messages to the German strings shown in the UI.

Password requirements enforced by the extension (and mirrored in the UI):

- At least 8 characters
- At least one uppercase letter
- At least one number or special character

## Deploying the Extension

1. Clone the extension (outside this repository):

    ```bash
    git clone git@github.com:johkirche/directus-user-register-extension.git
    ```

2. Build it:

    ```bash
    cd directus-user-register-extension
    npm install
    npm run build        # produces dist/index.js
    ```

3. Deploy `dist/` to your Directus instance as a loose extension
   (`<directus-root>/extensions/directus-user-register-extension/`) or install the npm
   package, then **restart Directus**. See the extension README's *Troubleshooting* section.

4. Create the `registration_codes` collection and (optionally) seed codes. The extension
   ships helper scripts — copy `.env.example` to `.env` first and fill in
   `DIRECTUS_URL`, `DIRECTUS_EMAIL`, `DIRECTUS_PASSWORD`:

    ```bash
    npm run create-collections   # creates the registration_codes collection
    npm run insert-codes         # optional: seeds TOTAL_CODES sample codes
    ```

## `registration_codes` Collection

Created by `npm run create-collections`. Fields:

- `id` (UUID, primary key)
- `code` (string, unique, required) — the registration code
- `status` (string, `open` | `registered`, default `open`)
- `status_changed_at` (timestamp, nullable) — set when a code is used
- `used_by` (UUID → `directus_users`, nullable) — who redeemed the code

## Roles & Default Role

The extension assigns a default role to every new user. Configure it on the **Directus
server** via the `DIRECTUS_DEFAULT_ROLE` environment variable (a role ID **or** role name).
If unset it falls back to a hard-coded UUID that only exists on the original author's
instance, so **set this explicitly**:

```env
DIRECTUS_DEFAULT_ROLE=activated      # role name, or a UUID
```

Recommended role setup:

#### Public Role (unauthenticated)

- Access to the registration endpoint (handled by the extension)
- Access to `/auth/login`, `/auth/password/request`, `/auth/password/reset` (Directus built-ins)
- No access to any content collections

#### Default / "activated" Role (assigned on registration)

- `directus_users`: Read (own), Update (own)
- `gesangbuchlied`: Read All
- `directus_files`: Read All (for assets)
- Other related collections (authors, categories, etc.): Read All
- No access to `registration_codes`

## CORS

Because the app calls the endpoint from the browser, ensure the Directus instance allows the
app origin (`CORS_ENABLED=true` and `CORS_ORIGIN` including the PWA origin).

## Email (Password Reset)

Password reset uses Directus built-ins. Configure SMTP on the Directus server:

```env
EMAIL_FROM="noreply@yourchurch.org"
EMAIL_TRANSPORT="smtp"
EMAIL_SMTP_HOST="smtp.yourprovider.com"
EMAIL_SMTP_PORT="587"
EMAIL_SMTP_USER="your-smtp-user"
EMAIL_SMTP_PASSWORD="your-smtp-password"
```

## Frontend Configuration

`.env` in the Ionic app:

```env
VITE_BACKEND_URL=https://your-directus-instance.com
VITE_AUTH_TOKEN=your-static-admin-token-for-fallback
# Set to 'true' to show the "Skip (Development Mode)" button on login/register
VITE_SHOW_DEV_SKIP=false
```

## Testing

1. Seed a known code (or read one from the `registration_codes` collection).
2. Open the app → **Register**, enter email, password and the code.
3. Expected: user created with the default role, code flipped to `registered`, user logged
   in automatically and able to access songs.
4. Re-using the same code, or a non-existent code, returns
   "Invalid or already used registration code".

## Security Notes

1. **Use HTTPS** for the Directus instance.
2. **Use unguessable codes.** `insert-codes.js` currently generates *sequential, guessable*
   codes (e.g. `1-mose-abraham-treu-1`). For production, generate random/high-entropy codes.
3. **Rate-limit** the registration endpoint — Directus has no per-route throttling for it,
   so codes can otherwise be brute-forced. Enable Directus rate limiting / a WAF rule.
4. **Set `DIRECTUS_DEFAULT_ROLE`** explicitly so new users never inherit an unexpected role.
5. Enable activity logging to audit registrations, and distribute codes via secure channels.

## Troubleshooting

- **"Registration failed" / network error** — extension not deployed or Directus not
  restarted; verify `GET …/directus-user-register-extension` is mounted and CORS allows the app.
- **"Default role not found"** — set `DIRECTUS_DEFAULT_ROLE` to a valid role ID or name.
- **"Invalid or already used registration code"** — code missing or `status != 'open'`.
- **Can't access songs after registration** — the default role lacks read permissions on
  `gesangbuchlied` / `directus_files`.
</content>
</invoke>
