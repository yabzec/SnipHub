import {integer, primaryKey, sqliteTable, text, unique} from 'drizzle-orm/sqlite-core';
import {relations} from "drizzle-orm";

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
    verificationToken: text('verification_token'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const folders = sqliteTable(
    'folders',
    {
        id: text('id').primaryKey(),
        label: text('label').notNull(),
        color: text('color').default('#4f1c4f'),
        createdAt: integer('created_at', {mode: 'timestamp'}).$defaultFn(() => new Date()),
        userId: text('user_id').notNull().references(() => users.id, {onDelete: "cascade"})
    },
    (t) => ({
        unqFolderLabelPerUser: unique().on(t.userId, t.label)
    })
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;

export const snippets = sqliteTable('snippets', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    language: text('language').default('text'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    userId: text('user_id').notNull().references(() => users.id, {onDelete: "cascade"}),
    folderId: text('folder_id').references(() => folders.id, {onDelete: "set null"}),
});

export type Snippet = typeof snippets.$inferSelect;
export type NewSnippet = typeof snippets.$inferInsert;

export const tags = sqliteTable(
    'tags',
    {
        id: text('id').primaryKey(),
        label: text('label').notNull(),
        color: text('color').default('#4f1c4f'),
        createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
        userId: text('user_id').notNull().references(() => users.id, {onDelete: "cascade"})
    },
    (t) => ({
        unqTagLabelPerUser: unique().on(t.userId, t.label)
    })
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export const snippetsToTags = sqliteTable('snippets_to_tags', {
    snippetId: text('snippet_id').notNull().references(() => snippets.id, {onDelete: "cascade"}),
    tagId: text('tag_id').notNull().references(() => tags.id, {onDelete: "cascade"}),
}, (t) => ({
    pk: primaryKey({columns: [t.snippetId, t.tagId]})
}));


// Relations
export const usersSnippets = relations(users, ({many}) => ({
    snippets: many(snippets),
    tags: many(tags)
}));

export const tagRelations = relations(tags, ({one, many}) => ({
    author: one(users, {
        fields: [tags.userId],
        references: [users.id]
    }),
    snippetsToTags: many(snippetsToTags)
}));

export const folderRelations = relations(folders, ({one, many}) => ({
    author: one(users, {
        fields: [folders.userId],
        references: [users.id]
    })
}));

export const snippetRelations = relations(snippets, ({one, many}) => ({
    author: one(users, {
        fields: [snippets.userId],
        references: [users.id]
    }),
    folder: one(folders, {
        fields: [snippets.folderId],
        references: [folders.id]
    }),
    snippetsToTags: many(snippetsToTags)
}));

export const snippetsToTagsRelations = relations(snippetsToTags, ({ one }) => ({
    snippet: one(snippets, {
        fields: [snippetsToTags.snippetId],
        references: [snippets.id],
    }),
    tag: one(tags, {
        fields: [snippetsToTags.tagId],
        references: [tags.id],
    }),
}));
