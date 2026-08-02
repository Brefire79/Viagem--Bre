import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TripProvider } from './contexts/TripContext';
import Layout from './components/Layout';
import TripGate from './components/TripGate';
import UpdateNotification from './components/UpdateNotification';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const RoteiroPage = lazy(() => import('./pages/RoteiroPage'));
const FinanceiroPage = lazy(() => import('./pages/FinanceiroPage'));
const HistoriaPage = lazy(() => import('./pages/HistoriaPage'));
const CambioPage = lazy(() => import('./pages/CambioPage'));
const GerenciarViagemPage = lazy(() => import('./pages/GerenciarViagemPage'));

const PageFallback = () => (
  <div className="flex h-screen items-center justify-center text-slate-600">
    Carregando...
  </div>
);

// Componente de rota protegida
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Componente de rota pública (redireciona se já autenticado)
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (user) {
    return <Navigate to="/roteiro" replace />;
  }
  
  return children;
};

// O TripProvider fica acima das rotas (ver App), não aqui: o <Routes> usa
// key={pathname}, então tudo que estiver dentro dele é desmontado e remontado a
// cada troca de aba - o que zerava a viagem e reassinava o Firestore sem parar.
const ProtectedShell = () => (
  <ProtectedRoute>
    <Layout>
      <TripGate>
        <Outlet />
      </TripGate>
    </Layout>
  </ProtectedRoute>
);

function AppRoutes() {
  const location = useLocation();
  
  return (
    <Suspense fallback={<PageFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Rota de login */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            } 
          />

          {/* Rotas protegidas com shell compartilhado */}
          <Route element={<ProtectedShell />}>
            <Route index element={<Navigate to="/roteiro" replace />} />
            <Route path="/roteiro" element={<RoteiroPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/historia" element={<HistoriaPage />} />
            <Route path="/cambio" element={<CambioPage />} />
            <Route path="/gerenciar" element={<GerenciarViagemPage />} />
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AuthProvider>
        <TripProvider>
          <AppRoutes />
          <UpdateNotification />
        </TripProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
