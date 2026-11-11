import { preload } from 'react-dom';
import './globals.css';

export const metadata = {
  title: 'Daily Track',
  description: 'ระบบรายงานงานรายวันสำหรับช่างและหัวหน้า',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EDF0EE',
};

export default function RootLayout({ children }) {
  // the heading face is fetched with the page instead of when the first Thai title is painted
  preload('/fonts/kanit-700-thai.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
