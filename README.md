# SnipHub

This is a code snippets collector which can be hosted on cloudflare.

### Setup
1. Install deps `npm i`
2. Create the db and add it to your `wrangler.jsonc`
```bash
cd backend
npx wrangler login
npx wrangler d1 create sniphub-dev
npx drizzle-kit generate
# Local DB
npx wrangler d1 execute [db-name] --local --file=./drizzle/0000_*.sql
# Remote
npx wrangler d1 execute [db-name] --remote --file=./drizzle/0000_*.sql

```
```json
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "backend",
	"main": "src/index.ts",
	"compatibility_date": "2025-11-26",
    "vars": {
        "FRONTEND_BASE_URL": "[your-prod-frontend-url]",
        "NO_REPLY_EMAIL": "no-reply@[your-prod-domain]"
    },
	"d1_databases": [
		{
			"binding": "sniphub", // This is important
			"database_name": "[db-name]",
			"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            // If you want to use the remote db for dev
            // "remote": true
		}
	]
}
```
3. Create a `backend/.dev.vars`
```
JWT_SECRET=[your secret]
RESEND_API_KEY=[your resend api key]
FRONTEND_BASE_URL=http://localhost:3000
NO_REPLY_EMAIL=onboarding@resend.dev
ADMIN_EMAIL=[your-email]
```
Resend is an email service with a free tier of 3000 mails/month, to get a key go to [resend.com](https://resend.com/).

This needs to be added to cloudflare after the worker creation
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
```
