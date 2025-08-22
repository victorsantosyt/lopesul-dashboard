import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import LayoutWrapper from '../components/layoutWrapper';

export const metadata = {
  title: 'Lopesul Dashboard',
  description: 'Painel de gerenciamento de Wi-Fi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className="min-h-screen antialiased
                       bg-[#F0F6FA] text-slate-900
                       dark:bg-[#0f172a] dark:text-slate-100">
          <AuthProvider>
          <ThemeProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
