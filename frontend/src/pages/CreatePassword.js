import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CreatePassword({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Token invalido');
      setValidating(false);
    } else {
      setValidating(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('As senhas nao conferem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/create-password`, null, {
        params: {
          token: token,
          password: password,
        },
      });

      onLogin(response.data.access_token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar senha');
    } finally {
      setLoading(false);
    }
  };

  const tips = [
    'Use letras maiusculas e minusculas',
    'Inclua numeros e caracteres especiais',
    'Evite repetir senhas de outros servicos',
  ];

  if (validating) {
    return (
      <div className="min-h-screen bg-[#02060f] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02060f] relative overflow-hidden text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_60%)] pointer-events-none" />
      <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-blue-500/15 blur-[160px] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-72 h-72 bg-emerald-400/25 blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-center">
          <div className="hidden lg:flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-10 shadow-[0_25px_110px_rgba(2,6,23,0.8)]">
            <span className="chip w-fit">
              <Sparkles size={16} />
              Novo acesso premium
            </span>
            <div>
              <h1 className="text-4xl font-semibold leading-tight mb-4">
                Garanta a seguranca do seu acesso a Hiperautomacao.
              </h1>
              <p className="text-gray-300 text-base leading-relaxed">
                Criar uma senha forte protege seu progresso, certificados e beneficios da comunidade.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel border-white/15 p-5 rounded-2xl">
                <ShieldCheck size={28} className="text-emerald-300 mb-3" />
                <p className="text-lg font-semibold">Verificacao segura</p>
                <p className="text-sm text-gray-300">
                  Tokens criptografados expiram apos o primeiro uso.
                </p>
              </div>
              <div className="glass-panel border-white/15 p-5 rounded-2xl">
                <KeyRound size={28} className="text-blue-300 mb-3" />
                <p className="text-lg font-semibold">Boas praticas</p>
                <ul className="text-sm text-gray-300 space-y-1 mt-2 list-disc list-inside">
                  {tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="w-full max-w-lg mx-auto glass-panel border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-[0_25px_90px_rgba(0,0,0,0.55)] animate-fade-in">
            <div className="text-center mb-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Hiperautomacao Academy</p>
              <h2 className="text-3xl font-semibold">Defina sua nova senha</h2>
              <p className="text-sm text-gray-300">
                Este link e unico e deixa de funcionar apos o uso.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-sm text-gray-200">Nova senha</Label>
                <div className="relative mt-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-black/40 border-white/10 text-white pr-12"
                    required
                    placeholder="Minimo 6 caracteres"
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
                <Label className="text-sm text-gray-200">Confirmar senha</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-black/40 border-white/10 text-white mt-2"
                  required
                  placeholder="Repita a senha"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle size={16} className="text-emerald-300" />
                Apenas voce tera acesso a esta informacao.
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-6 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_18px_35px_rgba(16,185,129,0.35)]"
              >
                {loading ? 'Criando...' : 'Criar senha e acessar'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
