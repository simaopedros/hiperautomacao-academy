import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function GatewaySettings({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-start gap-4">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-[#141414]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gateway de Pagamentos</h1>
            <p className="text-gray-400">A plataforma agora utiliza exclusivamente a Stripe para processar assinaturas.</p>
          </div>
        </div>

        <div className="bg-[#111111] rounded-lg border border-[#252525] p-10 text-gray-200">
          <div className="flex items-center gap-3 text-emerald-300 mb-6">
            <CreditCard size={22} />
            <span className="font-semibold">Stripe é o gateway padrão</span>
          </div>

          <p className="text-gray-300 leading-relaxed mb-4">
            Concluímos a migração para o Stripe como único provedor de pagamentos. Isso simplifica o fluxo de checkout,
            reduz pontos de falha e permite recursos avançados como renovação automática, cancelamento programado
            e sincronização de status em tempo real via webhooks.
          </p>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-sm text-emerald-200 mb-6">
            <p className="font-semibold mb-2">O que você precisa configurar:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Crie produtos e preços recorrentes no dashboard da Stripe.</li>
              <li>Cadastre o webhook em <code className="bg-[#0a0a0a] px-2 py-1 rounded">{`${API}/api/webhook/stripe`}</code>.</li>
              <li>Informe a Secret Key e o Webhook Secret na página de <Link to="/admin/payment-settings" className="underline text-emerald-300">Configurações de Pagamento</Link>.</li>
              <li>Associe os Price IDs aos planos de assinatura no painel administrativo.</li>
            </ul>
          </div>

          <p className="text-gray-400 text-sm">
            Precisa alterar as credenciais da Stripe ou encaminhar eventos para outro sistema? Acesse
            {' '}<Link to="/admin/payment-settings" className="underline text-emerald-300">Configurações de Pagamento</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
