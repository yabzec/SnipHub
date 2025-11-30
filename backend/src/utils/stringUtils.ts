const adjectives = [
    'Happy', 'Lucky', 'Sunny', 'Clever', 'Brave', 'Calm', 'Witty', 'Jolly',
    'Fancy', 'Swift', 'Gentle', 'Eager', 'Proud', 'Kind', 'Lively', 'Silly'
];

const animals = [
    'Panda', 'Fox', 'Koala', 'Eagle', 'Bear', 'Otter', 'Tiger', 'Lion',
    'Wolf', 'Rabbit', 'Penguin', 'Badger', 'Falcon', 'Hawk', 'Owl', 'Shark'
];

function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getUserName(str1: string, str2: string): string {
    const num = getRandomInt(10, 999);
    return `${str1}${str2}_${num}`;
}

function generateLocalUsername(): string {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return getUserName(adj, animal);
};


export async function generateRandomUsername(): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 800)
    );

    const apiPromise = (async () => {
        const [adjRes, animalRes] = await Promise.all([
            fetch('https://random-word-form.herokuapp.com/random/adjective'),
            fetch('https://random-word-form.herokuapp.com/random/animal')
        ]);

        if (!adjRes.ok || !animalRes.ok) throw new Error('API Error');

        const [adj] = await adjRes.json() as string[];
        const [animal] = await animalRes.json() as string[];

        return getUserName(adj, capitalize(animal));
    })();

    try {
        const username = await Promise.race([apiPromise, timeoutPromise]);
        return username;
    } catch (e) {
        return generateLocalUsername();
    }
};
