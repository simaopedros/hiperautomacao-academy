import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Confirmando sua assinatura...');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Persistir session_id como fallback, caso não esteja em localStorage
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      try {
        localStorage.setItem('last_billing_id', sessionId);
      } catch (e) {
        // Ignora erros de localStorage em modo privado/incógnito
        /* eslint-disable-line no-empty */
      }
    }

    checkSubscriptionStatus();

    // Redireciona para o dashboard após 8s
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 8000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const billingId = localStorage.getItem('last_billing_id');

      if (!billingId) {
        setMessage('Pagamento confirmado. Carregando informações da assinatura...');
        await fetchUserInfo();
        setChecking(false);
        return;
      }

      // Verifica status do pagamento/assinatura
      const response = await axios.get(
        `${API}/billing/${billingId}/check-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status === 'paid') {
        setMessage('✅ Assinatura confirmada! Benefícios aplicados.');
        // Limpa o billing id para evitar rechecagens desnecessárias
        try { 
          localStorage.removeItem('last_billing_id'); 
        } catch (e) {
          // Ignora erros de localStorage em modo privado/incógnito
          /* eslint-disable-line no-empty */
        }
      } else {
        setMessage('⏳ Pagamento pendente. Voltando ao dashboard em instantes...');
      }

      await fetchUserInfo();
      setChecking(false);
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      setMessage('Use o botão "Verificar Pagamento" no dashboard para confirmar.');
      await fetchUserInfo();
      setChecking(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserInfo(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
    }
  };

  const renderStatus = () => {
    if (!userInfo) return null;

    const validUntil = userInfo.subscription_valid_until
      ? new Date(userInfo.subscription_valid_until)
      : null;

    const hasFullAccess = !!userInfo.has_full_access;
    const planId = userInfo.subscription_plan_id || null;

    return (
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg p-6 mb-8">
        <p className="text-emerald-100 text-sm mb-2">Status da sua assinatura</p>
        {hasFullAccess ? (
          <p className="text-white text-lg font-semibold mb-1">Acesso total ativo</p>
        ) : (
          <p className="text-white text-lg font-semibold mb-1">Acesso limitado</p>
        )}
        {validUntil && (
          <p className="text-emerald-100 text-sm">Válida até: {validUntil.toLocaleString()}</p>
        )}
        {planId && (
          <p className="text-emerald-100 text-sm">Plano: {planId}</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
        {/* Ícone */}
        <div className="mb-6">
          {checking ? (
            <div className="mx-auto w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Mensagem */}
        <h1 className="text-3xl font-bold text-white mb-2">
          {checking ? 'Processando...' : 'Assinatura ativa!'}
        </h1>
        <p className="text-gray-400 mb-4">{message}</p>

        {/* Status da assinatura */}
        {!checking && renderStatus()}

        {/* Ações */}
        {!checking && (
          <div className="space-y-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Ir para o Dashboard
            </button>
            <button
              onClick={() => navigate('/subscribe')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Ver Planos
            </button>
          </div>
        )}

        <p className="text-gray-500 text-sm mt-6">
          {checking ? 'Aguarde...' : 'Redirecionando automaticamente em alguns segundos...'}
        </p>
      </div>
    </div>
  );
}