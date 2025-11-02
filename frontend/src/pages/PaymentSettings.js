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
    abacatepay_api_key: '',
    environment: 'sandbox',
    stripe_secret_key: '',
    stripe_webhook_secret: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/payment-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
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
            abacatepay_api_key: settings.abacatepay_api_key,
            environment: settings.environment,
            stripe_secret_key: settings.stripe_secret_key,
            stripe_webhook_secret: settings.stripe_webhook_secret
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('Configurações salvas com sucesso! Reinicie o backend para aplicar as mudanças.');
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Configurações de Pagamento</h1>
          <p className="text-gray-400">Configure as opções de pagamento da plataforma</p>
        </div>

        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Abacate Pay Section */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Abacate Pay</h2>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300">Ambiente</Label>
                  <select
                    value={settings.environment}
                    onChange={(e) => setSettings({ ...settings, environment: e.target.value })}
                    className="w-full bg-[#0a0a0a] border-[#2a2a2a] text-white rounded-md px-3 py-2"
                  >
                    <option value="sandbox">Sandbox (Testes)</option>
                    <option value="production">Produção (PIX Real)</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    {settings.environment === 'sandbox' 
                      ? '⚠️ Modo de testes - pagamentos não são reais'
                      : '🔴 Modo produção - pagamentos reais com PIX'}
                  </p>
                </div>

                <div>
                  <Label className="text-gray-300">API Key</Label>
                  <Input
                    type="password"
                    value={settings.abacatepay_api_key}
                    onChange={(e) => setSettings({ ...settings, abacatepay_api_key: e.target.value })}
                    required
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                    placeholder="abc_..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Sua chave API do Abacate Pay
                  </p>
                </div>
              </div>
            </div>

            {/* Stripe Section */}
            <div className="border-t border-[#252525] pt-6">
              <h2 className="text-xl font-bold text-white mb-4">Stripe</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300">Secret Key</Label>
                  <Input
                    type="password"
                    value={settings.stripe_secret_key || ''}
                    onChange={(e) => setSettings({ ...settings, stripe_secret_key: e.target.value })}
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                    placeholder="sk_live_... / sk_test_..."
                  />
                  <p className="text-sm text-gray-500 mt-1">Chave secreta da Stripe para criar sessões de checkout</p>
                </div>
                <div>
                  <Label className="text-gray-300">Webhook Secret</Label>
                  <Input
                    type="password"
                    value={settings.stripe_webhook_secret || ''}
                    onChange={(e) => setSettings({ ...settings, stripe_webhook_secret: e.target.value })}
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono"
                    placeholder="whsec_..."
                  />
                  <p className="text-sm text-gray-500 mt-1">Segredo do webhook para validar eventos da Stripe</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <p className="text-emerald-300 text-sm font-semibold mb-2">URL do Webhook da Stripe:</p>
                  <code className="text-emerald-400 text-sm bg-[#0a0a0a] p-2 rounded block break-all">{`${API}/api/webhook/stripe`}</code>
                  <p className="text-emerald-300 text-sm mt-2">Configure esta URL no dashboard da Stripe em Webhooks</p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-200">
                  <p className="font-semibold mb-2">Como obter sua API Key do Abacate Pay:</p>
                  <ol className="list-decimal list-inside space-y-1 text-yellow-300/80">
                    <li>Acesse <a href="https://abacatepay.com" target="_blank" rel="noopener noreferrer" className="underline">abacatepay.com</a> e faça login</li>
                    <li>Vá em "Configurações" → "API Keys"</li>
                    <li>Para testes: use a chave de Sandbox (abc_dev_...)</li>
                    <li>Para produção: use a chave de Produção (abc_live_...)</li>
                    <li>Cole a chave acima e salve</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Informações sobre Cursos */}
            <div className="border-t border-[#252525] pt-6">
              <h3 className="text-lg font-semibold text-white mb-3">Produtos Disponíveis</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p>Os cursos e seus preços são configurados individualmente através do painel administrativo.</p>
                <p>Cada curso pode ter seu próprio preço e configurações de pagamento.</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                <Save size={18} className="mr-2" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
              <Button
                type="button"
                onClick={() => navigate('/admin')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Cancelar
              </Button>
            </div>

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-200">
                  <p className="font-semibold mb-1">⚠️ Importante</p>
                  <p className="text-red-300/80">
                    Após salvar as configurações, é necessário <strong>reiniciar o backend</strong> para que as mudanças tenham efeito completo.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
