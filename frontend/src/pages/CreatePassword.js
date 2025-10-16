import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
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
      setError('Token inválido');
      setValidating(false);
    } else {
      setValidating(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/create-password`, null, {
        params: {
          token: token,
          password: password
        }
      });
      
      // Login automático após criação
      onLogin(response.data.access_token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4\">
      <div className=\"max-w-md w-full animate-fade-in\">
        {/* Logo/Brand */}
        <div className=\"text-center mb-8\">
          <h1 className=\"text-5xl font-bold mb-2\">
            <span className=\"gradient-text\">Hiperautomação</span>
          </h1>
          <p className=\"text-gray-400 text-lg\">Bem-vindo à Plataforma</p>
        </div>

        <div className=\"bg-[#1a1a1a] border border-[#252525] rounded-2xl p-8 shadow-2xl\">
          <div className=\"flex items-center gap-3 mb-6\">
            <div className=\"w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center\">
              <CheckCircle className=\"text-emerald-400\" size={24} />
            </div>
            <div>
              <h2 className=\"text-xl font-bold text-white\">Crie sua Senha</h2>
              <p className=\"text-sm text-gray-400\">Complete seu cadastro</p>
            </div>
          </div>

          {error && (
            <div className=\"bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-6\">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className=\"space-y-4\">
            <div>
              <Label className=\"text-white\">Nova Senha</Label>
              <div className=\"relative mt-2\">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className=\"bg-[#111111] border-[#2a2a2a] text-white pr-12\"
                  required
                  minLength={6}
                  placeholder=\"Mínimo 6 caracteres\"
                />
                <button
                  type=\"button\"
                  onClick={() => setShowPassword(!showPassword)}
                  className=\"absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white\"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <Label className=\"text-white\">Confirmar Senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className=\"bg-[#111111] border-[#2a2a2a] text-white mt-2\"
                required
                minLength={6}
                placeholder=\"Digite a senha novamente\"
              />
            </div>

            <div className=\"bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-sm text-gray-400\">
              <p className=\"font-semibold text-white mb-2\">Requisitos da senha:</p>
              <ul className=\"space-y-1\">
                <li className={password.length >= 6 ? 'text-emerald-400' : ''}>
                  • Mínimo 6 caracteres
                </li>
                <li className={password === confirmPassword && password.length > 0 ? 'text-emerald-400' : ''}>
                  • Senhas conferem
                </li>
              </ul>
            </div>

            <Button
              type=\"submit\"
              disabled={loading}
              className=\"w-full bg-emerald-500 hover:bg-emerald-600 py-6 disabled:opacity-50\"
            >
              {loading ? 'Criando sua conta...' : 'Criar Senha e Entrar'}
            </Button>
          </form>
        </div>

        <p className=\"text-center text-gray-500 text-sm mt-6\">
          Após criar sua senha, você terá acesso imediato ao curso
        </p>
      </div>
    </div>
  );
}
