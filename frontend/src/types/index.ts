export interface Tag {
    id: string;
    label: string;
    color: string;
}

export interface Folder {
    id: string;
    label: string;
    color: string;
}

export interface Snippet {
    id: string;
    title: string;
    content: string;
    language: string;
    isFavorite: boolean;
    createdAt: string;
    folderId: string | null;
    tags: Tag[];
}

export interface SnippetResponse {
    data: Snippet[];
    meta: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        pageSize: number;
    };
}
