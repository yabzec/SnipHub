import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Folder, SnippetResponse, Tag } from '@/types';

export function useSnippets(params?: { folderId?: string; page?: number }) {
    return useQuery({
        queryKey: ['snippets', params],
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            if (params?.folderId) searchParams.set('folderId', params.folderId);
            if (params?.page) searchParams.set('page', params.page.toString());

            const { data } = await api.get<SnippetResponse>(`/protected/snippets?${searchParams.toString()}`);
            return data;
        },
    });
}

export function useFolders() {
    return useQuery({
        queryKey: ['folders'],
        queryFn: async () => {
            const { data } = await api.get<Folder[]>('/protected/folders');
            return data;
        },
    });
}

export function useTags() {
    return useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data } = await api.get<Tag[]>('/protected/tags');
            return data;
        },
    });
}
