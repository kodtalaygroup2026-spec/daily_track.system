// the page is a client component, so its tab title lives here
export const metadata = { title: 'Daily Track · หัวหน้า' };

// the desktop view does not use safe-area insets, so it must not ask for the full-screen notch layout the phone views use
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'auto', themeColor: '#EDF0EE' };

export default function Layout({ children }) {
  return children;
}
