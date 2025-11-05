import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, 
  BookOpen, 
  Settings, 
  Mail,
  MessageCircle,
  Gift,
  Package,
  DollarSign,
  CreditCard,
  FolderOpen,
  LogOut,
  ChevronDown,
  Save,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LeadSettings({ user, onLogout }) {
  const navigate = useNavigate();
  const [showFinanceMenu, setShowFinanceMenu] = useState(false);
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [brevoLists, setBrevoLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  
  const [config, setConfig] = useState({
    api_key: '',
    list_id: '',
    sales_page_url: ''
  });
  
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowFinanceMenu(false);
      setShowSystemMenu(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/brevo-config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setConfig(response.data);
      setApiKeyConfigured(response.data.api_key_configured || false);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrevoLists = async () => {
    if (!apiKeyConfigured) {
      setError('Configure a API Key do Brevo primeiro');
      return;
    }

    setLoadingLists(true);
    setError('');
    try {
      const response = await axios.get(`${API}/admin/brevo-lists`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBrevoLists(response.data.lists || []);
      setSuccess('Listas carregadas com sucesso!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao carregar listas do Brevo');
    } finally {
      setLoadingLists(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${API}/admin/brevo-config`, config, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSuccess('Configurações salvas com sucesso!');
      // Marca como configurada apenas se a API key não estiver vazia
      setApiKeyConfigured(config.api_key && config.api_key.trim() !== '');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400 mt-4">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Configurações de Leads</h1>
          <p className="text-gray-400">Configure as opções de captura e gestão de leads</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Mail size={20} />
              Configuração do Brevo
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  API Key do Brevo
                </label>
                <input
                  type="password"
                  value={config.api_key}
                      onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder={apiKeyConfigured ? "API Key configurada (digite nova para alterar)" : "xkeysib-..."}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Obtenha sua API Key em: 
                  <a 
                    href="https://app.brevo.com/settings/keys/api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 ml-1 inline-flex items-center gap-1"
                  >
                    Brevo Dashboard <ExternalLink size={12} />
                  </a>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-200">
                    Lista do Brevo
                  </label>
                  <button
                    type="button"
                    onClick={fetchBrevoLists}
                    disabled={loadingLists || !apiKeyConfigured}
                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <RefreshCw size={14} className={loadingLists ? 'animate-spin' : ''} />
                    Carregar Listas
                  </button>
                </div>
                <select
                  value={config.list_id}
                      onChange={(e) => setConfig({ ...config, list_id: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Selecione uma lista</option>
                  {brevoLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.totalSubscribers} contatos)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Os leads capturados serão adicionados à lista selecionada
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <ExternalLink size={20} />
              Página de Vendas
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                URL da Página de Vendas
              </label>
              <input
                type="url"
                value={config.sales_page_url}
                onChange={(e) => setConfig({ ...config, sales_page_url: e.target.value })}
                className="w-full bg-black/30 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="https://exemplo.com/vendas"
              />
              <p className="text-xs text-gray-500 mt-1">
                Os leads serão redirecionados para esta página após o cadastro
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white py-3 px-6 rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 shadow-[0_12px_30px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save size={20} />
                Salvar Configurações
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}