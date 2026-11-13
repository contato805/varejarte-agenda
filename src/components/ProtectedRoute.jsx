import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute({ fallback = null, unauthenticatedElement = <Navigate to="/entrar" replace /> }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return fallback;
  return isAuthenticated ? <Outlet /> : unauthenticatedElement;
}
