'use client';

import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Code } from 'lucide-react';
import {useSnippets} from "@/hooks/useQueries";

export default function HomePage() {
    const searchParams = useSearchParams();
    const folderId = searchParams.get('folderId') || undefined;
    const { data, isLoading, isError } = useSnippets({ folderId });

    return (
        <>
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search snippets..."
                            className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[300px]"
                        />
                    </div>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Snippet
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 flex-col rounded-lg border border-dashed shadow-sm p-4">

                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[150px] w-full rounded-xl" />)}
                    </div>
                )}

                {isError && (
                    <div className="flex flex-1 items-center justify-center">
                        <p className="text-red-500">Error loading snippet.</p>
                    </div>
                )}

                {!isLoading && data?.data.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                        <Code className="h-10 w-10 text-muted-foreground" />
                        <h3 className="text-2xl font-bold tracking-tight">No snippets found</h3>
                        <p className="text-sm text-muted-foreground">
                            You haven&#39;t created any snippets in this folder yet.
                        </p>
                        <Button className="mt-4">Create your first snippet</Button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data?.data.map((snippet) => (
                        <Card key={snippet.id} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg truncate pr-2">{snippet.title}</CardTitle>
                                    <Badge variant="outline">{snippet.language}</Badge>
                                </div>
                                <CardDescription>Last updated: {new Date(snippet.createdAt).toLocaleDateString()}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted/50 p-2 rounded-md">
                                    {snippet.content}
                                </p>
                                <div className="flex gap-1 mt-3 flex-wrap">
                                    {snippet.tags.map(tag => (
                                        <Badge key={tag.id} variant="secondary" style={{ color: tag.color }} className="text-xs">
                                            #{tag.label}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

            </div>
        </>
    );
}
