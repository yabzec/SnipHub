import {Context, Next} from "hono";
import {HonoEnv} from "../models/globals";
import {getDb} from "../db/connect";
import {verify} from "hono/jwt";
import * as schema from '../db/schema';
import {eq} from "drizzle-orm";

export const authMiddleware = async (c: Context<HonoEnv>, next: Next) => {
    const db = getDb(c.env.sniphub);
    const authHeader = c.req.header('Authorization');

    if (!authHeader) return c.json({error: 'Missing token'}, 401);

    const token = authHeader.replace('Bearer ', '');

    try {
        const payload = await verify(token, c.env.JWT_SECRET);
        const userId = payload.id as string;
        // Might use Claudflare KV for key<>value cache of active users
        const user = await db.query.users.findFirst({
            where: eq(schema.users.id, userId)
        });

        if (!user)  return c.json({error: 'Unauthorized'}, 401);

        c.set('userId', userId);
        await next();
    } catch (e) {
        console.error(e);
        return c.json({error: 'Invalid token'}, 401);
    }
}
