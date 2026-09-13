import { Montserrat } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/App.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata = {
  title: 'RaNevra | Stocks Intelligence & Merchant Portal',
  description: 'Real-time NSE Stock Market Intelligence, Intraday Momentum Scanner, and Merchant Portal',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300..900;1,300..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={montserrat.className}>
        {children}
      </body>
    </html>
  );
}
