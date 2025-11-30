import { Hono } from "hono";
import {HonoEnv} from "../models/globals";
import {and, eq} from "drizzle-orm";
import * as schema from "../db/schema";
import {getDb} from "../db/connect";

const folders = new Hono<HonoEnv>();

folders.get('/', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const folders = await db.query.folders.findMany({
        where: eq(schema.tags.userId, userId)
    });

    return c.json(folders);
});

folders.post('/', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const {label, color} = await c.req.json();
    const newTagId = crypto.randomUUID();
    await db.insert(schema.folders).values({
        id: newTagId,
        userId: userId,
        label: label,
        color: color || '#4f1c4f'
    });

    return c.json({id: newTagId, label}, 201);
});

folders.delete('/:id', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const folderId = c.req.param('id');
    const result = await db.delete(schema.folders)
        .where(and(
            eq(schema.folders.id, folderId),
            eq(schema.folders.userId, userId)
        ))
        .returning();

    if (result.length === 0) {
        return c.json({error: 'Error deleting folder'}, 404);
    }

    return c.json({message: 'Ok'});
});

export default folders;
