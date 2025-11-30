export type Bindings = {
    sniphub: D1Database;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    FRONTEND_BASE_URL: string;
    NO_REPLY_EMAIL: string;
    ADMIN_EMAIL: string;
};

export type Variables = {
    userId: string;
};

export type HonoEnv = {
    Bindings: Bindings;
    Variables: Variables;
};
