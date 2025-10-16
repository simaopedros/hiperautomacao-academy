import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Copy, Users, Gift, TrendingUp, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ReferralPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/referral/info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Referral info:', response.data);
      setReferralInfo(response.data);
    } catch (error) {
      console.error('Error fetching referral info:', error);
      // Set default values if API fails
      setReferralInfo({
        referral_code: 'LOADING...',
        referral_link: '',
        total_referrals: 0,
        total_credits_earned: 0,
        referrals: [],
        signup_bonus: 10,
        purchase_percentage: 50
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (referralInfo?.referral_link) {
      navigator.clipboard.writeText(referralInfo.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (!referralInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Erro ao carregar informações de indicação</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Voltar ao Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full mb-4">
            <Users className="text-emerald-400" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Programa de Indicações</h1>
          <p className="text-gray-400 text-lg">
            Compartilhe com amigos e ganhe créditos a cada indicação!
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-[#111111] rounded-xl p-6 border border-[#252525]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400">Total de Indicados</p>
              <Users className="text-blue-400" size={24} />
            </div>
            <p className="text-4xl font-bold text-white">{referralInfo?.total_referrals || 0}</p>
          </div>

          <div className="bg-[#111111] rounded-xl p-6 border border-[#252525]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400">Créditos Ganhos por Indicação</p>
              <Gift className="text-emerald-400" size={24} />
            </div>
            <p className="text-4xl font-bold text-white">{referralInfo?.total_credits_earned || 0}</p>
            <p className="text-sm text-gray-500 mt-1">
              {referralInfo?.purchase_percentage}% das compras dos indicados
            </p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 rounded-xl p-8 border border-emerald-500/30 mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Seu Link de Indicação</h2>
          <p className="text-gray-400 mb-4">
            Compartilhe este link com seus amigos. Você ganha {referralInfo?.purchase_percentage}% dos créditos 
            que eles comprarem na plataforma! <strong className="text-emerald-400">Você precisa ter feito pelo menos uma 
            compra para começar a ganhar bônus.</strong>
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={referralInfo?.referral_link || ''}
              readOnly
              className="flex-1 bg-[#111111] border border-[#252525] text-white px-4 py-3 rounded-lg font-mono text-sm"
            />
            <button
              onClick={handleCopyLink}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle size={20} />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy size={20} />
                  Copiar Link
                </>
              )}
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Seu código: <span className="text-emerald-400 font-mono font-bold">{referralInfo?.referral_code}</span>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-[#111111] rounded-xl p-8 border border-[#252525] mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Como Funciona</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-400">1</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Faça sua primeira compra</h3>
              <p className="text-sm text-gray-400">
                Você precisa ter comprado pelo menos um pacote de créditos ou curso
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-400">2</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Compartilhe seu link</h3>
              <p className="text-sm text-gray-400">
                Envie seu link de indicação para amigos e família
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-400">3</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Ganhe continuamente</h3>
              <p className="text-sm text-gray-400">
                Receba {referralInfo?.purchase_percentage}% dos créditos que seus indicados comprarem
              </p>
            </div>
          </div>
        </div>

        {/* Referrals List */}
        {referralInfo?.referrals && referralInfo.referrals.length > 0 && (
          <div className="bg-[#111111] rounded-xl border border-[#252525] overflow-hidden">
            <div className="p-6 border-b border-[#252525]">
              <h2 className="text-2xl font-bold text-white">Seus Indicados</h2>
            </div>
            <div className="divide-y divide-[#252525]">
              {referralInfo.referrals.map((referral) => (
                <div key={referral.id} className="p-6 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{referral.name}</p>
                      <p className="text-sm text-gray-500">{referral.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Cadastrado em</p>
                      <p className="text-white font-medium">{formatDate(referral.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {referralInfo?.referrals && referralInfo.referrals.length === 0 && (
          <div className="bg-[#111111] rounded-xl p-12 border border-[#252525] text-center">
            <Users className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 text-lg">Você ainda não tem indicados</p>
            <p className="text-gray-500 mt-2">Compartilhe seu link para começar a ganhar créditos!</p>
          </div>
        )}
      </main>
    </div>
  );
}
