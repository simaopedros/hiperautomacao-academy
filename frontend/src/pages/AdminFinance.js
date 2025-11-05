import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, DollarSign, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminNavigation from '../components/AdminNavigation';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function AdminFinance({ user, onLogout }) {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState(null);
  const [billings, setBillings] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, billingsRes, usersRes] = await Promise.all([
        axios.get(`${API}/api/admin/statistics`, { headers }),
        axios.get(`${API}/api/admin/billings`, { headers }),
        axios.get(`${API}/api/admin/users`, { headers })
      ]);

      setStatistics(statsRes.data);
      setBillings(billingsRes.data.billings);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (billingId) => {
    if (!confirm('Tem certeza que deseja marcar este pagamento como PAGO? Esta ação irá processar a matrícula.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/admin/billings/${billingId}/mark-paid`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('✅ ' + response.data.message);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert(error.response?.data?.detail || 'Erro ao confirmar pagamento');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Gestão Financeira</h1>
          <p className="text-gray-400">Relatórios e controle de pagamentos</p>
        </div>

        {/* Tabs */}
        <div className="bg-[#111111] border border-[#252525] rounded-lg mb-8">
          <div className="px-6">
            <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('billings')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'billings'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Compras ({billings.length})
            </button>
          </div>
        </div>
      </div>
      </main>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && statistics && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Receita Total</p>
                  <DollarSign className="text-emerald-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(statistics.revenue?.total_brl || 0)}
                </p>
              </div>

              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Compras Pagas</p>
                  <CreditCard className="text-blue-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.billings?.paid || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {statistics.billings?.pending || 0} pendentes
                </p>
              </div>

              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Total de Usuários</p>
                  <Users className="text-purple-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.users?.total || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billings Tab */}
        {activeTab === 'billings' && (
          <div className="bg-[#111111] rounded-lg border border-[#252525] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252525]">
                  {billings.map((billing) => (
                    <tr key={billing.billing_id} className="hover:bg-[#1a1a1a]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(billing.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{billing.user_name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{billing.user_email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {billing.course_id ? 'Curso direto' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {formatCurrency(billing.amount_brl || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            billing.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                          }`}
                        >
                          {billing.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {billing.billing_id ? billing.billing_id.substring(0, 20) + '...' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {billing.status === 'pending' ? (
                          <button
                            onClick={() => handleMarkPaid(billing.billing_id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                          >
                            Confirmar Pagamento
                          </button>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
