import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [credits, setCredits] = useState(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Verificando pagamento...');

  useEffect(() => {
    checkPaymentStatus();
    
    // Redirect to dashboard after 10 seconds
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const checkPaymentStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const billingId = localStorage.getItem('last_billing_id');
      
      if (!billingId) {
        setMessage('Retornando ao dashboard...');
        setChecking(false);
        await fetchCredits();
        return;
      }

      setMessage('Verificando status do pagamento...');

      // Check payment status
      const response = await axios.get(
        `${API}/api/billing/${billingId}/check-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.status === 'paid') {
        setMessage('✅ ' + response.data.message);
        setChecking(false);
        await fetchCredits();
        localStorage.removeItem('last_billing_id');
      } else {
        setMessage('⏳ Pagamento pendente. Clique em "Verificar Pagamento" no dashboard para confirmar.');
        setChecking(false);
        await fetchCredits();
      }
    } catch (error) {
      console.error('Error in checkPaymentStatus:', error);
      setMessage('Use o botão "Verificar Pagamento" no dashboard para confirmar.');
      setChecking(false);
      await fetchCredits();
    }
  };

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredits(response.data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          {checking ? (
            <div className="mx-auto w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          {checking ? 'Processando...' : 'Concluído!'}
        </h1>
        <p className="text-gray-400 mb-4">
          {message}
        </p>

        {/* Credits Display */}
        {credits && !checking && (
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg p-6 mb-8">
            <p className="text-emerald-100 text-sm mb-2">Seu Saldo Atual</p>
            <p className="text-5xl font-bold text-white mb-1">{credits.balance}</p>
            <p className="text-emerald-100 text-sm">créditos disponíveis</p>
          </div>
        )}

        {/* Action Buttons */}
        {!checking && (
          <div className="space-y-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Ir para o Dashboard
            </button>
            <button
              onClick={() => navigate('/buy-credits')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Comprar Mais Créditos
            </button>
          </div>
        )}

        <p className="text-gray-500 text-sm mt-6">
          {checking ? 'Aguarde...' : 'Redirecionando automaticamente em 10 segundos...'}
        </p>
      </div>
    </div>
  );
}

export default PaymentSuccess;
