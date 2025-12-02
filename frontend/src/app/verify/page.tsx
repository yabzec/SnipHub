'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function VerifyContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        if (!token) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('error');
            return;
        }

        api.get(`/auth/verify?token=${token}`)
            .then(() => {
                setStatus('success');
            })
            .catch((err) => {
                console.error(err);
                setStatus('error');
            });
    }, [token]);

    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle>Email verify</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                {status === 'loading' && (
                    <>
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p>We&#39;re verifying your account...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-lg font-medium">Email verified!</p>
                        <Button onClick={() => router.push('/login')} className="w-full">
                            Go to log in
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <XCircle className="h-12 w-12 text-red-500" />
                        <p className="text-lg font-medium">Invalid or expired token.</p>
                        <Button variant="outline" onClick={() => router.push('/signup')} className="w-full">
                            Sign up
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function VerifyPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-zinc-900">
            <Suspense fallback={<div>Loading...</div>}>
                <VerifyContent />
            </Suspense>
        </div>
    );
}
