import { useState } from 'react';
import axios from 'axios';
import { User, Mail, Phone, ArrowRight, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LeadCapture({ onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API}/leads/capture`, formData);
      setSuccess(true);
      
      // Buscar URL da página de vendas e redirecionar após 2 segundos
      setTimeout(async () => {
        try {
          const response = await axios.get(`${API}/leads/sales-page-url`);
          window.location.href = response.data.url;
        } catch (err) {
          // Fallback para URL padrão se não conseguir buscar
          window.location.href = 'https://exemplo.com/vendas';
        }
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar inscrição');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-emerald-300" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-3">Inscrição realizada!</h3>
        <p className="text-gray-300 mb-4">
          Obrigado pelo seu interesse! Você será redirecionado em instantes.
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold text-white mb-2">Quero me inscrever</h3>
        <p className="text-gray-300 text-sm">
          Preencha seus dados e receba mais informações sobre nossos cursos
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="lead-name" className="block text-sm font-medium text-gray-200 mb-2">
            Nome completo
          </label>
          <div className="relative">
            <User size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="lead-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-black/30 border border-white/10 text-white py-3 pl-11 pr-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Seu nome completo"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-email" className="block text-sm font-medium text-gray-200 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="lead-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-black/30 border border-white/10 text-white py-3 pl-11 pr-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="seu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-whatsapp" className="block text-sm font-medium text-gray-200 mb-2">
            WhatsApp
          </label>
          <div className="relative">
            <Phone size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="lead-whatsapp"
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              className="w-full bg-black/30 border border-white/10 text-white py-3 pl-11 pr-4 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="(11) 99999-9999"
              required
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white py-3 px-6 rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 shadow-[0_12px_30px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Processando...
            </>
          ) : (
            <>
              Quero me inscrever
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}