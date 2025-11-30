import { drizzle } from 'drizzle-orm/d1';
import {lt, isNull, and, eq} from 'drizzle-orm';
import { Resend } from 'resend';
import * as schema from '../db/schema';

type Env = {
    sniphub: D1Database;
    NO_REPLY_EMAIL: string;
    ADMIN_EMAIL: string;
    RESEND_API_KEY: string;
};

export const cleanUpInactiveUsers = async (env: Env) => {
    const db = drizzle(env.sniphub, { schema });
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const deletedUsers = await db.delete(schema.users)
            .where(and(
                isNull(schema.users.emailVerifiedAt),
                lt(schema.users.createdAt, twentyFourHoursAgo)
            ))
            .returning({ id: schema.users.id, email: schema.users.email });

        if (deletedUsers.length > 0) {
            console.log(`Cron Job: Deleted ${deletedUsers.length} inactive users.`);
        }
    } catch (e) {
        console.error("Cron Job Failed:", e);
        const resend = new Resend(env.RESEND_API_KEY);
        const resendResponse = await resend.emails.send({
            from: `SnipHub <${env.NO_REPLY_EMAIL}>`,
            to: env.ADMIN_EMAIL,
            subject: 'SnipHub Error',
            html: `<h2>Cron job failed</h2><p>${e}</p>`
        });

        if (resendResponse.error) {
            console.error("Resend failed:", resendResponse.error);
        }
    }
};
