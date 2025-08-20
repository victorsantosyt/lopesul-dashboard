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
    <html lang="pt-br" className="dark" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {/* Se seu ThemeProvider alterna classes na <html>, ele continuará funcionando,
              mas o padrão inicial agora é 'dark'. */}
          <ThemeProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
