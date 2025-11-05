import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Save,
  Video,
  HardDrive,
  Shield,
  CheckCircle,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const initialConfig = {
  stream_library_id: '',
  stream_api_key: '',
  stream_collection_id: '',
  stream_player_domain: '',
  storage_zone_name: '',
  storage_api_key: '',
  storage_base_url: '',
  storage_directory: '',
  storage_host: '',
  default_upload_prefix: 'uploads'
};

export default function BunnySettings({ user, onLogout }) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/admin/media/bunny/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConfig({ ...initialConfig, ...response.data });
      } catch (error) {
        console.error('Erro ao carregar configuração do Bunny:', error);
        setMessage({ type: 'error', text: 'Não foi possível carregar as configurações atuais.' });
      }
    };

    fetchConfig();
  }, []);

  const handleChange = (field) => (event) => {
    setConfig((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/media/bunny/config`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações do Bunny:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Falha ao salvar configurações. Verifique os dados e tente novamente.'
      });
    } finally {
      setSaving(false);
    }
  };

  const streamConfigured = Boolean(config.stream_library_id && config.stream_api_key);
  const storageConfigured = Boolean(config.storage_zone_name && config.storage_api_key);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-[#141414]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Integração Bunny (Vídeos & Arquivos)</h1>
            <p className="text-gray-400">
              Configure as credenciais da Bunny.net para habilitar upload direto de vídeo aulas e materiais (PDF, slides, etc).
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="flex items-center gap-3 text-emerald-200 mb-3">
              <Video size={20} />
              <strong>Stream</strong>
              {streamConfigured ? (
                <span className="flex items-center gap-1 text-xs text-emerald-200 bg-emerald-500/20 px-2 py-1 rounded-full">
                  <CheckCircle size={12} />
                  Ativo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-200 bg-yellow-500/10 px-2 py-1 rounded-full">
                  <AlertCircle size={12} />
                  Incompleto
                </span>
              )}
            </div>
            <p className="text-sm text-emerald-100/80 leading-relaxed">
              Permite enviar vídeo aulas diretamente para a Bunny Stream. O embed é gerado automaticamente e aplicado nas lições.
            </p>
          </div>

          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6">
            <div className="flex items-center gap-3 text-blue-200 mb-3">
              <HardDrive size={20} />
              <strong>Storage</strong>
              {storageConfigured ? (
                <span className="flex items-center gap-1 text-xs text-blue-100 bg-blue-500/20 px-2 py-1 rounded-full">
                  <CheckCircle size={12} />
                  Ativo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-100 bg-yellow-500/10 px-2 py-1 rounded-full">
                  <AlertCircle size={12} />
                  Incompleto
                </span>
              )}
            </div>
            <p className="text-sm text-blue-100/80 leading-relaxed">
              Use uma Storage Zone para hospedar PDFs, planilhas e outros materiais. Depois do upload, o link é aplicado automaticamente na aula.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="rounded-2xl border border-[#1f2a2e] bg-[#12171a] p-8 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <UploadCloud className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">Credenciais Stream</h2>
                <p className="text-sm text-gray-400">Library ID e API Key disponíveis em Bunny.net → Stream → Library Settings.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-gray-300">Library ID</Label>
                <Input
                  value={config.stream_library_id || ''}
                  onChange={handleChange('stream_library_id')}
                  placeholder="Ex: 12345"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">API Key</Label>
                <Input
                  value={config.stream_api_key || ''}
                  onChange={handleChange('stream_api_key')}
                  placeholder="AccessKey da Bunny Stream"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                  type="password"
                />
              </div>
              <div>
                <Label className="text-gray-300">Collection ID (opcional)</Label>
                <Input
                  value={config.stream_collection_id || ''}
                  onChange={handleChange('stream_collection_id')}
                  placeholder="Coleção padrão para uploads"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Domínio personalizado do player (opcional)</Label>
                <Input
                  value={config.stream_player_domain || ''}
                  onChange={handleChange('stream_player_domain')}
                  placeholder="https://player.seudominio.com"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use se você configurou um domínio próprio para o player. Caso contrário, usaremos iframe.mediadelivery.net.
                </p>
              </div>
            </div>
          </section>

            <section className="rounded-2xl border border-[#1f2530] bg-[#11171f] p-8 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full bg-blue-500/20 p-3">
                <Shield className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">Storage Zone</h2>
                <p className="text-sm text-gray-400">
                  Acesse Bunny.net → Storage → selecione sua zone para obter o nome e o Access Key.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-gray-300">Storage Zone</Label>
                <Input
                  value={config.storage_zone_name || ''}
                  onChange={handleChange('storage_zone_name')}
                  placeholder="ex: hiperautomacao-files"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Storage Access Key</Label>
                <Input
                  value={config.storage_api_key || ''}
                  onChange={handleChange('storage_api_key')}
                  placeholder="Chave da Storage Zone"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                  type="password"
                />
              </div>
              <div>
                <Label className="text-gray-300">CDN Base URL (opcional)</Label>
                <Input
                  value={config.storage_base_url || ''}
                  onChange={handleChange('storage_base_url')}
                  placeholder="https://arquivos.seudominio.com"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Informe um Pull Zone/Custom Domain para gerar o link público. Deixe vazio para usar {`https://{zone}.b-cdn.net`}.
                </p>
              </div>
              <div>
                <Label className="text-gray-300">Host da Storage (opcional)</Label>
                <Input
                  value={config.storage_host || ''}
                  onChange={handleChange('storage_host')}
                  placeholder="ex: br.storage.bunnycdn.com"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Utilize o host regional informado na Bunny (ex.: <code className="text-xs">br.storage.bunnycdn.com</code>) se quiser enviar direto para uma região específica.
                </p>
              </div>
              <div>
                <Label className="text-gray-300">Pasta padrão (opcional)</Label>
                <Input
                  value={config.storage_directory || ''}
                  onChange={handleChange('storage_directory')}
                  placeholder="ex: materiais"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Prefixo para uploads</Label>
                <Input
                  value={config.default_upload_prefix || 'uploads'}
                  onChange={handleChange('default_upload_prefix')}
                  placeholder="uploads"
                  className="mt-2 bg-[#0f1114] border-[#1f2a2e] text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Será utilizado quando nenhum diretório for informado na hora do upload.
                </p>
              </div>
            </div>
          </section>

          {message && (
            <div
              className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/40 bg-red-500/10 text-red-200'
              }`}
            >
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold py-6 text-lg"
          >
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </form>
      </main>
    </div>
  );
}
