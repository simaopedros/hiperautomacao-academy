import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '@/components/AdminNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, RefreshCw, Activity, Filter, ChevronDown, ChevronRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function WebhookMonitor({ user, onLogout }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(2000);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});
  const timerRef = useRef(null);

  const fetchEvents = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/admin/webhooks/stripe/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data?.events || []);
    } catch (e) {
      console.error('Erro buscando eventos do Stripe:', e);
      setError(e.response?.data?.detail || 'Falha ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchEvents, refreshMs);
      return () => clearInterval(timerRef.current);
    }
    return undefined;
  }, [autoRefresh, refreshMs]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => (showErrorsOnly ? ev.stage === 'error' : true));
  }, [events, showErrorsOnly]);

  const stageColor = (stage) => {
    switch (stage) {
      case 'received':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'verified':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'processed':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatJson = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') {
      try {
        return JSON.stringify(JSON.parse(obj), null, 2);
      } catch (err) {
        return obj;
      }
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch (err) {
      return String(obj);
    }
  };

  const toggleExpanded = (key) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderRow = (ev, idx) => {
    const key = `${ev.event_id || ev.type || 'noid'}-${idx}`;
    const isExpanded = !!expandedEvents[key];
    const payloadJson = formatJson(ev.payload_json);
    const payloadRaw = !payloadJson && ev.payload_raw ? ev.payload_raw : null;
    const dataObject = formatJson(ev.data_object);
    const metadataJson = formatJson(ev.metadata);

    return (
      <div key={key} className="border-b border-[#1f1f1f]">
        <div
          className="grid grid-cols-12 items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer"
          onClick={() => toggleExpanded(key)}
        >
          <div className={`col-span-2 inline-flex items-center px-2 py-1 rounded border ${stageColor(ev.stage)}`}>
            <Activity size={16} className="mr-2" />
            <span className="text-xs font-semibold uppercase">{ev.stage || 'n/a'}</span>
          </div>
          <div className="col-span-3">
            <div className="text-white text-sm font-mono">{ev.type || '—'}</div>
            <div className="text-xs text-gray-400 font-mono">{ev.event_id || 'sem id'}</div>
          </div>
          <div className="col-span-3">
            <div className="text-xs text-gray-300">{new Date(ev.timestamp || Date.now()).toLocaleString()}</div>
            {typeof ev.livemode !== 'undefined' && (
              <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded border ${ev.livemode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}`}>
                {ev.livemode ? 'live' : 'test'}
              </span>
            )}
          </div>
          <div className="col-span-2">
            {typeof ev.payload_size !== 'undefined' && (
              <div className="text-xs text-gray-400">Payload: {ev.payload_size} bytes</div>
            )}
            {ev.result && (
              <div className="text-xs text-gray-300">Resultado: {ev.result}</div>
            )}
          </div>
          <div className="col-span-1 text-right">
            {ev.error ? (
              <div className="text-xs text-red-300">Erro: {ev.error}</div>
            ) : (
              <div className="text-xs text-gray-500">—</div>
            )}
          </div>
          <div className="col-span-1 flex justify-end text-gray-300">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        {isExpanded && (
          <div className="px-4 pb-4 bg-[#0f0f0f] text-xs text-gray-200 space-y-4">
            {payloadJson && (
              <div>
                <div className="text-[11px] uppercase text-gray-400 mb-1">Payload completo</div>
                <pre className="whitespace-pre-wrap bg-black/40 border border-[#1f1f1f] rounded p-3 overflow-x-auto">{payloadJson}</pre>
              </div>
            )}
            {payloadRaw && (
              <div>
                <div className="text-[11px] uppercase text-gray-400 mb-1">Payload bruto</div>
                <pre className="whitespace-pre-wrap bg-black/40 border border-[#1f1f1f] rounded p-3 overflow-x-auto">{payloadRaw}</pre>
              </div>
            )}
            {dataObject && (
              <div>
                <div className="text-[11px] uppercase text-gray-400 mb-1">Objeto (data.object)</div>
                <pre className="whitespace-pre-wrap bg-black/40 border border-[#1f1f1f] rounded p-3 overflow-x-auto">{dataObject}</pre>
              </div>
            )}
            {metadataJson && (
              <div>
                <div className="text-[11px] uppercase text-gray-400 mb-1">Metadata processada</div>
                <pre className="whitespace-pre-wrap bg-black/40 border border-[#1f1f1f] rounded p-3 overflow-x-auto">{metadataJson}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Carregando eventos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Monitor de Webhooks (Stripe)</h1>
            <p className="text-gray-400">Acompanhe eventos em tempo quase real, com logs e erros</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchEvents} className="bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw size={16} className="mr-2" /> Atualizar agora
            </Button>
            <Button onClick={() => navigate('/admin/payment-settings')} className="bg-gray-700 hover:bg-gray-600">
              Configurações
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-200">{error}</div>
          </div>
        )}

        <div className="bg-[#111111] rounded-lg border border-[#252525] p-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-gray-200">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Atualização automática
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-gray-300">Intervalo (ms)</Label>
              <Input
                type="number"
                value={refreshMs}
                min={500}
                step={500}
                onChange={(e) => setRefreshMs(Number(e.target.value) || 2000)}
                className="w-28 bg-[#0a0a0a] border-[#2a2a2a] text-white"
              />
            </div>
            <label className="flex items-center gap-2 text-gray-200">
              <input type="checkbox" checked={showErrorsOnly} onChange={(e) => setShowErrorsOnly(e.target.checked)} />
              <Filter size={16} /> Mostrar apenas erros
            </label>
          </div>

          <div className="rounded-lg overflow-hidden border border-[#1f1f1f]">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[#0e0e0e] border-b border-[#1f1f1f] text-xs text-gray-400">
              <div className="col-span-2">Etapa</div>
              <div className="col-span-3">Tipo / Evento</div>
              <div className="col-span-3">Horário / Modo</div>
              <div className="col-span-2">Detalhes</div>
              <div className="col-span-1">Erro</div>
              <div className="col-span-1 text-right">Expandir</div>
            </div>
            <div className="divide-y divide-[#1f1f1f]">
              {filteredEvents.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400">Nenhum evento registrado ainda.</div>
              ) : (
                filteredEvents.map(renderRow)
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
