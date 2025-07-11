import { Inter } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UZH DDIB25 Public Goods Game',
  description: 'UZH DDIB25 Public Goods Game powered by vocdoni',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
