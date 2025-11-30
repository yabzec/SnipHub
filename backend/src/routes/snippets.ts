import { Hono } from "hono";
import {HonoEnv} from "../models/globals";
import {and, count, desc, eq} from "drizzle-orm";
import * as schema from "../db/schema";
import {flattenTags} from "../utils/snippetUtils";
import {Snippet} from "../db/schema";
import {isArrayNonEmpty} from "../utils/arrayUtils";
import {getDb} from "../db/connect";

const snippets = new Hono<HonoEnv>();

snippets.get('/:folderId?', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const folderId = c.req.param('folderId');
    const pageParam = c.req.query('page');
    const pageSize = 25;
    const page = pageParam && !isNaN(parseInt(pageParam, 10))
        ? Math.max(1, parseInt(pageParam, 10))
        : 1;
    const filters = [eq(schema.snippets.userId, userId)];

    if (folderId) {
        filters.push(eq(schema.snippets.folderId, folderId));
    }

    const whereConditions = and(...filters);

    try {
        const [res] = await db
            .select({count: count()})
            .from(schema.snippets)
            .where(whereConditions);

        const totalItems = res.count;
        const totalPages = Math.ceil(totalItems / pageSize);


        const userSnippets = await db.query.snippets.findMany({
            where: whereConditions,
            orderBy: [desc(schema.snippets.createdAt)],
            limit: pageSize,
            offset: (page - 1) * pageSize,
            with: {
                snippetsToTags: {
                    columns: {
                        snippetId: false,
                        tagId: false
                    },
                    with: {
                        tag: {
                            columns: {
                                id: true,
                                label: true,
                                color: true
                            }
                        }
                    }
                }
            }
        });

        return c.json({
            data: flattenTags(userSnippets),
            meta: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                pageSize: pageSize
            }
        });
    } catch (e) {
        console.error(e);
        return c.json({error: 'Error reading snippets'}, 500);
    }
});

snippets.post('/', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const folderId = c.req.query('folderId');
    const body = await c.req.json();

    if (!body.title || !body.content) return c.json({error: 'Illegal arguments'}, 400);

    const newSnippetId = crypto.randomUUID();

    const snippet: Snippet = {
        id: newSnippetId,
        userId: userId,
        title: body.title,
        content: body.content,
        language: body.language || 'text',
        isFavorite: body.isFavorite || false,
        createdAt: null,
        folderId: null
    };

    if (folderId) {
        snippet.folderId = folderId;
    }

    try {
        await db.insert(schema.snippets).values(snippet);

        // Body example: { ..., tags: ["tag-id-1", "tag-id-2"] }
        if (body.tags && Array.isArray(body.tags) && body.tags.length > 0) {
            const tagLinks = body.tags.map((tagId: string) => ({
                snippetId: newSnippetId,
                tagId: tagId
            }));
            await db.insert(schema.snippetsToTags).values(tagLinks);
        }

        return c.json({id: newSnippetId}, 201);
    } catch (e) {
        console.log(e);
        return c.json({error: 'Error saving snippet'}, 500);
    }
});

snippets.post('/:id', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const snippetId = c.req.param('id');
    const body = await c.req.json();

    try {
        const snippet = await db.query.snippets.findFirst({
            where: and(
                eq(schema.snippets.userId, userId),
                eq(schema.snippets.id, snippetId)
            ),
            with: {
                snippetsToTags: {
                    with: {
                        tag: true
                    }
                }
            }
        });

        if (!snippet) return c.json({error: 'Snippet not found'}, 404);

        await db.update(schema.snippets)
            .set({
                title: body.title || snippet.title,
                content: body.content || snippet.content,
                language: body.language || snippet.language,
                isFavorite: body.isFavorite || snippet.isFavorite,
                folderId: body.folderId || snippet.folderId
            })
            .where(eq(schema.snippets.id, snippetId));

        // Body example: { ..., tags: {
        //      add: ["tag-id-1", "tag-id-2"],
        //      remove: ["tag-id-3"]
        // }}
        if (body.tags) {
            if (body.tags.add && isArrayNonEmpty(body.tags.add)) {
                const result = await db
                    .select({tagId: schema.snippetsToTags.tagId})
                    .from(schema.snippetsToTags)
                    .where(eq(schema.snippetsToTags.snippetId, snippetId));
                const tagIds = result.map(row => row.tagId);
                const tagLinks = body.tags.add
                    .filter((tagId: string) => !tagIds.includes(tagId))
                    .map((tagId: string) => ({
                        snippetId,
                        tagId: tagId
                    }));

                if (tagLinks.length > 0) {
                    await db.insert(schema.snippetsToTags).values(tagLinks);
                }
            }
            if (body.tags.remove && isArrayNonEmpty(body.tags.add)) {
                const tagLinks = body.tags.add.map((tagId: string) => ({
                    snippetId,
                    tagId: tagId
                }));
                await db.delete(schema.snippetsToTags).values(tagLinks);
            }
        }

        return c.json({id: snippetId}, 201);
    } catch (e) {
        console.log(e);
        return c.json({error: 'Error saving snippet'}, 500);
    }
});

snippets.delete('/:id', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const snippetId = c.req.param('id');
    const result = await db.delete(schema.snippets)
        .where(and(
            eq(schema.snippets.id, snippetId),
            eq(schema.snippets.userId, userId)
        ))
        .returning();

    if (result.length === 0) {
        return c.json({error: 'Error deleting snippet'}, 404);
    }

    return c.json({message: 'Ok'});
});

export default snippets;
