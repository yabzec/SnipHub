import type Snippet from "../models/snippet";
import {type Snippet as RawSnippet, Tag} from "../db/schema";

type RawSnippetWithTags = RawSnippet & {
    snippetsToTags?: {
        tag: Pick<Tag, 'id' | 'label' | 'color'>;
    }[];
};

export function flattenTags(snippets: RawSnippetWithTags[]): Snippet[] {
    return snippets.map((snippet) => {
        const flattenedTags = snippet.snippetsToTags?.map(item => item.tag);
        delete snippet.snippetsToTags;

        return {
            ...snippet,
            tags: flattenedTags || []
        }
    })
}
