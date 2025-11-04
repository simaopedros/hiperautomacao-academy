import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, Sparkles, CreditCard, Zap, Shield } from 'lucide-react';
import UnifiedHeader from '../components/UnifiedHeader';
import { useI18n } from '@/hooks/useI18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SubscribePage() {
  const [plans, setPlans] = useState([]);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingBilling, setCreatingBilling] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    fetchGatewayConfig();
    fetchUserData();
    fetchPlans();
  }, []);

  const fetchGatewayConfig = async () => {
    try {
      const response = await axios.get(`${API}/gateway/active`);
      setGatewayConfig(response.data);
    } catch (error) {
      console.error('Error fetching gateway config:', error);
      setGatewayConfig({ active_gateway: 'abacatepay' });
    }
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/plans`);
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!currentUser) {
      alert('Você precisa estar logado para assinar');
      navigate('/login');
      return;
    }

    if (gatewayConfig?.active_gateway === 'hotmart') {
      const plan = plans.find((p) => p.id === planId);
      if (plan?.hotmart_checkout_url) {
        // Redireciona para checkout da Hotmart
        window.location.href = plan.hotmart_checkout_url;
      } else {
        alert('Este plano está configurado para Hotmart, mas não possui URL de checkout. Entre em contato com o administrador.');
      }
      return;
    }

    setCreatingBilling(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/billing/create`,
        {
          subscription_plan_id: planId,
          customer_name: currentUser.name,
          customer_email: currentUser.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem('last_billing_id', response.data.billing_id);
      window.location.href = response.data.payment_url;
    } catch (error) {
      console.error('Error creating billing:', error);
      alert(error.response?.data?.detail || 'Erro ao criar pagamento');
    } finally {
      setCreatingBilling(false);
    }
  };

  // Seleciona plano recomendado: segundo ativo (se existir), senão o primeiro
  const activePlans = (plans || []).filter((p) => p.is_active);
  const recommendedPlan = activePlans[1] || activePlans[0];

  return (
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-blue-500/15 blur-[130px] pointer-events-none" />

      <UnifiedHeader
        user={currentUser}
        onLogout={() => {
          localStorage.removeItem('token');
          navigate('/login');
        }}
        showBackButton={false}
      />

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Header minimalista com CTA único */}
        <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)] mb-8">
          <div className="p-6 border-b border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold gradient-text whitespace-nowrap truncate">
                {t('course.upsell.title', 'Acesso total para aprender mais rápido')}
              </h1>
              <p className="text-gray-300 text-sm whitespace-nowrap truncate">
                {t('course.upsell.subtitle', 'Assine para liberar tudo')}
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-gray-300">
              <div className="flex items-center gap-2 whitespace-nowrap truncate">
                <Check className="w-4 h-4 text-emerald-400" />
                {t('course.upsell.benefits.fullAccess', 'Acesso total a todos os cursos')}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap truncate">
                <Check className="w-4 h-4 text-emerald-400" />
                {t('course.upsell.benefits.newContent', 'Novos conteúdos e atualizações')}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap truncate">
                <Check className="w-4 h-4 text-emerald-400" />
                {t('course.upsell.benefits.support', 'Suporte e comunidade')}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => recommendedPlan && handleSubscribe(recommendedPlan.id)}
                disabled={!recommendedPlan || creatingBilling}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBilling ? t('course.upsell.ctaLoading', 'Processando...') : t('course.upsell.cta', 'Assinar agora')}
              </button>
              <button
                onClick={() => setShowAllPlans((v) => !v)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                {t('course.upsell.viewPlansCta', 'Ver planos')}
              </button>
            </div>
            <p className="text-emerald-300 text-xs mt-3 whitespace-nowrap truncate">
              {t('course.upsell.instantAccessNote', 'Acesso imediato após o pagamento')}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Sparkles className="w-10 h-10 text-emerald-400" />
            <span className="ml-3 text-gray-300">{t('course.upsell.loading', 'Carregando...')}</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 whitespace-nowrap truncate">{t('course.upsell.noneAvailable', 'Nenhum plano disponível no momento')}</p>
          </div>
        ) : showAllPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={plan.id}
                className={`relative bg-[#111111] rounded-xl p-8 border ${index === 1 ? 'border-emerald-600' : 'border-[#2a2a2a]'}`}
              >
                {index === 1 && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-semibold whitespace-nowrap truncate">{t('course.upsell.recommendedBadge', 'Recomendado')}</span>
                  </div>
                )}
                <h3 className="text-2xl font-semibold mb-2 whitespace-nowrap truncate">{plan.name}</h3>
                <p className="text-gray-400 mb-4 text-sm">{plan.description}</p>
                <div className="mb-6 space-y-1">
                  <p className="text-emerald-400 text-4xl font-bold">R$ {Number(plan.price_brl).toFixed(2)}</p>
                  <p className="text-gray-400 text-sm">Acesso por {plan.duration_days} dias</p>
                  {(() => {
                    const months = Math.max(1, Math.round(Number(plan.duration_days) / 30));
                    const monthly = Number(plan.price_brl) / months;
                    return (
                      <>
                        <p className="text-gray-300 text-sm">Equivale a R$ {monthly.toFixed(2)}/mês</p>
                        <p className="text-gray-500 text-xs">Total do período: R$ {Number(plan.price_brl).toFixed(2)} ({months} mês{months > 1 ? 'es' : ''})</p>
                      </>
                    );
                  })()}
                  {(() => {
                    // Economia vs plano mensal (se existir)
                    const months = Math.max(1, Math.round(Number(plan.duration_days) / 30));
                    const baselinePlan = plans.reduce((acc, p) => {
                      const m = Math.max(1, Math.round(Number(p.duration_days) / 30));
                      if (!acc) return { plan: p, months: m };
                      return m < acc.months ? { plan: p, months: m } : acc;
                    }, null);
                    if (!baselinePlan) return null;
                    const baseMonthly = Number(baselinePlan.plan.price_brl) / baselinePlan.months;
                    const baselineTotalForThisPeriod = baseMonthly * months;
                    const savings = baselineTotalForThisPeriod - Number(plan.price_brl);
                    const pct = baselineTotalForThisPeriod > 0 ? (savings / baselineTotalForThisPeriod) * 100 : 0;
                    return savings > 0 ? (
                      <p className="text-emerald-400 text-xs">Economize R$ {savings.toFixed(2)} ({pct.toFixed(0)}%) vs mensal</p>
                    ) : null;
                  })()}
                </div>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={creatingBilling || !plan.is_active}
                  className={`w-full py-3 rounded-lg font-semibold ${index === 1 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-800 hover:bg-gray-700'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {plan.is_active
                    ? (creatingBilling ? t('profile.subscription.plans.subscribeLoading', 'Processando...') : t('profile.subscription.plans.subscribeCta', 'Assinar agora'))
                    : t('profile.subscription.plans.unavailable', 'Indisponível')}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Overlay de processamento de cobrança */}
      {creatingBilling && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0f172a] border border-emerald-700/40 rounded-xl p-8 text-center w-[90%] max-w-md">
            <div className="mb-4 flex items-center justify-center">
              <CreditCard className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2 whitespace-nowrap truncate">{t('course.upsell.ctaLoading', 'Processando...')}</h2>
            <p className="text-emerald-200 text-sm whitespace-nowrap truncate">{t('course.upsell.instantAccessNote', 'Acesso imediato após o pagamento')}</p>
          </div>
        </div>
      )}
    </div>
  );
}