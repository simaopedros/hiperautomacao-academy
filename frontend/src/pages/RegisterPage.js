import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function RegisterPage({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    referralCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get referral code from URL
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode }));
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API}/api/auth/register`, {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: 'student',
        referral_code: formData.referralCode || undefined
      });

      localStorage.setItem('token', response.data.access_token);
      
      if (onLogin) {
        onLogin(response.data.user);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Hiperautomação</h1>
          <p className="text-gray-400">Crie sua conta e comece a aprender</p>
        </div>

        {/* Registration Card */}
        <div className="bg-[#111111] rounded-xl shadow-2xl p-8 border border-[#252525]">
          {formData.referralCode && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <div>
                  <p className="text-emerald-400 font-semibold text-sm">Você foi convidado!</p>
                  <p className="text-emerald-300 text-xs">Você ganhará créditos bônus ao se cadastrar</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-gray-300">Nome Completo</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#252525] text-white mt-1"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#252525] text-white mt-1"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-300">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="bg-[#0a0a0a] border-[#252525] text-white mt-1"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg font-semibold"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Já tem uma conta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Fazer Login
              </button>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-1">📚</div>
            <p className="text-xs text-gray-500">Cursos Exclusivos</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🎯</div>
            <p className="text-xs text-gray-500">Aprenda no seu ritmo</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🏆</div>
            <p className="text-xs text-gray-500">Certificados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
