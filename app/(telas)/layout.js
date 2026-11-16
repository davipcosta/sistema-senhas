import './globals.css';

const FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@700&display=swap';

export const metadata = {
    title: 'Sistema de Senhas - DPE-PA',
    icons: { icon: '/images/dpepa.svg' }
};

// Layout das telas fixas (início, totem, guichê, painel)
export default function TelasLayout({ children }) {
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
