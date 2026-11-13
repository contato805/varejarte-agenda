import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import PersistentTabs from './components/layout/PersistentTabs';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Settings from '@/pages/Settings';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const PERSISTENT_PAGES = new Set(["Dashboard", "Agenda", "Reports"]);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasEmployeeSession, setHasEmployeeSession] = useState(false);

  const isLoginPage = location.pathname === "/entrar" || location.pathname === "/login";

  // Redirect /login to /entrar (platform may redirect to /login)
  useEffect(() => {
    if (location.pathname === "/login") {
      navigate("/entrar", { replace: true });
    }
  }, [location.pathname]);

  // Check employee session once auth loading is done
  useEffect(() => {
    if (isLoadingPublicSettings || isLoadingAuth) return;
    if (isAuthenticated) {
      // Platform user — no need for employee session
      setSessionChecked(true);
      setHasEmployeeSession(false);
      return;
    }
    // Not platform-authenticated — check employee session
    const raw = sessionStorage.getItem("employeeSession");
    if (raw) {
      setHasEmployeeSession(true);
      setSessionChecked(true);
    } else {
      setHasEmployeeSession(false);
      setSessionChecked(true);
      // Redirect to login if not on login page
      if (!isLoginPage) {
        navigate("/entrar", { replace: true });
      }
    }
  }, [isLoadingPublicSettings, isLoadingAuth, isAuthenticated, isLoginPage]);

  // Show loading spinner while checking
  if (isLoadingPublicSettings || isLoadingAuth || (!sessionChecked && !isLoginPage)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors — always redirect to custom employee login
  if (authError) {
    if (authError.type === 'user_not_registered') {
      // Treat as non-platform user, redirect to employee login
      if (!isLoginPage) {
        navigate("/entrar", { replace: true });
        return null;
      }
    } else if (authError.type === 'auth_required') {
      if (!isLoginPage) {
        navigate("/entrar", { replace: true });
        return null;
      }
    }
  }

  // Determine current page name from path
  const rawPage = location.pathname === "/" ? mainPageKey : location.pathname.replace(/^\//, "");
  const currentPageName = PERSISTENT_PAGES.has(rawPage) ? rawPage : (rawPage === mainPageKey ? rawPage : rawPage);
  const isPersistentPage = PERSISTENT_PAGES.has(currentPageName);

  // Render the main app
  return (
    <>
      {/* Persistent tabs stay mounted, toggled via display */}
      <PersistentTabs
        currentPageName={currentPageName}
        Pages={Pages}
        LayoutWrapper={LayoutWrapper}
      />

      {/* Non-persistent pages use normal routing */}
      {!isPersistentPage && (
        <Routes>
          {Object.entries(Pages)
            .filter(([path]) => !PERSISTENT_PAGES.has(path))
            .map(([path, Page]) => (
              <Route
                key={path}
                path={path === mainPageKey ? "/" : `/${path}`}
                element={
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                }
              />
            ))}
          <Route path="/Settings" element={<LayoutWrapper currentPageName="Settings"><Settings /></LayoutWrapper>} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      )}
    </>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App