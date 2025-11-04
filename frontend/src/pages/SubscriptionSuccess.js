import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useI18n } from '../hooks/useI18n';
import { Button } from '@/components/ui/button';
import DotLottieCanvas from '@/components/animations/DotLottieCanvas';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState(t('subscription.confirming'));
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
      setMessage(t('payment.verifyButton'));
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
    const isActiveSubscription = !!(planId && validUntil && validUntil.getTime() > Date.now());

    return (
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg p-6 mb-8">
        <p className="text-emerald-100 text-sm mb-2">Status da sua assinatura</p>
        {planId ? (
          isActiveSubscription ? (
            <p className="text-white text-lg font-semibold mb-1">Assinatura ativa</p>
          ) : (
            <p className="text-white text-lg font-semibold mb-1">Assinatura cancelada ou expirada</p>
          )
        ) : hasFullAccess ? (
          <p className="text-white text-lg font-semibold mb-1">Acesso vitalício ativo</p>
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
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      {/* Overlays de gradiente para alinhar com o guia de estilo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_60%)] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/18 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-blue-500/14 blur-[130px] pointer-events-none" />

      <div className="flex items-center justify-center px-4 relative z-10">
        <div className="max-w-md w-full bg-gray-900/70 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-gray-800">
        {/* Ícone/Status acessível */}
        <div className="mb-6 relative" role="status" aria-live="polite" aria-busy={checking}>
          {checking ? (
            // Loading/Checking animation (DotLottie com canvas, usando JSON local)
            <DotLottieCanvas src="/lottie/checking.json" loop autoplay className="w-28 h-28 mx-auto" />
          ) : (
            // Success check animation (DotLottie)
            <div className="relative">
              <DotLottieCanvas src="/lottie/success.json" loop={false} autoplay className="w-28 h-28 mx-auto" />
              {/* Confetti celebration background */}
              <div className="pointer-events-none absolute inset-0 -z-10">
                <DotLottieCanvas src="/lottie/confetti.json" loop autoplay className="w-64 h-64 mx-auto opacity-70" />
              </div>
            </div>
          )}
        </div>

        {/* Mensagem */}
        <h1 id="subscription-success-title" className="text-3xl font-bold gradient-text mb-2">
          {checking ? 'Processando...' : 'Assinatura ativa!'}
        </h1>
        <p className="text-gray-300 mb-4" aria-describedby="subscription-success-title" aria-live="polite">{message}</p>

        {/* Status da assinatura */}
        {!checking && renderStatus()}

        {/* Ações */}
        {!checking && (
          <div className="space-y-4">
            <Button onClick={() => navigate('/dashboard')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Ir para o Dashboard
            </Button>
            {userInfo?.subscription_plan_id && !(userInfo?.subscription_valid_until && new Date(userInfo.subscription_valid_until).getTime() > Date.now()) ? (
              <Button onClick={() => navigate('/subscribe')} variant="secondary" className="w-full bg-red-600 hover:bg-red-700 text-white">
                Reativar Assinatura
              </Button>
            ) : (
              <Button onClick={() => navigate('/subscribe')} variant="secondary" className="w-full bg-gray-800 hover:bg-gray-700 text-white">
                Ver Planos
              </Button>
            )}
          </div>
        )}

        <p className="text-gray-400 text-sm mt-6" aria-live="polite">
          {checking ? 'Aguarde...' : 'Redirecionando automaticamente em alguns segundos...'}
        </p>
        </div>
      </div>
    </div>
  );
}