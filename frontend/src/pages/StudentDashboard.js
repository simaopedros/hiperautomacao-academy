import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  LogOut,
  MessageCircle,
  Play,
  Clock,
  Coins,
  History,
  Gift,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StudentDashboard({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCredits, setUserCredits] = useState(null);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [supportConfig, setSupportConfig] = useState(null);
  const [showInsights, setShowInsights] = useState(() => {
    const stored = localStorage.getItem('dashboard_insights_visible');
    return stored !== null ? stored === 'true' : true;
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
    fetchCredits();
    fetchGatewayConfig();
    fetchSupportConfig();
  }, []);

  const fetchGatewayConfig = async () => {
    try {
      const response = await axios.get(`${API}/gateway/active`);
      setGatewayConfig(response.data);
    } catch (error) {
      console.error('Error fetching gateway config:', error);
      setGatewayConfig({ active_gateway: 'abacatepay' });
    }
  };

  const fetchSupportConfig = async () => {
    try {
      const response = await axios.get(`${API}/support/config`);
      setSupportConfig(response.data);
    } catch (error) {
      console.error('Error fetching support config:', error);
      setSupportConfig({
        support_url: process.env.REACT_APP_DEFAULT_SUPPORT_URL || 'https://wa.me/5511999999999',
        support_text: 'Suporte',
      });
    }
  };

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/courses`, {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserCredits(response.data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const handleRefreshCredits = async () => {
    await fetchCredits();
  };

  const handleEnrollWithCredits = async (courseId, priceCredits) => {
    if (!userCredits || userCredits.balance < priceCredits) {
      alert(`Voce precisa de ${priceCredits} creditos para se matricular neste curso. Seu saldo: ${userCredits?.balance || 0}`);
      navigate('/buy-credits');
      return;
    }

    if (!window.confirm(`Deseja se matricular neste curso usando ${priceCredits} creditos?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/courses/${courseId}/enroll-with-credits`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Matricula realizada com sucesso!');
      fetchCourses();
      fetchCredits();
    } catch (error) {
      console.error('Error enrolling:', error);
      alert(error.response?.data?.detail || 'Erro ao se matricular');
    }
  };

  const handleBuyCourse = async (courseId) => {
    if (gatewayConfig?.active_gateway === 'hotmart') {
      const course = courses.find((c) => c.id === courseId);
      if (course?.hotmart_checkout_url) {
        window.location.href = course.hotmart_checkout_url;
        return;
      }

      alert('Link de checkout da Hotmart nao configurado para este curso');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/billing/create`,
        {
          course_id: courseId,
          customer_name: user.name,
          customer_email: user.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem('last_billing_id', response.data.billing_id);
      window.location.href = response.data.payment_url;
    } catch (error) {
      console.error('Error creating billing:', error);
      alert(error.response?.data?.detail || 'Erro ao criar pagamento');
    }
  };

  const enrolledCourses = courses.filter((course) => course.is_enrolled).length;
  const availableCourses = courses.length;
  const pendingCourses = courses.filter((course) => !course.is_enrolled).length;
  const creditsBalance = userCredits?.balance ?? 0;

  useEffect(() => {
    localStorage.setItem('dashboard_insights_visible', showInsights.toString());
  }, [showInsights]);

  return (
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-blue-500/15 blur-[130px] pointer-events-none" />

      <header className="relative z-20 border-b border-white/10 bg-black/30/70 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold gradient-text">Hiperautomacao</h1>
              <nav className="hidden md:flex gap-3 text-sm">
                <button
                  data-testid="courses-nav"
                  onClick={() => navigate('/dashboard')}
                  className="chip bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                >
                  <BookOpen size={16} />
                  Meus cursos
                </button>
                <button
                  data-testid="social-nav"
                  onClick={() => navigate('/social')}
                  className="chip border-white/15 text-gray-300 hover:text-white"
                >
                  <MessageCircle size={16} />
                  Social
                </button>
                <button
                  onClick={() => navigate('/referral')}
                  className="chip border-white/15 text-gray-300 hover:text-white"
                >
                  <Gift size={16} />
                  Indicações
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <button
                onClick={() => setShowInsights((prev) => !prev)}
                className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {showInsights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showInsights ? 'Ocultar visão geral' : 'Mostrar visão geral'}
              </button>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-400">Bem-vindo</p>
                <p className="font-semibold text-white">{user.name}</p>
              </div>
              <button
                data-testid="logout-button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Sair"
              >
                <LogOut size={18} className="text-gray-200" />
              </button>
            </div>
          </div>

          <nav className="flex md:hidden gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="chip bg-emerald-500/10 border-emerald-400/30 text-emerald-200 whitespace-nowrap"
            >
              <BookOpen size={14} />
              Cursos
            </button>
            <button
              onClick={() => navigate('/social')}
              className="chip border-white/15 text-gray-200 whitespace-nowrap"
            >
              <MessageCircle size={14} />
              Social
            </button>
            <button
              onClick={() => navigate('/referral')}
              className="chip border-white/15 text-gray-200 whitespace-nowrap"
            >
              <Gift size={14} />
              Indicações
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-10">
        {showInsights ? (
        <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-6">
          <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200 mb-3">Sua jornada</p>
            <h2 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
              Continue evoluindo com novos cursos e desafios práticos.
            </h2>
            <p className="text-gray-300 text-sm sm:text-base max-w-2xl">
              Acesse conteúdos atualizados, participe da comunidade e troque créditos por experiências premium.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm text-gray-400 mb-1">Cursos ativos</p>
                <p className="text-3xl font-semibold">{enrolledCourses}</p>
                <span className="text-xs text-gray-500">{pendingCourses} aguardando você</span>
              </div>
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm text-gray-400 mb-1">Catálogo</p>
                <p className="text-3xl font-semibold">{availableCourses}</p>
                <span className="text-xs text-gray-500">Novos cursos chegam todo mês</span>
              </div>
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm text-gray-400 mb-1">Créditos</p>
                <p className="text-3xl font-semibold text-emerald-300">{creditsBalance}</p>
                <span className="text-xs text-gray-500">Atualize para sincronizar</span>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
            {userCredits && (
              <div className="glass-panel rounded-3xl border border-white/10 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Saldo disponível</p>
                    <p className="text-3xl font-semibold text-emerald-300">{creditsBalance} créditos</p>
                  </div>
                  <button
                    onClick={handleRefreshCredits}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    title="Atualizar saldo"
                  >
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/credit-history')}
                    className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                  >
                    <History size={16} />
                    Histórico
                  </button>
                  <button
                    onClick={() => navigate('/referral')}
                    className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                  >
                    <Gift size={16} />
                    Indicar amigos
                  </button>
                  {supportConfig && (
                    <button
                      onClick={() => window.open(supportConfig.support_url, '_blank')}
                      className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                    >
                      <MessageCircle size={16} />
                      {supportConfig.support_text}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="glass-panel rounded-3xl border border-white/10 p-6 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Atalhos</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/social')}
                  className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} />
                  Comunidade
                </button>
                <button
                  onClick={() => navigate('/referral')}
                  className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                >
                  <Gift size={16} />
                  Recompensas
                </button>
              </div>
            </div>
          </div>
        </section>
        ) : (
          <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Visão geral oculta</p>
              <h3 className="text-2xl font-semibold mt-2">Informações escondidas</h3>
              <p className="text-gray-400 text-sm max-w-xl">
                Reexiba seus indicadores e atalhos para acompanhar créditos, cursos ativos e acessos rápidos.
              </p>
            </div>
            <button
              onClick={() => setShowInsights(true)}
              className="btn-primary whitespace-nowrap flex items-center gap-2 px-5 py-3"
            >
              <ChevronDown size={16} />
              Mostrar visão geral
            </button>
          </div>
        )}

        <section className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Catálogo</p>
            <h3 className="text-3xl font-semibold mt-2">Cursos disponíveis</h3>
            <p className="text-gray-400 text-sm max-w-2xl">
              Explore conteúdos e utilize seus créditos ou formas de pagamento integradas para desbloquear novas trilhas.
            </p>
          </div>

        {loading ? (
          <div className="text-center py-12 sm:py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-emerald-500 border-t-transparent" />
            <p className="text-gray-400 mt-4 text-sm sm:text-base">Carregando cursos...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <BookOpen size={48} className="sm:w-16 sm:h-16 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-base sm:text-lg">Nenhum curso disponível no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, index) => (
              <div
                key={course.id}
                data-testid={`course-card-${course.id}`}
                className="glass-panel rounded-3xl border border-white/10 cursor-pointer animate-fade-in transition-transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 0.08}s` }}
                onClick={() => navigate(`/course/${course.id}`)}
              >
                <div className="aspect-video bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center relative overflow-hidden rounded-2xl">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <Play size={56} className="text-white/70" />
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {course.category && (
                      <span className="inline-block bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full">
                        {course.category}
                      </span>
                    )}
                    {course.price_credits > 0 && !course.is_enrolled && (
                      <div className="flex items-center gap-1 text-emerald-300 font-semibold text-sm">
                        <Coins size={14} />
                        <span>{course.price_credits}</span>
                      </div>
                    )}
                    {course.is_enrolled && (
                      <span className="inline-block bg-blue-500/10 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full">
                        ✔ Matriculado
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold line-clamp-2">{course.title}</h3>
                  <p className="text-gray-400 text-sm line-clamp-3">{course.description}</p>

                  {course.is_enrolled ? (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock size={14} />
                        <span>Continuar</span>
                      </div>
                      <button
                        className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors"
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
                          className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm"
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
                          className="w-full btn-secondary py-3 text-sm"
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
                          className="w-full btn-primary py-3 text-sm"
                        >
                          Ver curso gratuito
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      </main>
    </div>
  );
}

