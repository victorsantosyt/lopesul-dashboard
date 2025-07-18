import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import LayoutWrapper from '../components/layoutWrapper';

export const metadata = {
  title: 'Lopesul Dashboard',
  description: 'Painel de gerenciamento de Wi-Fi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
