export default interface Snippet {
    id: string
    createdAt: Date | null
    title: string
    content: string
    language: string | null
    isFavorite: boolean | null
    userId: string
    tags: {
        id: string
        label: string
        color: string | null
    }[]
}
