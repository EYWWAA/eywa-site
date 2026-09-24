import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/fraunces/wght.css';
import './globals.css';
export const metadata: Metadata = { title: 'Votre marque, votre coffee bar — EYWA', description:'Visualisez votre coffee bar EYWA aux couleurs de votre marque.', robots:{index:false,follow:false} };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="fr"><body>{children}</body></html> }
