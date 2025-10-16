import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Mail, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EmailSettings({ user, onLogout }) {
  const [config, setConfig] = useState({
    brevo_api_key: '',
    sender_email: '',
    sender_name: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/email-config`, {
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
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/email-config`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className=\"min-h-screen bg-[#0a0a0a]\">
      {/* Header */}
      <header className=\"bg-[#111111] border-b border-[#252525] sticky top-0 z-50\">
        <div className=\"max-w-7xl mx-auto px-6 py-4 flex items-center justify-between\">
          <div className=\"flex items-center gap-4\">
            <Button
              variant=\"ghost\"
              onClick={() => navigate('/admin')}
              className=\"text-gray-400 hover:text-white\"
            >
              <ArrowLeft size={20} className=\"mr-2\" />
              Voltar
            </Button>
            <div>
              <h1 className=\"text-xl font-bold text-white\">Configurações de Email</h1>
              <p className=\"text-sm text-gray-400\">Configure o envio de emails via Brevo</p>
            </div>
          </div>
        </div>
      </header>

      <main className=\"max-w-4xl mx-auto px-6 py-12\">
        {/* Instructions Card */}
        <div className=\"bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8\">
          <div className=\"flex items-start gap-4\">
            <AlertCircle className=\"text-cyan-400 flex-shrink-0\" size={24} />
            <div>
              <h3 className=\"text-lg font-semibold text-white mb-2\">Como configurar o Brevo</h3>
              <ol className=\"text-gray-300 space-y-2 text-sm\">
                <li>1. Acesse <a href=\"https://app.brevo.com\" target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-cyan-400 hover:underline\">app.brevo.com</a> e crie uma conta (gratuita)</li>
                <li>2. Vá em <strong>SMTP & API</strong> no menu lateral</li>
                <li>3. Clique em <strong>API Keys</strong> e depois em <strong>Create a new API key</strong></li>
                <li>4. Dê um nome (ex: \"Hiperautomação\") e copie a chave gerada</li>
                <li>5. Em <strong>Senders</strong>, adicione e verifique seu email remetente</li>
                <li>6. Cole as informações nos campos abaixo</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className=\"bg-[#1a1a1a] border border-[#252525] rounded-xl p-8\">
          <div className=\"flex items-center gap-3 mb-6\">
            <Mail className=\"text-emerald-400\" size={28} />
            <h2 className=\"text-2xl font-bold text-white\">Configuração Brevo</h2>
          </div>

          {loading ? (
            <div className=\"text-center py-12\">
              <div className=\"inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent\"></div>
            </div>
          ) : (
            <form onSubmit={handleSave} className=\"space-y-6\">
              <div>
                <Label htmlFor=\"api_key\" className=\"text-white\">API Key do Brevo *</Label>
                <Input
                  id=\"api_key\"
                  type=\"text\"
                  value={config.brevo_api_key}
                  onChange={(e) => setConfig({ ...config, brevo_api_key: e.target.value })}
                  placeholder=\"xkeysib-...\"
                  className=\"bg-[#111111] border-[#2a2a2a] text-white mt-2\"
                  required
                />
                <p className=\"text-xs text-gray-500 mt-1\">Cole a API key gerada no Brevo</p>
              </div>

              <div>
                <Label htmlFor=\"sender_email\" className=\"text-white\">Email Remetente *</Label>
                <Input
                  id=\"sender_email\"
                  type=\"email\"
                  value={config.sender_email}
                  onChange={(e) => setConfig({ ...config, sender_email: e.target.value })}
                  placeholder=\"noreply@seudominio.com\"
                  className=\"bg-[#111111] border-[#2a2a2a] text-white mt-2\"
                  required
                />
                <p className=\"text-xs text-gray-500 mt-1\">Email verificado no Brevo</p>
              </div>

              <div>
                <Label htmlFor=\"sender_name\" className=\"text-white\">Nome do Remetente *</Label>
                <Input
                  id=\"sender_name\"
                  type=\"text\"
                  value={config.sender_name}
                  onChange={(e) => setConfig({ ...config, sender_name: e.target.value })}
                  placeholder=\"Hiperautomação\"
                  className=\"bg-[#111111] border-[#2a2a2a] text-white mt-2\"
                  required
                />
                <p className=\"text-xs text-gray-500 mt-1\">Nome que aparecerá nos emails</p>
              </div>

              {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                  <span>{message.text}</span>
                </div>
              )}

              <Button
                type=\"submit\"
                disabled={saving}
                className=\"w-full bg-emerald-500 hover:bg-emerald-600 py-6\"
              >
                <Save size={20} className=\"mr-2\" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </form>
          )}
        </div>

        {/* Testing Section */}
        <div className=\"bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 mt-6\">
          <h3 className=\"text-lg font-semibold text-white mb-3\">Testar Configuração</h3>
          <p className=\"text-gray-400 text-sm mb-4\">
            Após salvar as configurações, você pode testá-las fazendo uma importação em massa de usuários na área de Gerenciar Usuários.
          </p>
          <Button
            onClick={() => navigate('/admin/users')}
            variant=\"outline\"
            className=\"border-[#2a2a2a] hover:bg-[#252525]\"
          >
            Ir para Gerenciar Usuários
          </Button>
        </div>
      </main>
    </div>
  );
}
