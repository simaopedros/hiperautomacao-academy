import { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, LogIn, UserPlus, Mail, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { 
            email: formData.email, 
            password: formData.password, 
            name: formData.name,
            role: 'student' // Always force student role for public registration
          };

      const response = await axios.post(`${API}${endpoint}`, payload);
      onLogin(response.data.access_token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API}/auth/forgot-password`, null, {
        params: { email: forgotEmail }
      });
      setForgotSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">
            <span className="gradient-text">Hiperautomação</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">Plataforma de Cursos Online</p>
        </div>

        {/* Forgot Password Card */}
        {showForgotPassword ? (
          <div className="bg-[#1a1a1a] border border-[#252525] rounded-2xl p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setForgotSuccess(false);
                setForgotEmail('');
                setError('');
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft size={18} />
              Voltar
            </button>

            {forgotSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Email Enviado!</h2>
                <p className="text-gray-400 mb-6">
                  Se o email <span className="text-white font-semibold">{forgotEmail}</span> estiver cadastrado,
                  você receberá instruções para redefinir sua senha.
                </p>
                <p className="text-sm text-gray-500">
                  Verifique sua caixa de entrada e spam.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
                  <p className="text-gray-400 text-sm">
                    Digite seu email e enviaremos instruções para redefinir sua senha
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                      placeholder="seu@email.com"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          /* Login/Register Card */
          <div className="bg-[#1a1a1a] border border-[#252525] rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex gap-2 mb-6">
              <button
                data-testid="login-tab"
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  isLogin
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
              >
                <LogIn className="inline-block w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Entrar
              </button>
              <button
                data-testid="register-tab"
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  !isLogin
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="inline-block w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Registrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome
                  </label>
                  <input
                    data-testid="name-input"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                    placeholder="Seu nome completo"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  data-testid="email-input"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Senha
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    data-testid="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 pr-12 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                data-testid="submit-button"
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
              </button>
            </form>
          </div>
        )}

        {/* Footer removido */}
      </div>
    </div>
  );
}