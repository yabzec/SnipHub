import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {sign, verify} from 'hono/jwt';
import {drizzle} from 'drizzle-orm/d1';
import {and, count, desc, eq} from 'drizzle-orm';
import {compareSync, hashSync} from 'bcryptjs';
import * as schema from './db/schema';
import {generateRandomUsername} from "./utils/stringUtils";
import {isArrayNonEmpty} from "./utils/arrayUtils";
import {flattenTags} from "./utils/snippetUtils";
import { cleanUpInactiveUsers } from './cron/cleanUpInactiveUsers';
import {Snippet} from "./db/schema";
import { Resend } from 'resend';


type Bindings = {
    sniphub: D1Database;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    FRONTEND_BASE_URL: string;
    NO_REPLY_EMAIL: string;
    ADMIN_EMAIL: string;
};

type Variables = {
    userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use('/*', cors());


const getDb = (d1: D1Database) => drizzle(d1, {schema});

app.post('/api/auth/signup', async (c) => {
    const db = getDb(c.env.sniphub);
    const {username, firstName, lastName, email, password} = await c.req.json();

    if (!email || !password) return c.json({error: 'Illegal arguments'}, 400);

    const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (existingUser) return c.json({error: 'Email already used'}, 409);

    const hashedPassword = hashSync(password, 8);
    const userId = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();

    try {
        await db.insert(schema.users).values({
            id: userId,
            username: username || generateRandomUsername(),
            firstName,
            lastName,
            email,
            password: hashedPassword,
            verificationToken: verificationToken,
            emailVerifiedAt: null
        });

        const verifyUrl = `${c.env.FRONTEND_BASE_URL}/verify?token=${verificationToken}`;
        const resend = new Resend(c.env.RESEND_API_KEY);
        const resendResponse = await resend.emails.send({
            from: `SnipHub <${c.env.NO_REPLY_EMAIL}>`,
            to: email,
            subject: 'Verify your email',
            html: `<p>Hi ${firstName}, click here to activate your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
        });

        if (resendResponse.error) {
            await db.delete(schema.users).where(eq(schema.users.id, userId));
            throw new Error(`Resend Error: ${resendResponse.error}`);

        }

        return c.json({message: 'OK'}, 201);
    } catch (e) {
        console.error(e);
        return c.json({error: 'Error during sign in'}, 500);
    }
});

app.get('/api/auth/verify', async (c) => {
    const db = getDb(c.env.sniphub);
    const token = c.req.query('token');

    if (!token) return c.json({ error: 'Missing token' }, 400);

    const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.verificationToken, token)
    });

    if (!user) {
        return c.json({ error: 'Invalid token' }, 400);
    }

    await db.update(schema.users)
        .set({
            emailVerifiedAt: new Date(),
            verificationToken: null
        })
        .where(eq(schema.users.id, user.id));

    return c.json({ message: 'OK' });
});

app.post('/api/auth/login', async (c) => {
    const db = getDb(c.env.sniphub);
    const {email, password} = await c.req.json();
    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (!user) return c.json({error: 'Invalid credentials'}, 401);

    if (!user.emailVerifiedAt) {
        return c.json({ error: 'You need to verify your account!' }, 403);
    }

    const validPassword = compareSync(password, user.password);

    if (!validPassword) return c.json({error: 'Invalid credentials'}, 401);

    const token = await sign({id: user.id, email: user.email}, c.env.JWT_SECRET);

    return c.json({token, user: {id: user.id, email: user.email, firstName: user.firstName}});
});


app.use('/api/protected/*', async (c, next) => {
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
});

app.get('/api/protected/snippets/:folderId?', async (c) => {
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

app.post('/api/protected/snippets/', async (c) => {
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

app.post('/api/protected/snippets/:id', async (c) => {
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

app.delete('/api/protected/snippets/:id', async (c) => {
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

app.get('/api/protected/tags', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const tags = await db.query.tags.findMany({
        where: eq(schema.tags.userId, userId)
    });

    return c.json(tags);
});

app.post('/api/protected/tags', async (c) => {
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

app.delete('/api/protected/tags/:id', async (c) => {
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

app.get('/api/protected/folders', async (c) => {
    const db = getDb(c.env.sniphub);
    const userId = c.get('userId');
    const folders = await db.query.folders.findMany({
        where: eq(schema.tags.userId, userId)
    });

    return c.json(folders);
});

app.post('/api/protected/folders', async (c) => {
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

app.delete('/api/protected/folders/:id', async (c) => {
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

export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        ctx.waitUntil(cleanUpInactiveUsers(env));
    },
};
