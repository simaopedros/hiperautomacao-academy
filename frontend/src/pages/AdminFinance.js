import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, DollarSign, CreditCard, TrendingUp, Users, Coins } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function AdminFinance({ user, onLogout }) {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState(null);
  const [billings, setBillings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAddCreditsDialog, setShowAddCreditsDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsDescription, setCreditsDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, billingsRes, transactionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/api/admin/statistics`, { headers }),
        axios.get(`${API}/api/admin/billings`, { headers }),
        axios.get(`${API}/api/admin/credits/transactions`, { headers }),
        axios.get(`${API}/api/admin/users`, { headers })
      ]);

      setStatistics(statsRes.data);
      setBillings(billingsRes.data.billings);
      setTransactions(transactionsRes.data.transactions);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/admin/credits/add-manual`,
        null,
        {
          params: {
            user_id: selectedUser,
            amount: parseInt(creditsAmount),
            description: creditsDescription
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert('Créditos adicionados com sucesso!');
      setShowAddCreditsDialog(false);
      setSelectedUser('');
      setCreditsAmount('');
      setCreditsDescription('');
      fetchData();
    } catch (error) {
      console.error('Error adding credits:', error);
      alert(error.response?.data?.detail || 'Erro ao adicionar créditos');
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
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-2xl font-bold text-white">Gestão Financeira</h1>
            </div>
            <Button
              onClick={() => setShowAddCreditsDialog(true)}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Coins size={18} className="mr-2" />
              Adicionar Créditos
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#111111] border-b border-[#252525]">
        <div className="max-w-7xl mx-auto px-6">
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
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Transações ({transactions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
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
                  {formatCurrency(statistics.revenue.total_brl)}
                </p>
              </div>

              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Compras Pagas</p>
                  <CreditCard className="text-blue-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.billings.paid}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {statistics.billings.pending} pendentes
                </p>
              </div>

              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Créditos Distribuídos</p>
                  <Coins className="text-yellow-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.credits.total_distributed}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {statistics.credits.total_spent} gastos
                </p>
              </div>

              <div className="bg-[#111111] rounded-lg p-6 border border-[#252525]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400">Total de Usuários</p>
                  <Users className="text-purple-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.users.total}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252525]">
                  {billings.map((billing) => (
                    <tr key={billing.billing_id} className="hover:bg-[#1a1a1a]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(billing.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{billing.user_name}</div>
                        <div className="text-xs text-gray-500">{billing.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {billing.credits ? `${billing.credits} créditos` : 'Curso direto'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {formatCurrency(billing.amount_brl)}
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
                        {billing.billing_id.substring(0, 20)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
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
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Créditos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252525]">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-[#1a1a1a]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{transaction.user_name}</div>
                        <div className="text-xs text-gray-500">{transaction.user_email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">
                          {transaction.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span
                          className={
                            transaction.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {transaction.amount > 0 ? '+' : ''}
                          {transaction.amount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Credits Dialog */}
      <Dialog open={showAddCreditsDialog} onOpenChange={setShowAddCreditsDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Créditos Manualmente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCredits} className="space-y-4">
            <div>
              <Label className="text-gray-300">Usuário</Label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
                className="w-full bg-[#111111] border-[#2a2a2a] text-white rounded-md px-3 py-2"
              >
                <option value="">Selecione um usuário</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-gray-300">Quantidade de Créditos</Label>
              <Input
                type="number"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                required
                min="1"
                className="bg-[#111111] border-[#2a2a2a] text-white"
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <Label className="text-gray-300">Descrição</Label>
              <Input
                value={creditsDescription}
                onChange={(e) => setCreditsDescription(e.target.value)}
                required
                className="bg-[#111111] border-[#2a2a2a] text-white"
                placeholder="Ex: Bônus de boas-vindas"
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
              Adicionar Créditos
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
