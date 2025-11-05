import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Plus, Edit, Trash2 } from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SubscriptionPlansAdmin({ user, onLogout }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_brl: 0,
    duration_days: 30,
    is_active: true,
    // Stripe
    stripe_price_id: '',
    stripe_product_id: '',
    // Access scope
    access_scope: 'full',
    course_ids: '' // comma-separated IDs
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/subscription-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        course_ids: (formData.course_ids || '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };
      if (editingPlan) {
        await axios.put(`${API}/admin/subscription-plans/${editingPlan.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API}/admin/subscription-plans`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setShowDialog(false);
      setEditingPlan(null);
      setFormData({ name: '', description: '', price_brl: 0, duration_days: 30, is_active: true, stripe_price_id: '', stripe_product_id: '', access_scope: 'full', course_ids: '' });
      fetchPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert(error.response?.data?.detail || 'Erro ao salvar plano');
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_brl: plan.price_brl || 0,
      duration_days: plan.duration_days || 30,
      is_active: !!plan.is_active,
      stripe_price_id: plan.stripe_price_id || '',
      stripe_product_id: plan.stripe_product_id || '',
      access_scope: plan.access_scope || 'full',
      course_ids: (plan.course_ids || []).join(',')
    });
    setShowDialog(true);
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Tem certeza que deseja excluir este plano?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/subscription-plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert(error.response?.data?.detail || 'Erro ao excluir plano');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Planos & Preços</h1>
          <p className="text-gray-400">Gerencie os planos de assinatura da plataforma</p>
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Gerenciar Planos de Assinatura</h2>
          <button
            onClick={() => {
              setEditingPlan(null);
              setFormData({
                name: '',
                description: '',
                price_brl: 0,
                duration_days: 30,
                is_active: true,
                                        // Stripe
                stripe_price_id: '',
                stripe_product_id: '',
                // Access scope
                access_scope: 'full',
                course_ids: ''
              });
              setShowDialog(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
          >
            <Plus size={18} /> Novo Plano
          </button>
        </div>

        {loading ? (
          <div className="text-emerald-400">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${plan.is_active ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-emerald-400 text-3xl font-bold">R$ {Number(plan.price_brl).toFixed(2)}</p>
                  <p className="text-gray-400 text-sm">Acesso por {plan.duration_days} dias</p>
                  {(() => {
                    const months = Math.max(1, Math.round(Number(plan.duration_days) / 30));
                    const monthly = Number(plan.price_brl) / months;
                    return (
                      <>
                        <p className="text-gray-300 text-sm">Equivale a R$ {monthly.toFixed(2)}/mês</p>
                        <p className="text-gray-500 text-xs">Total do período: R$ {Number(plan.price_brl).toFixed(2)} ({months} mês{months > 1 ? 'es' : ''})</p>
                      </>
                    );
                  })()}
                  {(() => {
                    // Economia vs plano mensal (se existir)
                    const months = Math.max(1, Math.round(Number(plan.duration_days) / 30));
                    // baseline: menor duração (idealmente 1 mês) do conjunto atual
                    const baselinePlan = plans.reduce((acc, p) => {
                      const m = Math.max(1, Math.round(Number(p.duration_days) / 30));
                      if (!acc) return { plan: p, months: m };
                      return m < acc.months ? { plan: p, months: m } : acc;
                    }, null);
                    if (!baselinePlan) return null;
                    const baseMonthly = Number(baselinePlan.plan.price_brl) / baselinePlan.months; // preço por mês do plano de menor duração
                    const baselineTotalForThisPeriod = baseMonthly * months; // pagar mensal por 'months' meses
                    const savings = baselineTotalForThisPeriod - Number(plan.price_brl);
                    const pct = baselineTotalForThisPeriod > 0 ? (savings / baselineTotalForThisPeriod) * 100 : 0;
                    return savings > 0 ? (
                      <p className="text-emerald-400 text-xs">Economize R$ {savings.toFixed(2)} ({pct.toFixed(0)}%) vs mensal</p>
                    ) : null;
                  })()}
                </div>
              
              {(plan.stripe_price_id || plan.stripe_product_id) && (
                <div className="pt-2 mt-2 border-t border-[#2a2a2a] text-xs text-gray-400 space-y-1">
                  {plan.stripe_price_id && <p>Stripe Price ID: {plan.stripe_price_id}</p>}
                  {plan.stripe_product_id && <p>Stripe Product ID: {plan.stripe_product_id}</p>}
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-[#2a2a2a] text-xs text-gray-400 space-y-1">
                <p>Escopo de acesso: {plan.access_scope === 'specific' ? 'Cursos específicos' : 'Toda a plataforma'}</p>
                {plan.access_scope === 'specific' && (
                  <p className="truncate">Cursos: {(plan.course_ids || []).join(', ') || '-'}</p>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
                  >
                    <Edit size={16} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showDialog && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl w-full sm:max-w-xl md:max-w-2xl p-6 shadow-xl max-h-[85vh] overflow-y-auto">
              <h3 className="sticky top-0 bg-[#121212] text-white text-lg font-semibold -mt-2 pt-2 pb-3 mb-4 border-b border-[#2a2a2a] z-10">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm">Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-300 text-sm">Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_brl}
                      onChange={(e) => setFormData({ ...formData, price_brl: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm">Duração (dias)</label>
                    <input
                      type="number"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-300 text-sm">Stripe Price ID</label>
                    <input
                      type="text"
                      value={formData.stripe_price_id}
                      onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                      placeholder="price_..."
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm">Stripe Product ID</label>
                    <input
                      type="text"
                      value={formData.stripe_product_id}
                      onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                      placeholder="prod_..."
                    />
                  </div>
                </div>
                <div className="border-t border-[#2a2a2a] pt-4">
                  <label className="text-gray-300 text-sm">Escopo de acesso</label>
                  <div className="mt-2 flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="access_scope"
                        value="full"
                        checked={formData.access_scope === 'full'}
                        onChange={(e) => setFormData({ ...formData, access_scope: e.target.value })}
                      />
                      <span className="text-gray-300 text-sm">Toda a plataforma</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="access_scope"
                        value="specific"
                        checked={formData.access_scope === 'specific'}
                        onChange={(e) => setFormData({ ...formData, access_scope: e.target.value })}
                      />
                      <span className="text-gray-300 text-sm">Cursos específicos</span>
                    </label>
                  </div>
                  {formData.access_scope === 'specific' && (
                    <div className="mt-3">
                      <label className="text-gray-300 text-sm">IDs dos cursos (separados por vírgula)</label>
                      <input
                        type="text"
                        value={formData.course_ids}
                        onChange={(e) => setFormData({ ...formData, course_ids: e.target.value })}
                        className="mt-1 w-full px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                        placeholder="curso1,curso2,curso3"
                      />
                      <p className="text-xs text-gray-500 mt-1">Os alunos terão acesso somente aos cursos listados.</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="text-gray-300 text-sm">Ativo</label>
                </div>
                <div className="sticky bottom-0 bg-[#121212] border-t border-[#2a2a2a] pt-3 flex justify-end gap-3 mt-4 z-10">
                  <button type="button" className="px-4 py-2 rounded bg-gray-800 text-gray-200" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
