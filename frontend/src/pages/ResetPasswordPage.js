import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token inválido ou ausente');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validações
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/auth/reset-password`, null, {
        params: {
          token: token,
          new_password: password
        }
      });
      
      setSuccess(true);
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao redefinir senha. O token pode estar expirado.');
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
          <p className="text-gray-400 text-base sm:text-lg">Redefinir Senha</p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#252525] rounded-2xl p-6 sm:p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Senha Redefinida!</h2>
              <p className="text-gray-400 mb-4">
                Sua senha foi alterada com sucesso.
              </p>
              <p className="text-sm text-gray-500">
                Redirecionando para o login...
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Nova Senha</h2>
                <p className="text-gray-400 text-sm">
                  Digite sua nova senha (mínimo 6 caracteres)
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 pr-12 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                      placeholder="********"
                      minLength={6}
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-3 px-4 pr-12 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                      placeholder="********"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      {password.length >= 6 ? (
                        <CheckCircle size={16} className="text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                      <span className={password.length >= 6 ? 'text-emerald-400' : 'text-red-400'}>
                        Mínimo 6 caracteres
                      </span>
                    </div>
                    {confirmPassword && (
                      <div className="flex items-center gap-2">
                        {password === confirmPassword ? (
                          <CheckCircle size={16} className="text-emerald-400" />
                        ) : (
                          <XCircle size={16} className="text-red-400" />
                        )}
                        <span className={password === confirmPassword ? 'text-emerald-400' : 'text-red-400'}>
                          Senhas coincidem
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Voltar para o login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
