import React from 'react';
import { useNavigate } from 'react-router-dom';

function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
        {/* Cancelled Icon */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        {/* Cancelled Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Pagamento Cancelado
        </h1>
        <p className="text-gray-400 mb-8">
          Você cancelou o pagamento. Não se preocupe, você pode tentar novamente quando quiser.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentCancelled;
