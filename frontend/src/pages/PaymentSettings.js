import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Settings, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminNavigation from '../components/AdminNavigation';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function PaymentSettings({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    forward_webhook_url: '',
    forward_test_events: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/payment-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings({
        stripe_secret_key: response.data.stripe_secret_key || '',
        stripe_webhook_secret: response.data.stripe_webhook_secret || '',
        forward_webhook_url: response.data.forward_webhook_url || '',
        forward_test_events: !!response.data.forward_test_events,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/admin/payment-settings`,
        null,
        {
          params: {
            stripe_secret_key: settings.stripe_secret_key || undefined,
            stripe_webhook_secret: settings.stripe_webhook_secret || undefined,
            forward_webhook_url: settings.forward_webhook_url || undefined,
            forward_test_events: settings.forward_test_events ? 'true' : 'false',
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      alert('Configurações da Stripe salvas com sucesso! Reinicie o backend para aplicar as mudanças.');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(error.response?.data?.detail || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-start gap-4">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-[#141414]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configurações de Pagamento</h1>
            <p className="text-gray-400">Configure as credenciais da Stripe utilizadas no checkout de assinaturas.</p>
          </div>
        </div>

        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <Settings className="text-emerald-300" size={22} />
              <div className="text-sm text-emerald-200">
                <p className="font-semibold">Stripe como provedor único</p>
                <p>Todas as assinaturas são processadas via Stripe. Configure abaixo a chave secreta e o webhook para receber eventos.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-gray-300">Stripe Secret Key</Label>
                <Input
                  type="password"
                  value={settings.stripe_secret_key}
                  onChange={(e) => setSettings({ ...settings, stripe_secret_key: e.target.value })}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                  placeholder="sk_live_... ou sk_test_..."
                />
                <p className="text-sm text-gray-500 mt-1">Chave secreta usada nas chamadas autenticadas da Stripe (Admin API).</p>
              </div>

              <div>
                <Label className="text-gray-300">Stripe Webhook Secret</Label>
                <Input
                  type="password"
                  value={settings.stripe_webhook_secret}
                  onChange={(e) => setSettings({ ...settings, stripe_webhook_secret: e.target.value })}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                  placeholder="whsec_..."
                />
                <p className="text-sm text-gray-500 mt-1">Segredo do endpoint de webhook no dashboard da Stripe, necessário para validar eventos.</p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-emerald-300 text-sm font-semibold mb-2">URL do Webhook da Stripe:</p>
                <code className="text-emerald-400 text-sm bg-[#0a0a0a] p-2 rounded block break-all">{`${API}/api/webhook/stripe`}</code>
                <p className="text-emerald-300 text-sm mt-2">Cadastre esta URL em <strong>Developers &gt; Webhooks</strong> no dashboard da Stripe.</p>
              </div>

              <div>
                <Label className="text-gray-300">Encaminhar eventos para URL externa</Label>
                <Input
                  type="url"
                  value={settings.forward_webhook_url}
                  onChange={(e) => setSettings({ ...settings, forward_webhook_url: e.target.value })}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                  placeholder="https://seu-sistema.com/webhook"
                />
                <p className="text-sm text-gray-500 mt-1">Opcional: receba eventos normalizados (ativação, renovação, cancelamento, falha) em outro sistema.</p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="forward_test_events"
                    type="checkbox"
                    checked={settings.forward_test_events}
                    onChange={(e) => setSettings({ ...settings, forward_test_events: e.target.checked })}
                  />
                  <Label htmlFor="forward_test_events" className="text-gray-300">Incluir eventos de teste da Stripe (livemode = false)</Label>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-blue-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm space-y-2">
                  <p className="font-semibold">Passos recomendados para configurar a Stripe:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-200/80">
                    <li>Crie um produto e um preço recorrente (mensal/anual) no dashboard da Stripe.</li>
                    <li>Copie o <strong>Price ID</strong> (ex.: price_abc123) e vincule ao plano de assinatura no painel de administração.</li>
                    <li>Em Developers &gt; API keys, copie a Secret Key (modo Teste ou Live) e cole acima.</li>
                    <li>Em Developers &gt; Webhooks, crie um endpoint para {`${API}/api/webhook/stripe`} e copie o Webhook Secret.</li>
                    <li>Habilite assinaturas em modo teste e execute um checkout para validar o fluxo de ponta a ponta.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f1f]">
              <Button
                type="button"
                variant="outline"
                className="border-[#2a2a2a] text-gray-300"
                onClick={() => navigate(-1)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
                <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
