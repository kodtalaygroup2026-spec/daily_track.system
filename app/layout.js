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
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
