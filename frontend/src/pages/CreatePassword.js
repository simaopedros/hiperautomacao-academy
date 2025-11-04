import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CreatePassword({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = searchParams.get('token') || '';

  const [currentToken, setCurrentToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState('');
  const [tokenExpired, setTokenExpired] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  useEffect(() => {
    if (!currentToken) {
      setError('Token inválido. Solicite um novo link de acesso.');
      setTokenExpired(true);
    }
  }, [currentToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentToken || tokenExpired) return;

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    setResendStatus(null);

    try {
      const response = await axios.post(`${API}/create-password`, null, {
        params: {
          token: currentToken,
          password,
        },
      });

      onLogin(response.data.access_token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Erro ao criar senha.';
      if (detail.toLowerCase().includes('expir')) {
        setTokenExpired(true);
        setError('');
        setResendStatus({
          type: 'error',
          message: 'Este link expirou. Solicite um novo acesso abaixo.',
        });
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!currentToken) return;
    setResending(true);
    setResendStatus(null);

    try {
      const response = await axios.post(`${API}/create-password/resend`, { token: currentToken });
      const newToken = response.data?.token;
      if (newToken) {
        setCurrentToken(newToken);
        setTokenExpired(false);
        setPassword('');
        setConfirmPassword('');
        const params = new URLSearchParams(searchParams);
        params.set('token', newToken);
        navigate(`/create-password?${params.toString()}`, { replace: true });
      }
      setResendStatus({
        type: 'success',
        message: 'Enviamos um novo link para o seu e-mail.',
      });
    } catch (err) {
      setResendStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Não foi possível reenviar o link.',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05060b] text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col gap-8 text-center mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">
              Hiperautomação Academy
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Defina sua nova senha</h1>
            <p className="mt-2 text-sm text-gray-400">
              Use um link enviado por e-mail para completar o primeiro acesso.
            </p>
          </div>

          {tokenExpired && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              Este link não é mais válido. Solicite um novo abaixo.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {resendStatus && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                resendStatus.type === 'success'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              {resendStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {resendStatus.message}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_25px_80px_rgba(15,23,42,0.55)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-sm text-gray-200">Nova senha</Label>
              <div className="relative mt-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-black/30 border-white/10 text-white pr-12"
                  placeholder="Mínimo 6 caracteres"
                  disabled={tokenExpired}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-sm text-gray-200">Confirmar senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="bg-black/30 border-white/10 text-white mt-2"
                placeholder="Repita a senha"
                disabled={tokenExpired}
                required
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle size={14} className="text-emerald-300" />
              Dica: combine letras, números e símbolos para mais segurança.
            </div>

            <Button
              type="submit"
              disabled={loading || tokenExpired}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Criar senha e acessar'}
            </Button>
          </form>

          {tokenExpired && (
            <div className="mt-6 space-y-3 text-sm text-gray-300">
              <p>Não recebeu o novo e-mail? Clique abaixo para reenviar.</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={resending}
                className="w-full border-white/20 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Reenviando...
                  </span>
                ) : (
                  'Enviar novo link'
                )}
              </Button>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-500">
            Link enviado para o e-mail cadastrado. Caso não encontre, verifique a caixa de spam ou{' '}
            <Link to="/login" className="text-emerald-300 hover:text-emerald-200 underline">
              acesse a página de login
            </Link>{' '}
            e siga as instruções.
          </div>
        </div>
      </div>
    </div>
  );
}
