import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function SupportSettings({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    support_url: '',
    support_text: 'Suporte',
    enabled: true
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/api/support/config`);
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching support config:', error);
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
        `${API}/api/admin/support/config`,
        null,
        {
          params: config,
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('Configurações de suporte salvas com sucesso!');
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
              <MessageCircle className="text-emerald-400" size={24} />
              <h1 className="text-2xl font-bold text-white">Configuração de Suporte</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <h2 className="text-xl font-bold text-white mb-6">Link de Suporte para Alunos</h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Importante:</strong> Configure o link que será exibido no botão de suporte para os alunos. 
                Pode ser WhatsApp, email, Telegram, ou qualquer URL de suporte.
              </p>
            </div>

            {/* URL de Suporte */}
            <div>
              <Label className="text-gray-300 mb-2 block">URL de Suporte</Label>
              <Input
                type="url"
                value={config.support_url}
                onChange={(e) => setConfig({ ...config, support_url: e.target.value })}
                placeholder="https://wa.me/5511999999999"
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Exemplos: 
                <br />• WhatsApp: https://wa.me/5511999999999
                <br />• Telegram: https://t.me/seu_usuario
                <br />• Email: mailto:suporte@seudominio.com
              </p>
            </div>

            {/* Texto do Botão */}
            <div>
              <Label className="text-gray-300 mb-2 block">Texto do Botão</Label>
              <Input
                type="text"
                value={config.support_text}
                onChange={(e) => setConfig({ ...config, support_text: e.target.value })}
                placeholder="Suporte"
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Texto que aparecerá no botão de suporte
              </p>
            </div>

            {/* Ativar/Desativar */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="enabled" className="text-gray-300 cursor-pointer">
                Exibir botão de suporte para os alunos
              </Label>
            </div>

            {/* Preview */}
            {config.enabled && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-emerald-300 text-sm font-semibold mb-3">
                  Preview do Botão:
                </p>
                <button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
                  disabled
                >
                  <MessageCircle size={18} />
                  {config.support_text}
                </button>
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
