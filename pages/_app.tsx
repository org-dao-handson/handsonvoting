import type { AppProps } from 'next/app';
import '../src/app/globals.css';
import { WalletProvider } from '@/context/WalletContext';
import Layout from '@/components/layout/Layout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </WalletProvider>
  );
}
