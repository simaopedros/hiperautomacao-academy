import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function CreditHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCredits, setUserCredits] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch balance
      const creditsResponse = await axios.get(`${API}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCredits(creditsResponse.data);

      // Fetch transactions
      const transactionsResponse = await axios.get(`${API}/api/credits/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactionsResponse.data.transactions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'earned':
        return '🎁';
      case 'purchased':
        return '💳';
      case 'spent':
        return '📚';
      case 'refund':
        return '↩️';
      default:
        return '📝';
    }
  };

  const getTransactionColor = (amount) => {
    return amount > 0 ? 'text-emerald-400' : 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-3 sm:mb-4 text-emerald-400 hover:text-emerald-300 flex items-center gap-2 text-sm sm:text-base"
          >
            ← Voltar ao Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Histórico de Créditos</h1>
          <p className="text-gray-400 text-sm sm:text-base">Acompanhe todas as suas transações de créditos</p>
        </div>

        {/* Balance Card */}
        {userCredits && (
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 sm:p-8 mb-6 sm:mb-8 text-white">
            <div className="grid grid-cols-3 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="text-center md:text-left">
                <p className="text-emerald-100 mb-1 sm:mb-2 text-xs sm:text-sm">Saldo Atual</p>
                <p className="text-2xl sm:text-4xl lg:text-5xl font-bold">{userCredits.balance}</p>
                <p className="text-emerald-100 mt-1 text-xs sm:text-sm">créditos</p>
              </div>
              <div className="text-center">
                <p className="text-emerald-100 mb-1 sm:mb-2 text-xs sm:text-sm">Total Ganho</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{userCredits.total_earned}</p>
                <p className="text-emerald-100 mt-1 text-xs sm:text-sm">créditos</p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-emerald-100 mb-1 sm:mb-2 text-xs sm:text-sm">Total Gasto</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{userCredits.total_spent}</p>
                <p className="text-emerald-100 mt-1 text-xs sm:text-sm">créditos</p>
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Transações</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <p className="text-gray-400 text-lg">Nenhuma transação encontrada</p>
              <p className="text-gray-500 mt-2">Suas transações de créditos aparecerão aqui</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 sm:p-6 hover:bg-gray-750 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="text-xl sm:text-3xl flex-shrink-0">{getTransactionIcon(transaction.transaction_type)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold mb-1 text-sm sm:text-base line-clamp-2">
                          {transaction.description}
                        </h3>
                        <p className="text-gray-400 text-xs sm:text-sm mb-2">
                          {formatDate(transaction.created_at)}
                        </p>
                        <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                          {transaction.transaction_type === 'earned' && 'Ganho'}
                          {transaction.transaction_type === 'purchased' && 'Comprado'}
                          {transaction.transaction_type === 'spent' && 'Gasto'}
                          {transaction.transaction_type === 'refund' && 'Reembolso'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg sm:text-2xl font-bold ${getTransactionColor(transaction.amount)}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                      </p>
                      <p className="text-gray-500 text-xs sm:text-sm">créditos</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3">💡 Dica</h3>
          <p className="text-gray-400 text-sm">
            Você pode ganhar créditos grátis participando ativamente da comunidade! 
            Crie discussões, comente em posts, complete cursos e convide amigos para ganhar mais créditos.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CreditHistory;
