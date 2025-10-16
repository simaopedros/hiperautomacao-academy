import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function GamificationSettings({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    create_post: 5,
    create_comment: 2,
    receive_like: 1,
    complete_course: 20
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/gamification-settings`, {
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
        `${API}/api/admin/gamification-settings`,
        null,
        {
          params: settings,
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('Configurações salvas com sucesso!');
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
              <Gift className="text-emerald-400" size={24} />
              <h1 className="text-2xl font-bold text-white">Gamificação</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <h2 className="text-xl font-bold text-white mb-6">Recompensas de Créditos</h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Importante:</strong> Apenas usuários que já fizeram pelo menos uma compra na plataforma 
                receberão esses bônus. Além disso, é necessário ter pelo menos 1 crédito para participar da comunidade.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-300">Criar Discussão</Label>
                <Input
                  type="number"
                  value={settings.create_post}
                  onChange={(e) => setSettings({ ...settings, create_post: parseInt(e.target.value) })}
                  required
                  min="0"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Créditos ganhos ao criar uma nova discussão na comunidade
                </p>
              </div>

              <div>
                <Label className="text-gray-300">Comentar em Discussão</Label>
                <Input
                  type="number"
                  value={settings.create_comment}
                  onChange={(e) => setSettings({ ...settings, create_comment: parseInt(e.target.value) })}
                  required
                  min="0"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Créditos ganhos ao comentar em discussões
                </p>
              </div>

              <div>
                <Label className="text-gray-300">Receber Like</Label>
                <Input
                  type="number"
                  value={settings.receive_like}
                  onChange={(e) => setSettings({ ...settings, receive_like: parseInt(e.target.value) })}
                  required
                  min="0"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Créditos ganhos quando seu post/comentário recebe um like
                </p>
              </div>

              <div>
                <Label className="text-gray-300">Completar Curso</Label>
                <Input
                  type="number"
                  value={settings.complete_course}
                  onChange={(e) => setSettings({ ...settings, complete_course: parseInt(e.target.value) })}
                  required
                  min="0"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Créditos ganhos ao concluir 100% de um curso
                </p>
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
          </form>

          {/* Preview */}
          <div className="mt-8 pt-8 border-t border-[#252525]">
            <h3 className="text-lg font-semibold text-white mb-4">Resumo das Recompensas</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#0a0a0a] rounded p-4">
                <p className="text-gray-400 mb-1">Criar discussão</p>
                <p className="text-emerald-400 font-bold text-xl">{settings.create_post} créditos</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-4">
                <p className="text-gray-400 mb-1">Comentar</p>
                <p className="text-emerald-400 font-bold text-xl">{settings.create_comment} créditos</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-4">
                <p className="text-gray-400 mb-1">Receber like</p>
                <p className="text-emerald-400 font-bold text-xl">{settings.receive_like} créditos</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-4">
                <p className="text-gray-400 mb-1">Completar curso</p>
                <p className="text-emerald-400 font-bold text-xl">{settings.complete_course} créditos</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
