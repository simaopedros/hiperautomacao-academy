import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AdminDashboard from '@/pages/AdminDashboard';
import StudentDashboard from '@/pages/StudentDashboard';
import CourseView from '@/pages/CourseView';
import LessonPlayer from '@/pages/LessonPlayer';
import SocialFeed from '@/pages/SocialFeed';
import CreatePassword from '@/pages/CreatePassword';
import BuyCredits from '@/pages/BuyCredits';
import CreditHistory from '@/pages/CreditHistory';
import PaymentSuccess from '@/pages/PaymentSuccess';
import PaymentCancelled from '@/pages/PaymentCancelled';
import AdminFinance from '@/pages/AdminFinance';
import PaymentSettings from '@/pages/PaymentSettings';
import ReferralPage from '@/pages/ReferralPage';
import GamificationSettings from '@/pages/GamificationSettings';
import GatewaySettings from '@/pages/GatewaySettings';
import CreditPackagesConfig from '@/pages/CreditPackagesConfig';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
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
                <StudentDashboard user={user} onLogout={handleLogout} />
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
            path="/buy-credits"
            element={
              user ? (
                <BuyCredits user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/credit-history"
            element={
              user ? (
                <CreditHistory user={user} onLogout={handleLogout} />
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
            path="/admin/credit-packages"
            element={
              user && user.role === 'admin' ? (
                <CreditPackagesConfig user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/referral"
            element={
              user ? (
                <ReferralPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;