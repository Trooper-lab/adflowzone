import type {Metadata} from 'next';
import {Toaster} from '@/components/ui/toaster';
import './globals.css';
import {FirebaseClientProvider} from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'GO - Global Overview',
  description: 'Global Overview dashboard for Only Forward.',
  icons: {
    icon: '/go-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@500&family=Squada+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
          <FirebaseClientProvider>{children}</FirebaseClientProvider>
          <Toaster />
      </body>
    </html>
  );
}
