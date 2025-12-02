const fs = require('fs');
const path = require('path');

const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
const wranglerConfigObject = {
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "sniphub_backend",
    "main": "src/index.ts",
    "compatibility_date": "2025-11-26",
    "vars": {
        "FRONTEND_BASE_URL": process.env.FRONTEND_BASE_URL,
        "NO_REPLY_EMAIL": process.env.NO_REPLY_EMAIL,
        "ADMIN_EMAIL": process.env.ADMIN_EMAIL,
    },
    "triggers": {
        "crons": [
            "0 0 * * *"
        ]
    },
    "d1_databases": [
        {
            "binding": process.env.DATABASE_NAME,
            "database_name": process.env.DATABASE_NAME,
            "database_id": process.env.DATABASE_ID,
            "remote": true
        }
    ]
};

fs.writeFileSync(wranglerPath, JSON.stringify(wranglerConfigObject));
