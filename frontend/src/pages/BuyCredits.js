import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function BuyCredits() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userCredits, setUserCredits] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPackages();
    fetchUserData();
    fetchCredits();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await axios.get(`${API}/api/credits/packages`);
      setPackages(response.data.packages);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCredits(response.data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const handleBuyPackage = async (packageId) => {
    if (!currentUser) {
      alert('Você precisa estar logado para comprar créditos');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/billing/create`,
        {
          package_id: packageId,
          customer_name: currentUser.name,
          customer_email: currentUser.email
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Save billing ID for status checking
      localStorage.setItem('last_billing_id', response.data.billing_id);

      // Redirect to payment URL with billing_id as query param
      const paymentUrl = new URL(response.data.payment_url);
      window.location.href = paymentUrl.toString();
    } catch (error) {
      console.error('Error creating billing:', error);
      alert(error.response?.data?.detail || 'Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 text-emerald-400 hover:text-emerald-300 flex items-center gap-2 mx-auto"
          >
            ← Voltar
          </button>
          <h1 className="text-4xl font-bold text-white mb-4">Comprar Créditos</h1>
          <p className="text-gray-400 text-lg">
            Escolha o melhor pacote para você e tenha acesso a todos os cursos da plataforma
          </p>
        </div>

        {/* Current Balance */}
        {userCredits && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 text-center">
            <p className="text-gray-400 mb-2">Seu Saldo Atual</p>
            <p className="text-5xl font-bold text-emerald-400">{userCredits.balance}</p>
            <p className="text-gray-500 mt-2">créditos disponíveis</p>
          </div>
        )}

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packages.map((pkg, index) => (
            <div
              key={pkg.id}
              className={`relative bg-gray-800 rounded-xl p-8 border-2 ${
                index === 1
                  ? 'border-emerald-500 transform scale-105'
                  : 'border-gray-700'
              }`}
            >
              {/* Popular Badge */}
              {index === 1 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    MAIS POPULAR
                  </span>
                </div>
              )}

              {/* Package Name */}
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                {pkg.name}
              </h3>

              {/* Price */}
              <div className="text-center mb-6">
                <p className="text-5xl font-bold text-emerald-400 mb-2">
                  R$ {pkg.price_brl.toFixed(2)}
                </p>
                <p className="text-gray-400 text-sm">pagamento único</p>
              </div>

              {/* Credits */}
              <div className="bg-gray-900 rounded-lg p-4 mb-6 text-center">
                <p className="text-3xl font-bold text-white mb-1">
                  {pkg.credits}
                </p>
                <p className="text-gray-400 text-sm">créditos</p>
                {pkg.bonus_percentage > 0 && (
                  <p className="text-emerald-400 text-sm mt-2 font-semibold">
                    +{pkg.bonus_percentage}% de bônus!
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 text-emerald-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Acesso a todos os cursos
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 text-emerald-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Sem prazo de validade
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 text-emerald-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Suporte prioritário
                </li>
              </ul>

              {/* Buy Button */}
              <button
                onClick={() => handleBuyPackage(pkg.id)}
                disabled={loading}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  index === 1
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Processando...' : 'Comprar Agora'}
              </button>

              {/* Payment Methods */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Pagamento via:</p>
                <div className="flex justify-center gap-4">
                  <span className="text-xs text-gray-400 bg-gray-900 px-3 py-1 rounded">PIX</span>
                  <span className="text-xs text-gray-400 bg-gray-900 px-3 py-1 rounded">Cartão</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-gray-800 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-white mb-4">Como funciona?</h3>
          <div className="grid md:grid-cols-3 gap-6 text-gray-300">
            <div>
              <div className="text-emerald-400 text-3xl font-bold mb-2">1</div>
              <h4 className="font-semibold mb-2">Escolha seu pacote</h4>
              <p className="text-sm text-gray-400">
                Selecione o pacote que melhor se adequa às suas necessidades
              </p>
            </div>
            <div>
              <div className="text-emerald-400 text-3xl font-bold mb-2">2</div>
              <h4 className="font-semibold mb-2">Realize o pagamento</h4>
              <p className="text-sm text-gray-400">
                Pague com PIX ou cartão de crédito de forma rápida e segura
              </p>
            </div>
            <div>
              <div className="text-emerald-400 text-3xl font-bold mb-2">3</div>
              <h4 className="font-semibold mb-2">Use seus créditos</h4>
              <p className="text-sm text-gray-400">
                Matricule-se em qualquer curso usando seus créditos
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuyCredits;
