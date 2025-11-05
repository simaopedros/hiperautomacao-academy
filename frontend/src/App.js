import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import '@/App.css';
import '@/i18n'; // Inicializar i18n
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AdminDashboard from '@/pages/AdminDashboard';
import StudentDashboard from '@/pages/StudentDashboard';
import CourseView from '@/pages/CourseView';
import LessonPlayer from '@/pages/LessonPlayer';
import SocialFeed from '@/pages/SocialFeed';
import CreatePassword from '@/pages/CreatePassword';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PaymentSuccess from '@/pages/PaymentSuccess';
import PaymentCancelled from '@/pages/PaymentCancelled';
import SubscriptionSuccess from '@/pages/SubscriptionSuccess';
import AdminFinance from '@/pages/AdminFinance';
import PaymentSettings from '@/pages/PaymentSettings';
import ProfileSettings from '@/pages/ProfileSettings';

import GamificationSettings from '@/pages/GamificationSettings';
import GatewaySettings from '@/pages/GatewaySettings';
import SupportSettings from '@/pages/SupportSettings';
import SubscriptionPlansAdmin from '@/pages/SubscriptionPlansAdmin';
import SubscribePage from '@/pages/SubscribePage';
import AdminCategories from '@/pages/AdminCategories';
import LanguageSelectionModal from '@/components/LanguageSelectionModal';
import WebhookMonitor from '@/pages/WebhookMonitor';
import VersionBadge from '@/components/VersionBadge';
import AnalyticsTracker from '@/components/AnalyticsTracker';

function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    return token && userData ? JSON.parse(userData) : null;
  });
  const [loading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [dismissTrigger, setDismissTrigger] = useState(0);

  // Verificar se usuário precisa selecionar idioma (apenas para estudantes)
  const needsLanguageSelection = user && !user.preferred_language && user.role !== 'admin';

  // Computar estado de aviso fechado por usuário usando useMemo
  const languageNoticeDismissed = useMemo(() => {
    if (!user || !needsLanguageSelection) {
      return true;
    }
    const key = `languageNoticeDismissed_${user.id}`;
    return localStorage.getItem(key) === 'true';
  }, [user?.id, needsLanguageSelection, dismissTrigger]);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowLanguageModal(false);
  };

  const handleLanguageSelect = (language) => {
    // Atualizar estado do usuário
    const updatedUser = { ...user, preferred_language: language };
    setUser(updatedUser);
    
    // Atualizar localStorage também
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    setShowLanguageModal(false);
    console.log('Modal fechado, idioma selecionado:', language);
  };

  const dismissLanguageNotice = () => {
    if (user) {
      const key = `languageNoticeDismissed_${user.id}`;
      localStorage.setItem(key, 'true');
      // Trigger re-computation of languageNoticeDismissed
      setDismissTrigger(prev => prev + 1);
    }
  };

  const updateUser = (updatedUserData) => {
    // Atualizar estado do usuário
    const newUser = { ...user, ...updatedUserData };
    setUser(newUser);
    
    // Atualizar localStorage também
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-emerald-400 text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AnalyticsTracker />
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                user.role === 'admin' ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/register"
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <RegisterPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/create-password"
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <CreatePassword onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/reset-password"
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <ResetPasswordPage />
              )
            }
          />
          <Route
            path="/admin/*"
            element={
              user && user.role === 'admin' ? (
                <AdminDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              user ? (
                <StudentDashboard user={user} onLogout={handleLogout} updateUser={updateUser} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/course/:courseId"
            element={
              user ? (
                <CourseView user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              user ? (
                <LessonPlayer user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/social"
            element={
              user ? (
                <SocialFeed user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              user ? (
                <ProfileSettings user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/subscription-success"
            element={
              user ? (
                <SubscriptionSuccess user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/payment-success"
            element={
              user ? (
                <PaymentSuccess user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/payment-cancelled"
            element={
              user ? (
                <PaymentCancelled user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/finance"
            element={
              user && user.role === 'admin' ? (
                <AdminFinance user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/payment-settings"
            element={
              user && user.role === 'admin' ? (
                <PaymentSettings user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          
          <Route
            path="/admin/gamification"
            element={
              user && user.role === 'admin' ? (
                <GamificationSettings user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/support"
            element={
              user && user.role === 'admin' ? (
                <SupportSettings user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/gateway"
            element={
              user && user.role === 'admin' ? (
                <GatewaySettings user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/categories"
            element={
              user && user.role === 'admin' ? (
                <AdminCategories user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/subscription-plans"
            element={
              user && user.role === 'admin' ? (
                <SubscriptionPlansAdmin user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/webhook-monitor"
            element={
              user && user.role === 'admin' ? (
                <WebhookMonitor user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/subscribe"
            element={
              user ? (
                <SubscribePage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>

      {/* Aviso para definir idioma no perfil (fechável) */}
      {needsLanguageSelection && !languageNoticeDismissed && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <div className="bg-[#1a1a1a] border border-emerald-500/30 rounded-xl p-4 shadow-lg flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-white font-medium">
                {t('languageNotice.title', 'Idioma não definido')}
              </p>
              <p className="text-gray-300 text-sm mt-1">
                {t('languageNotice.message', 'Defina seu idioma preferido nas configurações do perfil para filtrar cursos no seu idioma.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/profile"
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
              >
                {t('languageNotice.cta', 'Ir para Perfil')}
              </a>
              <button
                onClick={dismissLanguageNotice}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                aria-label={t('languageNotice.close', 'Fechar aviso')}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de seleção de idioma (apenas quando explicitamente aberto) */}
      <LanguageSelectionModal
        isOpen={showLanguageModal}
        onLanguageSelect={handleLanguageSelect}
      />
      <VersionBadge />
    </div>
  );
}

export default App;