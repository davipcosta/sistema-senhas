import './globals.css';

const FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

export const metadata = {
    title: 'Acompanhamento de Senha - DPE-PA',
    icons: { icon: '/images/dpepa.svg' }
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
};

// Layout separado (outro root layout) para o celular: tem o próprio globals.css,
// sem misturar com o das telas fixas.
export default function MobileLayout({ children }) {
    return (
        <html lang="pt-BR">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link rel="stylesheet" href={FONTS} />
            </head>
            <body>{children}</body>
        </html>
    );
}
