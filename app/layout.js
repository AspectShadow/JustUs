import "./globals.css";

export const metadata = {
  title: "Just Us",
  description: "Our shared to-do list, reminders, and sketch board",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#C97B86",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Just Us" />
      </head>
      <body>{children}</body>
    </html>
  );
}
