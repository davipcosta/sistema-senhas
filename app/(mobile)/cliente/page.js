import { Suspense } from 'react';
import Cliente from './Cliente';

export default function ClientePage() {
    // useSearchParams() exige um limite de Suspense
    return (
        <Suspense>
            <Cliente />
        </Suspense>
    );
}
