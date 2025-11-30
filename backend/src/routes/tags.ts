import {HonoEnv} from "../models/globals";
import {Hono} from "hono";
import {and, eq} from "drizzle-orm";
import * as schema from "../db/schema";
import {getDb} from "../db/connect";

const tags = new Hono<HonoEnv>();



tags.get('/', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const tags = await db.query.tags.findMany({
        where: eq(schema.tags.userId, userId)
    });

    return c.json(tags);
});

tags.post('/', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const {label, color} = await c.req.json();
    const newTagId = crypto.randomUUID();
    await db.insert(schema.tags).values({
        id: newTagId,
        userId: userId,
        label: label,
        color: color || '#4f1c4f'
    });

    return c.json({id: newTagId, label}, 201);
});

tags.delete('/:id', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const tagId = c.req.param('id');
    const result = await db.delete(schema.tags)
        .where(and(
            eq(schema.tags.id, tagId),
            eq(schema.tags.userId, userId)
        ))
        .returning();

    if (result.length === 0) {
        return c.json({error: 'Error deleting tag'}, 404);
    }

    return c.json({message: 'Ok'});
});

export default tags;
