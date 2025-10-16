import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, LogOut, MessageCircle, Play, Clock, Coins, History } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StudentDashboard({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCredits, setUserCredits] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
    fetchCredits();
  }, []);

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCredits(response.data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const handleRefreshCredits = async () => {
    await fetchCredits();
  };

  const checkPendingPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const billingId = localStorage.getItem('last_billing_id');
      
      if (!billingId) {
        alert('Nenhum pagamento pendente encontrado');
        return;
      }

      const response = await axios.get(
        `${API}/billing/${billingId}/check-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status === 'paid') {
        alert('✅ Pagamento confirmado! Seus créditos foram adicionados.');
        localStorage.removeItem('last_billing_id');
        await fetchCredits();
      } else {
        alert('⏳ Pagamento ainda não foi confirmado. Por favor, aguarde ou tente novamente em alguns minutos.');
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      alert('Erro ao verificar pagamento. Tente novamente.');
    }
  };

  const handleEnrollWithCredits = async (courseId, priceCredits) => {
    if (!userCredits || userCredits.balance < priceCredits) {
      alert(`Você precisa de ${priceCredits} créditos para se matricular neste curso. Seu saldo: ${userCredits?.balance || 0}`);
      navigate('/buy-credits');
      return;
    }

    if (!confirm(`Deseja se matricular neste curso usando ${priceCredits} créditos?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/courses/${courseId}/enroll-with-credits`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('✅ Matrícula realizada com sucesso!');
      fetchCourses();
      fetchCredits();
    } catch (error) {
      console.error('Error enrolling:', error);
      alert(error.response?.data?.detail || 'Erro ao se matricular');
    }
  };

  const handleBuyCourse = async (courseId, courseName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/billing/create`,
        {
          course_id: courseId,
          customer_name: user.name,
          customer_email: user.email
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Save billing ID for status checking
      localStorage.setItem('last_billing_id', response.data.billing_id);

      // Redirect to payment URL
      window.location.href = response.data.payment_url;
    } catch (error) {
      console.error('Error creating billing:', error);
      alert(error.response?.data?.detail || 'Erro ao criar pagamento');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold gradient-text">Hiperautomação</h1>
            <nav className="flex gap-6">
              <button
                data-testid="courses-nav"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-emerald-400 font-medium"
              >
                <BookOpen size={20} />
                Meus Cursos
              </button>
              <button
                data-testid="social-nav"
                onClick={() => navigate('/social')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <MessageCircle size={20} />
                Social
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Bem-vindo,</p>
              <p className="font-semibold text-white">{user.name}</p>
            </div>
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={20} className="text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Credits Banner */}
      {userCredits && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 border-b border-emerald-500">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="bg-white/20 p-4 rounded-xl">
                  <Coins size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm mb-1">Seu Saldo de Créditos</p>
                  <p className="text-4xl font-bold text-white">{userCredits.balance}</p>
                  <p className="text-emerald-100 text-sm mt-1">créditos disponíveis</p>
                </div>
                <button
                  onClick={handleRefreshCredits}
                  className="ml-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                  title="Atualizar saldo"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={checkPendingPayments}
                  className="flex items-center gap-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verificar Pagamento
                </button>
                <button
                  onClick={() => navigate('/credit-history')}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <History size={18} />
                  Histórico
                </button>
                <button
                  onClick={() => navigate('/buy-credits')}
                  className="flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-600 px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Coins size={18} />
                  Comprar Créditos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-3">Cursos Disponíveis</h2>
          <p className="text-gray-400 text-lg">Escolha um curso e comece a aprender agora</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-gray-400 mt-4">Carregando cursos...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhum curso disponível no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <div
                key={course.id}
                data-testid={`course-card-${course.id}`}
                className="card cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/course/${course.id}`)}
              >
                {/* Course Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center relative overflow-hidden">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Play size={64} className="text-white/70" />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                </div>

                {/* Course Info */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    {course.category && (
                      <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                        {course.category}
                      </span>
                    )}
                    {course.price_credits > 0 && !course.is_enrolled && (
                      <div className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Coins size={16} />
                        <span>{course.price_credits}</span>
                      </div>
                    )}
                    {course.is_enrolled && (
                      <span className="inline-block bg-blue-500/10 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Matriculado
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                    {course.description}
                  </p>
                  
                  {/* Action Buttons */}
                  {course.is_enrolled ? (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock size={16} />
                        <span>Continuar</span>
                      </div>
                      <button
                        className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/course/${course.id}`);
                        }}
                      >
                        Acessar →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {course.price_credits > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnrollWithCredits(course.id, course.price_credits);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <Coins size={16} />
                          Matricular ({course.price_credits} créditos)
                        </button>
                      )}
                      {course.price_brl > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyCourse(course.id);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                        >
                          Comprar por R$ {course.price_brl.toFixed(2)}
                        </button>
                      )}
                      {(!course.price_credits || course.price_credits === 0) && (!course.price_brl || course.price_brl === 0) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/course/${course.id}`);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                        >
                          Ver Curso Gratuito
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}