import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EVENT_OPTIONS = [
  { key: 'page_view', label: 'Page View (visualização de página)' },
  { key: 'login', label: 'Login' },
  { key: 'sign_up', label: 'Cadastro (sign_up)' },
  { key: 'purchase', label: 'Compra (purchase)' },
  { key: 'subscribe', label: 'Assinatura (subscribe)' },
  { key: 'generate_lead', label: 'Geração de Lead' },
  { key: 'search', label: 'Busca' },
  { key: 'course_view', label: 'Visualização de Curso' },
  { key: 'lesson_view', label: 'Visualização de Aula' },
  { key: 'lesson_progress', label: 'Progresso de Aula' },
];

const DATA_FIELDS_OPTIONS = [
  { key: 'page_title', label: 'Título da página' },
  { key: 'page_location', label: 'URL da página' },
  { key: 'page_path', label: 'Path da página' },
  { key: 'user_id', label: 'ID do usuário' },
  { key: 'user_role', label: 'Função do usuário (admin/aluno)' },
  { key: 'email_hash', label: 'Hash do e-mail (privacidade)' },
  { key: 'language', label: 'Idioma' },
  { key: 'plan_id', label: 'ID do plano' },
  { key: 'plan_name', label: 'Nome do plano' },
  { key: 'course_id', label: 'ID do curso' },
  { key: 'course_title', label: 'Título do curso' },
  { key: 'lesson_id', label: 'ID da aula' },
  { key: 'lesson_title', label: 'Título da aula' },
  { key: 'value', label: 'Valor (R$)' },
  { key: 'currency', label: 'Moeda' },
  { key: 'referrer', label: 'Referenciador (referrer)' },
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'utm_medium', label: 'UTM Medium' },
  { key: 'utm_campaign', label: 'UTM Campaign' },
];

export default function AnalyticsSettings({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    ga_measurement_id: '',
    meta_pixel_id: '',
    events: ['page_view'],
    data_fields: ['page_title','page_location','page_path'],
  });

  useEffect(() => {
    async function load() {
      try {
        // Prefer admin endpoint
        const token = localStorage.getItem('token');
        let res;
        try {
          res = await axios.get(`${API}/admin/analytics/config`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          // Fallback to public runtime endpoint
          res = await axios.get(`${API}/analytics/config`);
        }
        const data = res?.data || {};
        setForm({
          enabled: data.enabled !== false,
          ga_measurement_id: data.ga_measurement_id || '',
          meta_pixel_id: data.meta_pixel_id || '',
          events: Array.isArray(data.events) && data.events.length ? data.events : ['page_view'],
          data_fields: Array.isArray(data.data_fields) && data.data_fields.length ? data.data_fields : ['page_title','page_location','page_path'],
        });
      } catch (err) {
        console.warn('Falha ao carregar configuração do Analytics:', err?.response?.data || err?.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { ...form };
      await axios.post(`${API}/admin/analytics/config`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Configurações de Analytics salvas com sucesso.');
    } catch (err) {
      console.error('Erro ao salvar configurações de analytics:', err?.response?.data || err?.message);
      alert('Erro ao salvar configurações. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-emerald-400 text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <BarChart3 size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Configurações de Analytics</h1>
              <p className="text-sm text-gray-400">Gerencie o GA4 e o Meta Pixel usados no site</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Administrador</p>
              <p className="font-semibold text-white">{user?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-[#111111] border border-[#252525] rounded-xl p-6">
          <form onSubmit={saveSettings} className="space-y-6">
            <div>
              <Label className="text-gray-300">Habilitar rastreamento</Label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                <span className="text-sm text-gray-400">Ativa o GA4 e/ou Meta Pixel conforme abaixo</span>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">GA4 Measurement ID</Label>
              <Input
                placeholder="G-XXXXXXXXXX"
                value={form.ga_measurement_id}
                onChange={(e) => setForm({ ...form, ga_measurement_id: e.target.value })}
                className="bg-[#111111] border-[#2a2a2a] mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Ex.: G-123ABC456. Deixe vazio para não usar GA4.</p>
            </div>

            <div>
              <Label className="text-gray-300">Meta Pixel ID</Label>
              <Input
                placeholder="123456789012345"
                value={form.meta_pixel_id}
                onChange={(e) => setForm({ ...form, meta_pixel_id: e.target.value })}
                className="bg-[#111111] border-[#2a2a2a] mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Ex.: 123456789012345. Deixe vazio para não usar Meta Pixel.</p>
            </div>

            <div className="border-t border-[#252525] pt-6">
              <Label className="text-gray-300">Eventos enviados</Label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EVENT_OPTIONS.map((opt) => {
                  const checked = (form.events || []).includes(opt.key);
                  return (
                    <label key={opt.key} className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(form.events || []);
                          if (e.target.checked) next.add(opt.key); else next.delete(opt.key);
                          setForm({ ...form, events: Array.from(next) });
                        }}
                      />
                      <span className="text-sm text-gray-300">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">Selecione quais eventos podem ser enviados para GA4/Meta.</p>
            </div>

            <div className="border-t border-[#252525] pt-6">
              <Label className="text-gray-300">Dados permitidos</Label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DATA_FIELDS_OPTIONS.map((opt) => {
                  const checked = (form.data_fields || []).includes(opt.key);
                  return (
                    <label key={opt.key} className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(form.data_fields || []);
                          if (e.target.checked) next.add(opt.key); else next.delete(opt.key);
                          setForm({ ...form, data_fields: Array.from(next) });
                        }}
                      />
                      <span className="text-sm text-gray-300">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">Controle quais campos podem ser enviados nos eventos.</p>
            </div>

            <div className="border-t border-[#252525] pt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                O front-end tenta carregar esta configuração em tempo de execução.
                Se indisponível, ele usa variáveis de ambiente como fallback.
              </p>
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}