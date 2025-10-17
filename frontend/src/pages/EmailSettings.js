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
    brevo_smtp_key: '',
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
      console.error('Error:', error);
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
      setMessage({ type: 'success', text: 'Configurações salvas!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft size={20} className="mr-2" />Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-2">Como configurar Brevo</h3>
          <ol className="text-gray-300 space-y-1 text-sm">
            <li>1. Acesse app.brevo.com e crie conta gratuita</li>
            <li>2. Vá em SMTP & API - API Keys</li>
            <li>3. Crie nova API key e copie</li>
            <li>4. Em Senders, adicione seu email remetente</li>
            <li>5. Cole as informações abaixo</li>
          </ol>
        </div>

        <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Configuração Email</h2>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label>API Key Brevo (Para importação CSV)</Label>
              <Input
                value={config.brevo_api_key}
                onChange={(e) => setConfig({...config, brevo_api_key: e.target.value})}
                className="bg-[#111111] border-[#2a2a2a] text-white mt-2"
                placeholder="xkeysib-..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">Usada para envio em massa via API</p>
            </div>

            <div>
              <Label>SMTP Key Brevo (Para emails transacionais)</Label>
              <Input
                value={config.brevo_smtp_key || ''}
                onChange={(e) => setConfig({...config, brevo_smtp_key: e.target.value})}
                className="bg-[#111111] border-[#2a2a2a] text-white mt-2"
                placeholder="Gerar em SMTP & API → SMTP Keys"
              />
              <p className="text-xs text-gray-500 mt-1">
                <a href="https://app.brevo.com/settings/keys/smtp" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  Gerar SMTP Key no Brevo →
                </a>
              </p>
            </div>

            <div>
              <Label>Email Remetente</Label>
              <Input
                type="email"
                value={config.sender_email}
                onChange={(e) => setConfig({...config, sender_email: e.target.value})}
                className="bg-[#111111] border-[#2a2a2a] text-white mt-2"
                required
              />
            </div>

            <div>
              <Label>Nome Remetente</Label>
              <Input
                value={config.sender_name}
                onChange={(e) => setConfig({...config, sender_name: e.target.value})}
                className="bg-[#111111] border-[#2a2a2a] text-white mt-2"
                required
              />
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}