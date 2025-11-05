import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useI18n } from '../hooks/useI18n';
import LottieAnimation from '@/components/animations/LottieAnimation';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function PaymentSuccess() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState(t('payment.verifyButton'));

  const checkPaymentStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const billingId = localStorage.getItem('last_billing_id');
      
      if (!billingId) {
        setMessage(t('common.returningToDashboard'));
        setChecking(false);
        return;
      }

      setMessage(t('common.checkingPaymentStatus'));

      // Check payment status
      const response = await axios.get(
        `${API}/api/billing/${billingId}/check-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.status === 'paid') {
        setMessage('✅ ' + response.data.message);
        setChecking(false);
        localStorage.removeItem('last_billing_id');
      } else {
        setMessage(t('payment.pending'));
        setChecking(false);
      }
    } catch (error) {
      console.error('Error in checkPaymentStatus:', error);
      setMessage(t('payment.verifyButton'));
      setChecking(false);
    }
  }, [t]);

  useEffect(() => {
    checkPaymentStatus(); // eslint-disable-line react-hooks/set-state-in-effect
    
    // Redirect to dashboard after 10 seconds
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate, checkPaymentStatus]);



  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          {checking ? (
            <LottieAnimation src="/lottie/checking.json" loop autoplay className="w-24 h-24 mx-auto" />
          ) : (
            <LottieAnimation src="/lottie/success.json" loop={false} autoplay className="w-24 h-24 mx-auto" />
          )}
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          {checking ? 'Processando...' : 'Concluído!'}
        </h1>
        <p className="text-gray-400 mb-4">
          {message}
        </p>

        {/* Action Buttons */}
        {!checking && (
          <div className="space-y-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Ir para o Dashboard
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
