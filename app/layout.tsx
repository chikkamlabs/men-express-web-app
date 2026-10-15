import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'men-express-web-app',
  description: 'Men Express Web App - Core Next.js project setup',
  openGraph: {
    title: 'men-express-web-app',
    description: 'Men Express Web App - Core Next.js project setup',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'men-express-web-app',
    description: 'Men Express Web App - Core Next.js project setup',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
