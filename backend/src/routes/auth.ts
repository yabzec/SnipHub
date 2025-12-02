import {eq} from "drizzle-orm";
import * as schema from "../db/schema";
import {compareSync, hashSync} from "bcryptjs";
import {generateRandomUsername} from "../utils/stringUtils";
import {Resend} from "resend";
import {HonoEnv} from "../models/globals";
import {Hono} from "hono";
import {getDb} from "../db/connect";
import {sign} from "hono/jwt";



const auth = new Hono<HonoEnv>();

auth.post('/signup', async (c) => {
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
            username: username || await generateRandomUsername(),
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

auth.get('/verify', async (c) => {
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

auth.post('/login', async (c) => {
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

    return c.json({token, user: {id: user.id, email: user.email, username: user.username, firstName: user.firstName}});
});

export default auth;
