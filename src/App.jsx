import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './pages.config';
import { BrowserRouter, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import PersistentTabs from './components/layout/PersistentTabs';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import EmployeeLogin from '@/pages/EmployeeLogin';
import Settings from '@/pages/Settings';

const { Pages, Layout, mainPage } = pagesConfig;
const PERSISTENT_PAGES = new Set(['Dashboard', 'Agenda', 'Reports']);
const LayoutWrapper = ({ children, currentPageName }) => <Layout currentPageName={currentPageName}>{children}</Layout>;

export function AuthenticatedApp() {
  const { user, authChecked, isLoadingAuth, configurationError } = useAuth();
  const location = useLocation();
  if (configurationError) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <img src="/brand/varejarte.png" alt="Varejarte" className="h-24 mx-auto object-contain" />
        <h1 className="text-xl font-semibold">Ambiente em preparação</h1>
        <p className="text-muted-foreground">A conexão exclusiva do Varejarte Agenda ainda está sendo configurada.</p>
      </div>
    </div>
  );
  if (!authChecked || (isLoadingAuth && user)) return <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Conferindo acesso">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>;
  const isLogin = ['/entrar', '/login'].includes(location.pathname);
  if (!user) return isLogin ? <EmployeeLogin /> : <Navigate to="/entrar" replace />;
  if (isLogin) return <Navigate to="/" replace />;
  const currentPageName = location.pathname === '/' ? mainPage : location.pathname.slice(1);
  const isAdmin = user.access_type === 'admin';
  if (!isAdmin && currentPageName !== 'Agenda') return <Navigate to="/" replace />;
  const allowedPages = isAdmin ? Pages : { Agenda: Pages.Agenda };
  return <>
    <PersistentTabs currentPageName={currentPageName} Pages={allowedPages} LayoutWrapper={LayoutWrapper} />
    {!PERSISTENT_PAGES.has(currentPageName) && <Routes>
      {Object.entries(allowedPages).filter(([path]) => path !== 'entrar' && !PERSISTENT_PAGES.has(path)).map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={<LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>} />
      ))}
      {isAdmin && <Route path="/Settings" element={<LayoutWrapper currentPageName="Settings"><Settings /></LayoutWrapper>} />}
      <Route path="*" element={<PageNotFound />} />
    </Routes>}
  </>;
}

export default function App() {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClientInstance}><AuthProvider>
      <BrowserRouter><AuthenticatedApp /></BrowserRouter><Toaster />
    </AuthProvider></QueryClientProvider>
  </ThemeProvider>;
}
