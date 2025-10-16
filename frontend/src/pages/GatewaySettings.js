import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function GatewaySettings({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    active_gateway: 'abacatepay',
    hotmart_token: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/gateway-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
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
        `${API}/api/admin/gateway-config`,
        null,
        {
          params: config,
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving config:', error);
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
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <CreditCard className="text-emerald-400" size={24} />
              <h1 className="text-2xl font-bold text-white">Gateway de Pagamento</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <h2 className="text-xl font-bold text-white mb-6">Configuração Global de Gateway</h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Importante:</strong> Escolha qual gateway de pagamento será utilizado 
                globalmente na plataforma. Esta configuração afeta todos os cursos e pacotes de créditos.
              </p>
            </div>

            {/* Gateway Selection */}
            <div>
              <Label className="text-gray-300 mb-3 block">Gateway Ativo</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                  <input
                    type="radio"
                    name="gateway"
                    value="abacatepay"
                    checked={config.active_gateway === 'abacatepay'}
                    onChange={(e) => setConfig({ ...config, active_gateway: e.target.value })}
                    className="w-4 h-4 text-emerald-500"
                  />
                  <div>
                    <p className="text-white font-semibold">Abacate Pay</p>
                    <p className="text-sm text-gray-500">Gateway padrão com PIX e Cartão</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                  <input
                    type="radio"
                    name="gateway"
                    value="hotmart"
                    checked={config.active_gateway === 'hotmart'}
                    onChange={(e) => setConfig({ ...config, active_gateway: e.target.value })}
                    className="w-4 h-4 text-emerald-500"
                  />
                  <div>
                    <p className="text-white font-semibold">Hotmart</p>
                    <p className="text-sm text-gray-500">Vendas através da Hotmart (webhook)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Hotmart Token (only show if Hotmart is selected) */}
            {config.active_gateway === 'hotmart' && (
              <div>
                <Label className="text-gray-300">Token de Segurança Hotmart (hottok)</Label>
                <Input
                  type="text"
                  value={config.hotmart_token || ''}
                  onChange={(e) => setConfig({ ...config, hotmart_token: e.target.value })}
                  placeholder="Digite o token de segurança da Hotmart"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Configure este token nas configurações de webhook da Hotmart para validar as requisições
                </p>
              </div>
            )}

            {/* Webhook URL Info */}
            {config.active_gateway === 'hotmart' && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-emerald-300 text-sm font-semibold mb-2">
                  URL do Webhook para Hotmart:
                </p>
                <code className="text-emerald-400 text-sm bg-[#0a0a0a] p-2 rounded block break-all">
                  {`${API}/api/hotmart/webhook`}
                </code>
                <p className="text-emerald-300 text-sm mt-2">
                  Configure esta URL na sua conta Hotmart para receber notificações de compra.
                </p>
              </div>
            )}

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
          </form>
        </div>
      </main>
    </div>
  );
}
