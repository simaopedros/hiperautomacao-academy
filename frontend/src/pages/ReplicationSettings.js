import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminNavigation from '../components/AdminNavigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ReplicationSettings({ user, onLogout }) {
  const [form, setForm] = useState({
    mongo_url: '',
    db_name: '',
    username: '',
    password: '',
    replication_enabled: false,
  });
  const [testing, setTesting] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/replication/status`, { headers });
      setStatus(res.data);
    } catch (err) {
      console.error('Erro ao obter status da replicação:', err);
    }
  }, [headers]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/replication/logs?limit=200`, { headers });
      setLogs(res.data?.logs || []);
    } catch (err) {
      console.error('Erro ao obter logs de replicação:', err);
    }
  }, [headers]);

  const fetchSavedConfig = useCallback(async () => {
    // Status endpoint informa se está configurado; mantemos o form independente
    await fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchSavedConfig(), fetchLogs()]);
      setLoading(false);
    })();
  }, [fetchSavedConfig, fetchLogs]);

  const updateField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API}/admin/replication/test`, form, { headers });
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ ok: false, message: err.response?.data?.detail || err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await axios.post(
        `${API}/admin/replication/config`,
        form,
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
      await fetchStatus();
      alert(res.data?.message || 'Configuração salva');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar configuração');
    }
  };

  const handleFullBackup = async () => {
    setBackupLoading(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API}/admin/replication/backup`, null, { headers });
      setTestResult({ ok: res.data?.ok, message: res.data?.message });
      await refreshAll();
    } catch (err) {
      setTestResult({ ok: false, message: err.response?.data?.detail || err.message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      const res = await axios.post(`${API}/admin/replication/toggle?enable=${!status?.replication_enabled}`, null, { headers });
      await fetchStatus();
      alert(`Replicação ${res.data.replication_enabled ? 'ativada' : 'desativada'}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao alternar replicação');
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchStatus(), fetchLogs()]);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <AdminNavigation user={user} onLogout={onLogout} />
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Database size={24} className="text-emerald-400" />
          <h2 className="text-2xl font-bold">Replicação de Backup MongoDB</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#121212] border border-[#242424] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Configuração</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mongo_url">MongoDB URL</Label>
                <Input id="mongo_url" name="mongo_url" value={form.mongo_url} onChange={updateField} placeholder="mongodb://host:port" />
              </div>
              <div>
                <Label htmlFor="db_name">Nome do Banco</Label>
                <Input id="db_name" name="db_name" value={form.db_name} onChange={updateField} placeholder="ex: academy_backup" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Usuário</Label>
                  <Input id="username" name="username" value={form.username} onChange={updateField} placeholder="opcional" />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" value={form.password} onChange={updateField} placeholder="opcional" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input id="replication_enabled" name="replication_enabled" type="checkbox" checked={form.replication_enabled} onChange={updateField} />
                <Label htmlFor="replication_enabled">Ativar replicação após salvar</Label>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                  {testing ? 'Testando...' : 'Testar Conexão'}
                </Button>
                <Button onClick={handleSaveConfig}>Salvar Configuração</Button>
                <Button onClick={handleFullBackup} disabled={!status?.configured || backupLoading}>
                  {backupLoading ? 'Fazendo Backup...' : 'Fazer Backup'}
                </Button>
              </div>
              {testResult && (
                <div className={`mt-3 flex items-center gap-2 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#121212] border border-[#242424] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Status & Estatísticas</h3>
              <Button variant="outline" onClick={refreshAll}><RefreshCw size={16} className="mr-2" /> Atualizar</Button>
            </div>
            {!status ? (
              <p className="text-gray-400">Carregando status...</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p><strong>Status:</strong> {status.replication_enabled ? 'Ativado' : 'Desativado'}</p>
                <p><strong>Configuração:</strong> {status.configured ? 'Configurada' : 'Não configurada'}</p>
                <p><strong>Fila:</strong> {status.queue_size} operações pendentes</p>
                <p><strong>Enfileiradas:</strong> {status.stats?.enqueued}</p>
                <p><strong>Processadas:</strong> {status.stats?.processed}</p>
                <p><strong>Erros:</strong> {status.stats?.errors}</p>
                {status.stats?.last_error && (
                  <p className="text-red-400"><strong>Último erro:</strong> {status.stats.last_error}</p>
                )}
              </div>
            )}
            <div className="mt-4">
              <Button variant="secondary" onClick={handleToggle} disabled={!status || !status.configured}>
                {status?.replication_enabled ? 'Desativar Replicação' : 'Ativar Replicação'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-[#121212] border border-[#242424] rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Histórico de Operações Replicadas</h3>
            <Button variant="outline" onClick={fetchLogs}><RefreshCw size={16} className="mr-2" /> Atualizar</Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-gray-400">Sem registros ainda.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto text-sm bg-[#0d0d0d] p-3 rounded-md border border-[#1f1f1f]">
              {logs.map((line, idx) => (
                <div key={idx} className="text-gray-300 font-mono whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}