import { useState } from 'react';
import axios from 'axios';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Mail,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Users,
  PlayCircle,
} from 'lucide-react';

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
    name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const highlightStats = [
    { label: 'Alunos ativos', value: '+3k', icon: Users },
    { label: 'Horas de conteudo', value: '120h', icon: PlayCircle },
    { label: 'Satisfacao media', value: '4.9/5', icon: ShieldCheck },
  ];

  const benefitPills = [
    'Mentorias ao vivo',
    'Projetos guiados',
    'Comunidade premium',
    'Certificados oficiais',
  ];

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
            role: 'student',
          };

      const response = await axios.post(`${API}${endpoint}`, payload);
      onLogin(response.data.access_token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar requisicao');
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
        params: { email: forgotEmail },
      });
      setForgotSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar requisicao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)] pointer-events-none" />
      <div className="absolute -top-24 -right-20 w-80 h-80 bg-emerald-500/30 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-72 h-72 bg-blue-500/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-stretch">
          <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-10 shadow-[0_30px_120px_rgba(6,24,44,0.55)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_60%)] opacity-60" />
            <div className="relative z-10 space-y-8">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-emerald-200">
                <Sparkles size={16} /> Nova experiencia
              </span>
              <div>
                <h1 className="text-4xl xl:text-5xl font-semibold leading-tight mb-4">
                  Evolua sua jornada com o ecossistema Hiperautomacao
                </h1>
                <p className="text-gray-200 text-base leading-relaxed max-w-xl">
                  Conteudo atualizado, trilhas praticas e uma comunidade focada em resultados reais para o seu desenvolvimento.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {highlightStats.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-black/30 rounded-2xl border border-white/10 p-4">
                    <Icon size={22} className="text-emerald-300 mb-3" />
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="text-xs text-gray-300 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                {benefitPills.map((item) => (
                  <span key={item} className="px-4 py-2 rounded-full text-sm border border-white/15 bg-white/5 text-gray-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl mx-auto lg:max-w-none animate-fade-in">
            {showForgotPassword ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSuccess(false);
                    setForgotEmail('');
                    setError('');
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
                >
                  <ArrowLeft size={18} />
                  Voltar
                </button>

                {forgotSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Mail size={32} className="text-emerald-300" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-2">Email enviado</h2>
                    <p className="text-gray-300 mb-6">
                      Se o email <span className="text-white font-semibold">{forgotEmail}</span> estiver cadastrado,
                      voce recebera instrucoes para redefinir sua senha.
                    </p>
                    <p className="text-sm text-gray-500">Verifique sua caixa de entrada, spam ou promocoes.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Mail size={32} className="text-blue-300" />
                      </div>
                      <h2 className="text-2xl font-semibold text-white mb-2">Recuperar senha</h2>
                      <p className="text-gray-300 text-sm">
                        Digite seu email e enviaremos instrucoes seguras para redefinir sua senha
                      </p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-200 mb-2">Email</label>
                        <input
                          id="forgot-email"
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                          placeholder="voce@email.com"
                          required
                        />
                      </div>

                      {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Processando...' : 'Enviar instrucoes'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
                <div className="text-center mb-8 space-y-2">
                  <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Hiperautomacao Academy</p>
                  <h2 className="text-3xl sm:text-4xl font-semibold">Acesse sua plataforma</h2>
                  <p className="text-gray-300 text-sm">Faca login ou crie sua conta para continuar sua jornada</p>
                </div>

                <div className="flex gap-2 mb-6">
                  <button
                    data-testid="login-tab"
                    onClick={() => {
                      setIsLogin(true);
                      setError('');
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                      isLogin
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_12px_30px_rgba(16,185,129,0.35)]'
                        : 'bg-black/30 text-gray-300 hover:text-white border border-white/10'
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
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                      !isLogin
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_12px_30px_rgba(16,185,129,0.35)]'
                        : 'bg-black/30 text-gray-300 hover:text-white border border-white/10'
                    }`}
                  >
                    <UserPlus className="inline-block w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Registrar
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label htmlFor="name-input" className="block text-sm font-medium text-gray-200 mb-2">Nome</label>
                      <input
                        id="name-input"
                        data-testid="name-input"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                        required
                        placeholder="Seu nome completo"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="email-input" className="block text-sm font-medium text-gray-200 mb-2">Email</label>
                    <input
                      id="email-input"
                      data-testid="email-input"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="password-input" className="block text-sm font-medium text-gray-200">Senha</label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                        >
                          Esqueceu a senha?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password-input"
                        data-testid="password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 pr-12 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
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
                    <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
}
