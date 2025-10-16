import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function CreditPackagesConfig({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/credit-packages-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPackages(response.data.packages || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageChange = (index, field, value) => {
    const updated = [...packages];
    updated[index][field] = value;
    setPackages(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/admin/credit-packages-config`,
        { packages },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Configurações de pacotes salvas com sucesso!');
    } catch (error) {
      console.error('Error saving packages:', error);
      alert(error.response?.data?.detail || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
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
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <Package className="text-emerald-400" size={24} />
              <h1 className="text-2xl font-bold text-white">Pacotes de Créditos</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <h2 className="text-xl font-bold text-white mb-6">Configurar IDs Hotmart dos Pacotes</h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Importante:</strong> Configure o ID do produto na Hotmart para cada pacote de créditos. 
                Quando uma venda for realizada pela Hotmart, o sistema identificará o pacote e adicionará os créditos automaticamente.
              </p>
            </div>

            {packages.map((pkg, index) => (
              <div key={pkg.id} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{pkg.name}</h3>
                    <p className="text-gray-400 text-sm">
                      R$ {pkg.price_brl.toFixed(2)} • {pkg.credits} créditos
                      {pkg.bonus_percentage > 0 && ` • +${pkg.bonus_percentage}% bônus`}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300">ID do Produto na Hotmart</Label>
                  <Input
                    type="text"
                    value={pkg.hotmart_product_id || ''}
                    onChange={(e) => handlePackageChange(index, 'hotmart_product_id', e.target.value)}
                    placeholder="Ex: 6315704"
                    className="bg-[#111111] border-[#2a2a2a] text-white"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Deixe em branco se não vender este pacote pela Hotmart
                  </p>
                </div>

                <div>
                  <Label className="text-gray-300">URL do Checkout Hotmart</Label>
                  <Input
                    type="url"
                    value={pkg.hotmart_checkout_url || ''}
                    onChange={(e) => handlePackageChange(index, 'hotmart_checkout_url', e.target.value)}
                    placeholder="https://pay.hotmart.com/..."
                    className="bg-[#111111] border-[#2a2a2a] text-white"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Link do checkout da Hotmart para este pacote
                  </p>
                </div>
              </div>
            ))}

            {/* Save Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                <Save size={18} className="mr-2" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
              <Button
                type="button"
                onClick={() => navigate('/admin')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
