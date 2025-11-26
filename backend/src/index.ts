import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {sign, verify} from 'hono/jwt';
import {drizzle} from 'drizzle-orm/d1';
import {and, desc, eq} from 'drizzle-orm';
import {compareSync, hashSync} from 'bcryptjs';
import * as schema from './db/schema';
import {generateRandomUsername} from "./utils/stringUtils";
import {isArrayNonEmpty} from "./utils/arrayUtils";
import {flattenTags} from "./utils/snippetUtils";

type Bindings = {
    sniphub_dev: D1Database;
    JWT_SECRET: string;
};

type Variables = {
    userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use('/*', cors());


const getDb = (d1: D1Database) => drizzle(d1, {schema});

app.post('/api/auth/signup', async (c) => {
    const db = getDb(c.env.sniphub_dev);
    const {username, firstName, lastName, email, password} = await c.req.json();

    if (!email || !password) return c.json({error: 'Illegal arguments'}, 400);

    const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (existingUser) return c.json({error: 'Email already used'}, 409);

    const hashedPassword = hashSync(password, 8);
    const userId = crypto.randomUUID();

    try {
        await db.insert(schema.users).values({
            id: userId,
            username: username || generateRandomUsername(),
            firstName,
            lastName,
            email,
            password: hashedPassword,
        });
        const token = await sign({id: userId, email}, c.env.JWT_SECRET);

        return c.json({token, user: {id: userId, email, firstName}}, 201);
    } catch (e) {
        console.error(e);
        return c.json({error: 'Error during sign in'}, 500);
    }
});

app.post('/api/auth/login', async (c) => {
    const db = getDb(c.env.sniphub_dev);
    const {email, password} = await c.req.json();
    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (!user) return c.json({error: 'Invalid credentials'}, 401);

    const validPassword = compareSync(password, user.password);

    if (!validPassword) return c.json({error: 'Invalid credentials'}, 401);

    const token = await sign({id: user.id, email: user.email}, c.env.JWT_SECRET);

    return c.json({token, user: {id: user.id, email: user.email, firstName: user.firstName}});
});


app.use('/api/protected/*', async (c, next) => {
    const db = getDb(c.env.sniphub_dev);
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
});

app.get('/api/protected/snippets', async (c) => {
    const db = getDb(c.env.sniphub_dev);
    const userId = c.get('userId');

    // TODO Pagination
    try {
        const userSnippets = await db.query.snippets.findMany({
            where: eq(schema.snippets.userId, userId),
            orderBy: [desc(schema.snippets.createdAt)],
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

        return c.json(flattenTags(userSnippets));
    } catch (e) {
        console.error(e);
        return c.json({error: 'Error reading snippets'}, 500);
    }
});

app.post('/api/protected/snippets', async (c) => {
    const db = getDb(c.env.sniphub_dev);
    const userId = c.get('userId');
    const body = await c.req.json();

    if (!body.title || !body.content) return c.json({error: 'Illegal arguments'}, 400);

    const newSnippetId = crypto.randomUUID();

    try {
        await db.insert(schema.snippets).values({
            id: newSnippetId,
            userId: userId,
            title: body.title,
            content: body.content,
            language: body.language || 'text',
            isFavorite: body.isFavorite || false,
        });

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

app.post('/api/protected/snippets/:id', async (c) => {
    const db = getDb(c.env.sniphub_dev);
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
            })
            .where(eq(schema.snippets.id, snippetId));

        // Body example: { ..., tags: {
        //      add: ["tag-id-1", "tag-id-2"],
        //      remove: ["tag-id-3"]
        // }}
        if (body.tags) {
            if (body.tags.add && isArrayNonEmpty(body.tags.add)) {
                const tagLinks = body.tags.add.map((tagId: string) => ({
                    snippetId,
                    tagId: tagId
                }));
                await db.insert(schema.snippetsToTags).values(tagLinks);
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

app.delete('/api/protected/snippets/:id', async (c) => {
    const db = getDb(c.env.sniphub_dev);
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

app.get('/api/protected/tags', async (c) => {
    const db = getDb(c.env.sniphub_dev);
    const userId = c.get('userId');
    const tags = await db.query.tags.findMany({
        where: eq(schema.tags.userId, userId)
    });

    return c.json(tags);
});

app.post('/api/protected/tags', async (c) => {
    const db = getDb(c.env.sniphub_dev);
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

export default app;
