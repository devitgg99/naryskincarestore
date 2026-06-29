import '../index.css';

export const metadata = {
  title: 'Nary Skincare Wholesale Portal',
  description: 'Manage skincare wholesale pricing, suppliers, invoices, and customer transactions.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-dark-950 text-dark-100 selection:bg-primary-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
