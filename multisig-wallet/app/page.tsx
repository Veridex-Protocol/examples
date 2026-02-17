'use client';

import { useMultisig } from '@/lib/MultisigContext';
import { AuthScreen } from '@/components/AuthScreen';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
    const { isConnected, isLoading } = useMultisig();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Initializing Veridex SDK...</p>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return <AuthScreen />;
    }

    return <Dashboard />;
}
