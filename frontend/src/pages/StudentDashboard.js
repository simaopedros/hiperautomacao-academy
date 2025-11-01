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
  DollarSign,
  ChevronUp,
  ChevronDown,
  Settings,
  Globe,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useI18n } from '../hooks/useI18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StudentDashboard({ user, onLogout }) {
  const { t, changeLanguage, getCurrentLanguage } = useI18n();
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [continueItems, setContinueItems] = useState([]);
  const [loadingContinue, setLoadingContinue] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [supportConfig, setSupportConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showInsights, setShowInsights] = useState(() => {
    const stored = localStorage.getItem('dashboard_insights_visible');
    return stored !== null ? stored === 'true' : true;
  });
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [userLanguage, setUserLanguage] = useState(user?.preferred_language || null);
  const [updatingLanguage, setUpdatingLanguage] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
    fetchGatewayConfig();
    fetchSupportConfig();
    fetchCategories();
  }, []);

  // Escutar mudanças no idioma
  useEffect(() => {
    const newLanguage = getCurrentLanguage();
    if (newLanguage !== currentLanguage) {
      setCurrentLanguage(newLanguage);
    }
  }, [getCurrentLanguage, currentLanguage]);

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

  const updateUserLanguage = async (language) => {
    setUpdatingLanguage(true);
    try {
      // Primeiro, atualizar o idioma da interface
      const interfaceLanguage = language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'pt-BR';
      
      // Usar o hook changeLanguage
      await changeLanguage(interfaceLanguage);
      
      // Atualizar o estado local para forçar re-render
      setCurrentLanguage(interfaceLanguage);
      
      // Atualizar a preferência do usuário no backend
      const token = localStorage.getItem('token');
      await axios.put(`${API}/auth/language`, 
        { language: language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setUserLanguage(language);
      // Refresh courses to apply language filter
      await fetchCourses();
      
    } catch (error) {
      console.error('Error updating language:', error);
      alert('Erro ao atualizar idioma. Tente novamente.');
    } finally {
      setUpdatingLanguage(false);
      setShowLanguageSettings(false);
    }
  };

  // Build "continue watching" items from enrolled courses and progress
  useEffect(() => {
    const buildContinueItems = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const accessibleCourses = courses.filter((c) => c.has_access || c.is_enrolled);
        if (!accessibleCourses.length) {
          setContinueItems([]);
          return;
        }
        setLoadingContinue(true);

        const headers = { Authorization: `Bearer ${token}` };
        const items = [];

        for (const course of accessibleCourses) {
          try {
            const [detailResp, progressResp] = await Promise.all([
              axios.get(`${API}/student/courses/${course.id}`, { headers }),
              axios.get(`${API}/progress/${course.id}`, { headers }),
            ]);

            const detail = detailResp.data;
            const modules = detail.modules || [];
            const lessonsOrdered = modules.flatMap((m) => m.lessons || []);
            if (!lessonsOrdered.length) continue;

            const progressList = (progressResp.data || []).slice().sort((a, b) => {
              const da = new Date(a.updated_at || 0).getTime();
              const db = new Date(b.updated_at || 0).getTime();
              return db - da;
            });

            let targetLessonId = null;
            let targetUpdatedAt = null;

            const lastNotCompleted = progressList.find((p) => !p.completed);
            if (lastNotCompleted) {
              targetLessonId = lastNotCompleted.lesson_id;
              targetUpdatedAt = lastNotCompleted.updated_at;
            } else if (progressList.length) {
              const last = progressList[0];
              const idx = lessonsOrdered.findIndex((l) => String(l.id) === String(last.lesson_id));
              if (idx >= 0 && idx + 1 < lessonsOrdered.length) {
                targetLessonId = lessonsOrdered[idx + 1].id;
              } else {
                targetLessonId = lessonsOrdered[Math.max(0, idx)].id;
              }
              targetUpdatedAt = last.updated_at;
            } else {
              targetLessonId = lessonsOrdered[0].id;
              targetUpdatedAt = detail.created_at || new Date().toISOString();
            }

            const targetLesson = lessonsOrdered.find((l) => String(l.id) === String(targetLessonId));
            if (!targetLesson) continue;
            let moduleTitle = '';
            for (const m of modules) {
              if ((m.lessons || []).some((l) => String(l.id) === String(targetLessonId))) {
                moduleTitle = m.title;
                break;
              }
            }

            items.push({
              courseId: course.id,
              courseTitle: detail.title,
              moduleTitle,
              lessonId: targetLesson.id,
              lessonTitle: targetLesson.title,
              updated_at: targetUpdatedAt,
              thumbnail_url: course.thumbnail_url,
            });
          } catch (err) {
            console.error('Error building continue item for course', course.id, err);
          }
        }

        items.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        setContinueItems(items.slice(0, 4));
      } catch (error) {
        console.error('Error building continue items:', error);
      } finally {
        setLoadingContinue(false);
      }
    };

    buildContinueItems();
  }, [courses]);

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

  useEffect(() => {
    localStorage.setItem('dashboard_insights_visible', showInsights.toString());
  }, [showInsights]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar categorias públicas', err);
    }
  };

  // Função para calcular categorias que possuem cursos
  const getCategoriesWithCourses = () => {
    const categoriesWithCourses = new Map();
    
    courses.forEach(course => {
      const courseCategories = course.categories || (course.category ? [course.category] : []);
      
      courseCategories.forEach(categoryId => {
        // Encontrar dados da categoria
        const categoryData = categories.find(c => c.id === categoryId || c.name === categoryId);
        if (categoryData) {
          const categoryName = categoryData.name;
          if (!categoriesWithCourses.has(categoryName)) {
            categoriesWithCourses.set(categoryName, {
              ...categoryData,
              courseCount: 0
            });
          }
          categoriesWithCourses.get(categoryName).courseCount++;
        }
      });
    });
    
    return Array.from(categoriesWithCourses.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

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
                  {t('dashboard.myCourses')}
                </button>
                <button
                  data-testid="social-nav"
                  onClick={() => navigate('/social')}
                  className="chip border-white/15 text-gray-300 hover:text-white"
                >
                  <MessageCircle size={16} />
                  {t('dashboard.social')}
                </button>
                <button
                  onClick={() => navigate('/subscribe')}
                  className="chip border-white/15 text-gray-300 hover:text-white"
                >
                  <DollarSign size={16} />
                  {t('dashboard.subscription')}
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
                <p className="text-xs text-gray-400">{t('dashboard.welcome')}</p>
                <p className="font-semibold text-white">{user.name}</p>
              </div>
              <button
                onClick={() => setShowLanguageSettings(true)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title={t('dashboard.languageSettings')}
              >
                <Globe size={18} className="text-gray-200" />
              </button>
              <button
                data-testid="logout-button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title={t('dashboard.logout')}
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
              onClick={() => navigate('/subscribe')}
              className="chip border-white/15 text-gray-200 whitespace-nowrap"
            >
              <DollarSign size={14} />
              Assinatura
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Continue Watching Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{t('dashboard.continue')}</p>
              <h3 className="text-3xl font-semibold mt-2">{t('dashboard.continueDescription')}</h3>
              <p className="text-gray-400 text-sm max-w-2xl">{t('dashboard.quickAccessLastLessons')}</p>
            </div>
          </div>

          {loadingContinue ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent" />
              <p className="text-gray-400 mt-3 text-sm">{t('dashboard.loadingLastLessons')}</p>
            </div>
          ) : continueItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-gray-400 text-sm">{t('dashboard.noCourseStarted')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {continueItems.map((item, index) => (
                <div
                  key={`${item.courseId}-${item.lessonId}`}
                  className="glass-panel rounded-3xl border border-white/10 cursor-pointer animate-fade-in transition-transform hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.06}s` }}
                  onClick={() => navigate(`/lesson/${item.lessonId}`)}
                >
                  <div className="aspect-video bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center relative overflow-hidden rounded-2xl">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.courseTitle} className="w-full h-full object-cover" />
                    ) : (
                      <Play size={48} className="text-white/80" />
                    )}
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-full">
                        <Play size={12} />
                        {t('dashboard.continueLesson')}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <p className="text-xs text-gray-400">{item.courseTitle} • {item.moduleTitle}</p>
                    <h4 className="text-base font-semibold line-clamp-2">{item.lessonTitle}</h4>
                    <button
                      className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/lesson/${item.lessonId}`);
                      }}
                    >
                      {t('dashboard.watchNow')} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showInsights ? (
        <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-6">
          <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200 mb-3">{t('dashboard.yourJourney')}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
              {t('dashboard.journeyDescription')}
            </h2>
            <p className="text-gray-300 text-sm sm:text-base max-w-2xl">
              {t('dashboard.journeySubDescription')}
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm text-gray-400 mb-1">{t('dashboard.activeCourses')}</p>
                <p className="text-3xl font-semibold">{enrolledCourses}</p>
                <span className="text-xs text-gray-500">{pendingCourses} {t('dashboard.waitingForYou')}</span>
              </div>
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm text-gray-400 mb-1">{t('dashboard.catalog')}</p>
                <p className="text-3xl font-semibold">{availableCourses}</p>
                <span className="text-xs text-gray-500">{t('dashboard.newCoursesMonthly')}</span>
              </div>

            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
            <div className="glass-panel rounded-3xl border border-white/10 p-6 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{t('dashboard.shortcuts')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/social')}
                  className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} />
                  {t('dashboard.community')}
                </button>
              </div>
            </div>
          </div>
        </section>
        ) : (
          <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{t('dashboard.overviewHidden')}</p>
              <h3 className="text-2xl font-semibold mt-2">{t('dashboard.informationHidden')}</h3>
              <p className="text-gray-400 text-sm max-w-xl">
                {t('dashboard.showOverviewDescription')}
              </p>
            </div>
            <button
              onClick={() => setShowInsights(true)}
              className="btn-primary whitespace-nowrap flex items-center gap-2 px-5 py-3"
            >
              <ChevronDown size={16} />
              {t('dashboard.showOverview')}
            </button>
          </div>
        )}

        <section className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{t('dashboard.catalog')}</p>
            <h3 className="text-3xl font-semibold mt-2">{t('dashboard.availableCourses')}</h3>
            <p className="text-gray-400 text-sm max-w-2xl">
              {t('dashboard.availableCoursesDescription')}
            </p>
          </div>

        {/* Categoria Filter - Melhorado */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-300">{t('dashboard.filterByCategory')}</h4>
            <span className="text-xs text-gray-500">
              {(() => {
                const categoriesWithCourses = getCategoriesWithCourses();
                return `${categoriesWithCourses.length} ${t('dashboard.categoriesAvailable')}`;
              })()}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Botão "Todas as Categorias" */}
            <button
              className={`group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedCategory === 'all' 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 border border-emerald-400/30 shadow-lg shadow-emerald-500/10' 
                  : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
              }`}
              onClick={() => setSelectedCategory('all')}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selectedCategory === 'all' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                <span>{t('dashboard.allCategories')}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedCategory === 'all' 
                    ? 'bg-emerald-400/20 text-emerald-300' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {courses.length}
                </span>
              </div>
              {selectedCategory === 'all' && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 animate-pulse" />
              )}
            </button>

            {/* Categorias com cursos */}
            {getCategoriesWithCourses().map((cat) => {
              const IconEl = Icons[cat.icon] || Icons.FolderOpen;
              const isActive = selectedCategory === cat.name;
              
              return (
                <button
                  key={cat.id}
                  className={`group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-300 border border-emerald-400/30 shadow-lg shadow-emerald-500/10'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  <div className="flex items-center gap-2">
                    <IconEl 
                      size={16} 
                      className={`${cat.color || (isActive ? 'text-emerald-400' : 'text-gray-400')} transition-colors`} 
                    />
                    <span className="truncate max-w-[120px]">{cat.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive 
                        ? 'bg-emerald-400/20 text-emerald-300' 
                        : 'bg-gray-500/20 text-gray-400 group-hover:bg-gray-400/20 group-hover:text-gray-300'
                    }`}>
                      {cat.courseCount}
                    </span>
                  </div>
                  
                  {/* Efeito hover */}
                  <div className={`absolute inset-0 rounded-xl transition-opacity duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 animate-pulse' 
                      : 'bg-gradient-to-r from-white/5 to-white/10 opacity-0 group-hover:opacity-100'
                  }`} />
                </button>
              );
            })}
          </div>
          
          {/* Indicador visual quando nenhuma categoria tem cursos */}
          {getCategoriesWithCourses().length === 0 && courses.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-400/20">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <p className="text-amber-300 text-sm">
                {t('dashboard.coursesWithoutCategories')}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 sm:py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-emerald-500 border-t-transparent" />
            <p className="text-gray-400 mt-4 text-sm sm:text-base">{t('dashboard.loadingCourses')}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <BookOpen size={48} className="sm:w-16 sm:h-16 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-base sm:text-lg">{t('dashboard.noCoursesAvailable')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(() => {
              // Group courses by category
              const groupedCourses = {};
              const filteredCourses = selectedCategory === 'all' ? courses : courses.filter(course => {
                const courseCategories = course.categories || (course.category ? [course.category] : []);
                return courseCategories.some(cat => {
                  // Check if category matches by name or ID
                  const catData = categories.find(c => c.name === cat) || categories.find(c => c.id === cat);
                  const categoryName = catData?.name || cat;
                  return categoryName === selectedCategory;
                });
              });

              filteredCourses.forEach(course => {
                const courseCategories = course.categories || (course.category ? [course.category] : []);
                
                // Filter only valid categories (that exist in the categories list)
                const validCategories = courseCategories.filter(category => {
                  const catData = categories.find(c => c.name === category) || categories.find(c => c.id === category);
                  return catData !== undefined;
                });
                
                // If no valid categories, assign to "Sem Categoria"
                const finalCategories = validCategories.length > 0 ? validCategories : [t('dashboard.noCategory')];
                
                finalCategories.forEach(category => {
                  // Find category data to get the proper name
                  const catData = categories.find(c => c.name === category) || categories.find(c => c.id === category);
                  const categoryName = catData?.name || category; // For "Sem Categoria", catData will be undefined
                  
                  if (!groupedCourses[categoryName]) {
                    groupedCourses[categoryName] = [];
                  }
                  if (!groupedCourses[categoryName].find(c => c.id === course.id)) {
                    groupedCourses[categoryName].push(course);
                  }
                });
              });

              // If filtering by specific category, show only that category
              if (selectedCategory !== 'all') {
                const categoryData = categories.find(cat => cat.name === selectedCategory);
                const CategoryIcon = categoryData?.icon ? Icons[categoryData.icon] : BookOpen;
                
                return (
                  <div key={selectedCategory}>
                    <div className="flex items-center gap-3 mb-6">
                      <CategoryIcon size={24} className="text-emerald-400" />
                      <h3 className="text-xl font-semibold text-white">{selectedCategory}</h3>
                      <span className="text-gray-400 text-sm">({groupedCourses[selectedCategory]?.length || 0} {t('dashboard.courses')})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {(groupedCourses[selectedCategory] || []).map((course, index) => (
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
                              {(() => {
                                const courseCategories = course.categories || (course.category ? [course.category] : []);
                                // Filter only valid categories
                                const validCategories = courseCategories.filter(cat => {
                                  const catData = categories.find(c => c.name === cat) || categories.find(c => c.id === cat);
                                  return catData !== undefined;
                                });
                                // If no valid categories, show "Sem Categoria"
                                const displayCategories = validCategories.length > 0 ? validCategories : [t('dashboard.noCategory')];
                                
                                return displayCategories.map((cat, idx) => {
                                  // Try to find category by name first, then by ID
                                  const catData = categories.find(c => c.name === cat) || categories.find(c => c.id === cat);
                                  const CatIcon = catData?.icon ? Icons[catData.icon] : BookOpen;
                                  const displayName = catData?.name || cat;
                                  return (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full">
                                      <CatIcon size={12} />
                                      {displayName}
                                    </span>
                                  );
                                });
                              })()}
                              {course.is_enrolled && (
                                <span className="inline-block bg-blue-500/10 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full">
                                  ✔ {t('dashboard.enrolled')}
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-semibold line-clamp-2">{course.title}</h3>
                            <p className="text-gray-400 text-sm line-clamp-3">{course.description}</p>

                            {course.is_enrolled ? (
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Clock size={14} />
                                  <span>{t('dashboard.continue')}</span>
                                </div>
                                <button
                                  className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/course/${course.id}`);
                                  }}
                                >
                                  {t('dashboard.access')} →
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {course.price_brl > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBuyCourse(course.id);
                                    }}
                                    className="w-full btn-secondary py-3 flex items-center justify-center gap-2 text-sm"
                                  >
                                    <DollarSign size={16} />
                                    {t('dashboard.buy')} (R$ {course.price_brl})
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // Show all categories when "Todas" is selected
              return Object.entries(groupedCourses).map(([categoryName, categoryCourses]) => {
                const categoryData = categories.find(cat => cat.name === categoryName);
                const CategoryIcon = categoryData?.icon ? Icons[categoryData.icon] : BookOpen;
                
                return (
                  <div key={categoryName}>
                    <div className="flex items-center gap-3 mb-6">
                      <CategoryIcon size={24} className="text-emerald-400" />
                      <h3 className="text-xl font-semibold text-white">{categoryName}</h3>
                      <span className="text-gray-400 text-sm">({categoryCourses.length} {t('dashboard.courses')})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {categoryCourses.map((course, index) => (
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
                              {(() => {
                                const courseCategories = course.categories || (course.category ? [course.category] : []);
                                // Filter only valid categories
                                const validCategories = courseCategories.filter(cat => {
                                  const catData = categories.find(c => c.name === cat) || categories.find(c => c.id === cat);
                                  return catData !== undefined;
                                });
                                // If no valid categories, show "Sem Categoria"
                                const displayCategories = validCategories.length > 0 ? validCategories : [t('dashboard.noCategory')];
                                
                                return displayCategories.map((cat, idx) => {
                                  // Try to find category by name first, then by ID
                                  const catData = categories.find(c => c.name === cat) || categories.find(c => c.id === cat);
                                  const CatIcon = catData?.icon ? Icons[catData.icon] : BookOpen;
                                  const displayName = catData?.name || cat;
                                  return (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full">
                                      <CatIcon size={12} />
                                      {displayName}
                                    </span>
                                  );
                                });
                              })()}
                              {course.is_enrolled && (
                                <span className="inline-block bg-blue-500/10 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full">
                                  ✔ {t('dashboard.enrolled')}
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-semibold line-clamp-2">{course.title}</h3>
                            <p className="text-gray-400 text-sm line-clamp-3">{course.description}</p>

                            {course.is_enrolled ? (
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Clock size={14} />
                                  <span>{t('dashboard.continue')}</span>
                                </div>
                                <button
                                  className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/course/${course.id}`);
                                  }}
                                >
                                  {t('dashboard.access')} →
                                </button>
                              </div>
                            ) : (
              <div className="space-y-2">
                {course.price_brl > 0 && (
                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBuyCourse(course.id);
                                    }}
                                    className="w-full btn-secondary py-3 flex items-center justify-center gap-2 text-sm"
                                  >
                                    <DollarSign size={16} />
                                    {t('dashboard.buy')} (R$ {course.price_brl})
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
        </section>
      </main>

      {/* Language Settings Modal */}
      {showLanguageSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl border border-white/10 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">{t('dashboard.languageSettings')}</h3>
              <button
                onClick={() => setShowLanguageSettings(false)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">
                {t('dashboard.selectLanguageDescription')}
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => updateUserLanguage(null)}
                  disabled={updatingLanguage}
                  className={`w-full p-3 rounded-xl border transition-colors text-left ${
                    userLanguage === null
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  } ${updatingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={20} />
                    <div>
                      <p className="font-medium">{t('dashboard.allLanguages')}</p>
                      <p className="text-xs text-gray-400">{t('dashboard.allLanguagesDescription')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => updateUserLanguage('pt')}
                  disabled={updatingLanguage}
                  className={`w-full p-3 rounded-xl border transition-colors text-left ${
                    userLanguage === 'pt'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  } ${updatingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🇧🇷</span>
                    <div>
                      <p className="font-medium">{t('dashboard.portuguese')}</p>
                      <p className="text-xs text-gray-400">{t('dashboard.portugueseCourses')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => updateUserLanguage('en')}
                  disabled={updatingLanguage}
                  className={`w-full p-3 rounded-xl border transition-colors text-left ${
                    userLanguage === 'en'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  } ${updatingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🇺🇸</span>
                    <div>
                      <p className="font-medium">English</p>
                      <p className="text-xs text-gray-400">{t('dashboard.englishCourses')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => updateUserLanguage('es')}
                  disabled={updatingLanguage}
                  className={`w-full p-3 rounded-xl border transition-colors text-left ${
                    userLanguage === 'es'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  } ${updatingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🇪🇸</span>
                    <div>
                      <p className="font-medium">Español</p>
                      <p className="text-xs text-gray-400">{t('dashboard.spanishCourses')}</p>
                    </div>
                  </div>
                </button>
              </div>

              {updatingLanguage && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">{t('dashboard.updatingLanguage')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

