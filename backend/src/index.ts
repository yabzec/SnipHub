import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {cleanUpInactiveUsers} from './cron/cleanUpInactiveUsers';
import authRoutes from './routes/auth';
import snippetsRoutes from './routes/snippets';
import tagsRoutes from './routes/tags';
import foldersRoutes from './routes/folders';
import {HonoEnv} from "./models/globals";
import {authMiddleware} from "./middleware/auth";

const app = new Hono<HonoEnv>();
app.use('/*', cors());
app.use('/api/protected/*', authMiddleware);
app.route('/api/auth', authRoutes);
app.route('/api/protected/snippets', snippetsRoutes);
app.route('/api/protected/tags', tagsRoutes);
app.route('/api/protected/folders', foldersRoutes);

export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: HonoEnv['Bindings'], ctx: ExecutionContext) {
        ctx.waitUntil(cleanUpInactiveUsers(env));
    },
};
