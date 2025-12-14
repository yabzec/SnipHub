'use client';

import {Folder, Tag} from "@/types";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Code2, FolderOpen, Hash, LogOut, Plus, Star} from "lucide-react";
import {usePathname, useSearchParams} from "next/navigation";
import {useAuthStore} from "@/store/useAuthStore";
import {useFolders, useTags} from "@/hooks/useQueries";
import {cn} from "@/lib/utils";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Skeleton} from "@/components/ui/skeleton";

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentFolderId = searchParams.get('folderId');

    const { user, logout } = useAuthStore();
    const { data: folders, isLoading: foldersLoading } = useFolders();
    const { data: tags, isLoading: tagsLoading } = useTags();

    return (
        <div className={cn("relative pb-12 min-h-screen border-r bg-gray-50/40 dark:bg-zinc-900/40", className)}>
            <div className="space-y-4 py-4">

                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        SnipHub
                    </h2>
                    <div className="space-y-1">
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                            Hi, <span className="font-medium text-foreground">{user?.username}</span>
                        </div>
                    </div>
                </div>

                <div className="px-3 py-2">
                    <div className="space-y-1">
                        <Link href="/">
                            <Button variant={!currentFolderId && pathname === '/' ? "secondary" : "ghost"} className="w-full justify-start">
                                <Code2 className="mr-2 h-4 w-4" />
                                All Snippets
                            </Button>
                        </Link>
                        <Link href="/?favorites=true">
                            <Button variant="ghost" className="w-full justify-start">
                                <Star className="mr-2 h-4 w-4 text-yellow-500" />
                                Favorites
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="py-2">
                    <h2 className="relative px-7 text-lg font-semibold tracking-tight">
                        Folders
                        <Button variant="ghost" size="icon" className="absolute right-3 top-0 h-6 w-6">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </h2>
                    <ScrollArea className="h-[200px] px-1">
                        <div className="space-y-1 p-2">
                            {foldersLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : folders?.map((folder: Folder) => (
                                <Link key={folder.id} href={`/?folderId=${folder.id}`}>
                                    <Button
                                        variant={currentFolderId === folder.id ? "secondary" : "ghost"}
                                        className="w-full justify-start font-normal"
                                    >
                                        <FolderOpen className="mr-2 h-4 w-4 text-blue-500" />
                                        {folder.label}
                                    </Button>
                                </Link>
                            ))}
                            {!foldersLoading && folders?.length === 0 && (
                                <p className="px-4 text-xs text-muted-foreground">No folders yet</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <div className="py-2">
                    <h2 className="relative px-7 text-lg font-semibold tracking-tight">
                        Tags
                        <Button variant="ghost" size="icon" className="absolute right-3 top-0 h-6 w-6">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </h2>
                    <ScrollArea className="h-[200px] px-1">
                        <div className="space-y-1 p-2">
                            {tagsLoading ? (
                                <Skeleton className="h-8 w-full" />
                            ) : tags?.map((tag: Tag) => (
                                <Button key={tag.id} variant="ghost" className="w-full justify-start font-normal">
                                    <Hash className="mr-2 h-4 w-4" style={{ color: tag.color }} />
                                    {tag.label}
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

            </div>

            <div className="absolute bottom-4 left-0 w-full px-4">
                <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    );
}
