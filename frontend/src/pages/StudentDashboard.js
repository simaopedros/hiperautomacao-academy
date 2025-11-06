import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  LogOut,
  MessageCircle,
  Play,
  Clock,
  CheckCircle,
  Star,
  Coins,
  History,
  Gift,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Settings,
  Globe,
  HeadphonesIcon,
  Shield,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import { useLanguagePreferences } from '../hooks/useLanguagePreferences';
import UnifiedHeader from '../components/UnifiedHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StudentDashboard({ user, onLogout, updateUser }) {
  const { t } = useI18n();
  const { contentLanguage, loading: updatingLanguage, selectLanguage, languageOptions } =
    useLanguagePreferences(user, updateUser);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [continueItems, setContinueItems] = useState([]);
  const [loadingContinue, setLoadingContinue] = useState(false);
  const [supportConfig, setSupportConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all'); // all | in_progress | completed | favorites
  const [favoriteCourseIds, setFavoriteCourseIds] = useState(() => {
    try {
      const raw = localStorage.getItem('dashboard_favorites');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showInsights, setShowInsights] = useState(() => {
    const stored = localStorage.getItem('dashboard_insights_visible');
    return stored !== null ? stored === 'true' : true;
  });
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [courseCompletionMap, setCourseCompletionMap] = useState({});
  const [languageFilteredOut, setLanguageFilteredOut] = useState(false);
  const [showingAllLanguages, setShowingAllLanguages] = useState(false);
  const navigate = useNavigate();
  const [impersonatorSession, setImpersonatorSession] = useState(() => {
    try {
      const raw = localStorage.getItem('impersonator');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const isImpersonating = Boolean(
    impersonatorSession &&
    impersonatorSession.token &&
    impersonatorSession.user &&
    user?.role !== 'admin'
  );

  useEffect(() => {
    fetchSupportConfig();
    fetchCategories();
  }, []);

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

  const handleExitImpersonation = () => {
    try {
      const stored = localStorage.getItem('impersonator');
      const parsed = stored ? JSON.parse(stored) : impersonatorSession;

      if (parsed && parsed.token && parsed.user) {
        localStorage.setItem('token', parsed.token);
        localStorage.setItem('user', JSON.stringify(parsed.user));
        localStorage.removeItem('impersonator');
        setImpersonatorSession(null);
        window.location.href = '/admin';
      } else {
        localStorage.removeItem('impersonator');
        onLogout();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Erro ao retornar para o painel do administrador:', error);
      onLogout();
      window.location.href = '/login';
    }
  };

  const fetchCourses = useCallback(
    async (includeAllLanguages = false) => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const params = {};
        if (includeAllLanguages) {
          params.include_all_languages = true;
        } else if (contentLanguage) {
          params.language = contentLanguage;
        }

        const response = await axios.get(`${API}/student/courses`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const fetchedCourses = response.data || [];
        setCourses(fetchedCourses);
        setLanguageFilteredOut(
          !includeAllLanguages && Boolean(contentLanguage) && fetchedCourses.length === 0
        );
        setShowingAllLanguages(includeAllLanguages);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    },
    [contentLanguage]
  );

  useEffect(() => {
    setSelectedCategory('all');
    fetchCourses();
  }, [fetchCourses]);

  const handleViewAllCourses = async () => {
    await fetchCourses(true);
  };

  const handleReturnToLanguage = async () => {
    await fetchCourses(false);
  };

  const handleLanguageChange = async (languageCode) => {
    try {
      setShowingAllLanguages(false);
      setLanguageFilteredOut(false);
      setSelectedCategory('all');
      await selectLanguage(languageCode);
      setShowLanguageSettings(false);
    } catch (error) {
      console.error('Error updating language:', error);
      alert('Erro ao atualizar idioma. Tente novamente.');
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
        const completionMap = {};

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

            // Determine if course is fully completed
            const completedLessonIds = new Set((progressResp.data || [])
              .filter((p) => p.completed)
              .map((p) => String(p.lesson_id))
            );
            const completedAll = lessonsOrdered.length > 0 && lessonsOrdered.every((l) => completedLessonIds.has(String(l.id)));
            completionMap[course.id] = completedAll;

            items.push({
              courseId: course.id,
              courseTitle: detail.title,
              moduleTitle,
              lessonId: targetLesson.id,
              lessonTitle: targetLesson.title,
              lessonDuration: typeof targetLesson.duration === 'number' ? targetLesson.duration : 0,
              updated_at: targetUpdatedAt,
              thumbnail_url: course.thumbnail_url,
            });
          } catch (err) {
            console.error('Error building continue item for course', course.id, err);
          }
        }

        items.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        setContinueItems(items.slice(0, 4));
        setCourseCompletionMap(completionMap);
      } catch (error) {
        console.error('Error building continue items:', error);
      } finally {
        setLoadingContinue(false);
      }
    };

    buildContinueItems();
  }, [courses]);

  const handleBuyCourse = async (courseId) => {
    navigate('/subscribe');
  };



  const enrolledCourses = courses.filter((course) => course.is_enrolled).length;
  const availableCourses = courses.length;
  const pendingCourses = courses.filter((course) => !course.is_enrolled).length;

  useEffect(() => {
    localStorage.setItem('dashboard_insights_visible', showInsights.toString());
  }, [showInsights]);

  // Persistência do filtro selecionado
  useEffect(() => {
    const stored = localStorage.getItem('dashboard_course_filter');
    if (stored) setCourseFilter(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem('dashboard_course_filter', courseFilter);
  }, [courseFilter]);

  // Persist favorites list
  useEffect(() => {
    try {
      localStorage.setItem('dashboard_favorites', JSON.stringify(favoriteCourseIds));
    } catch (err) {
      // Some environments can block localStorage (e.g., privacy modes)
      console.warn('Could not persist favorites to localStorage:', err);
    }
  }, [favoriteCourseIds]);

  const toggleFavorite = (courseId) => {
    setFavoriteCourseIds((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter((id) => id !== courseId);
      }
      return [...prev, courseId];
    });
  };

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

      <UnifiedHeader
        user={user}
        onLogout={onLogout}
        showInsights={showInsights}
        setShowInsights={setShowInsights}
        setShowLanguageSettings={setShowLanguageSettings}
        supportConfig={supportConfig}
        resumeLessonId={null}
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-10 space-y-10">
        {/* Continue Watching moved inside 'Sua jornada' */}

        {isImpersonating && (
          <div className="glass-panel border border-emerald-500/40 bg-emerald-500/10 rounded-3xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-[0_20px_45px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/30 flex items-center justify-center text-emerald-200">
                <Shield size={24} />
              </div>
              <div>
                <p className="text-sm text-emerald-200 uppercase tracking-[0.25em]">Modo de visualização</p>
                <p className="text-white">
                  Você está navegando como <span className="font-semibold">{user?.name || user?.email}</span>. Algumas ações são somente leitura.
                </p>
              </div>
            </div>
            <button
              onClick={handleExitImpersonation}
              className="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all"
            >
              Voltar para painel do administrador
            </button>
          </div>
        )}

        {showInsights && (
        <section>
          <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">{t('dashboard.yourJourney')}</p>
                  <p className="text-gray-400 text-sm">{t('dashboard.journeyDescription')}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3">
                    <p className="text-xs text-gray-400">{t('dashboard.activeCourses')}</p>
                    <p className="text-xl font-semibold">{enrolledCourses}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3">
                    <p className="text-xs text-gray-400">{t('dashboard.catalog')}</p>
                    <p className="text-xl font-semibold">{availableCourses}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 p-3">
                    <p className="text-xs text-gray-400">{t('dashboard.waitingForYou')}</p>
                    <p className="text-xl font-semibold">{pendingCourses}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                {/* Continue cards inside 'Sua jornada' */}
                <div className="space-y-4">
                  {/* Removido bloco "Próxima ação" para evitar redundância */}
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{t('dashboard.continue')}</p>
                    <h3 className="text-xl font-semibold mt-2">{t('dashboard.continueDescription')}</h3>
                    <p className="text-gray-400 text-sm">{t('dashboard.quickAccessLastLessons')}</p>
                  </div>

                  {loadingContinue ? (
                    <div className="text-center py-6">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
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
                </div>

                {/* Shortcuts row (sem botão de continuar para evitar redundância) */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => navigate('/social')}
                    className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} />
                    {t('dashboard.community')}
                  </button>
                  <button
                    onClick={() => navigate('/profile')}
                    className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    <Settings size={16} />
                    {t('dashboard.profileSettings')}
                  </button>
                  {supportConfig?.enabled !== false && supportConfig?.support_url && (
                    <a
                      href={supportConfig.support_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full sm:flex-1 py-3 flex items-center justify-center gap-2"
                    >
                      <HeadphonesIcon size={16} />
                      {supportConfig.support_text || 'Suporte'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        )}

        <section className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{t('dashboard.catalog')}</p>
            <h3 className="text-3xl font-semibold mt-2">{t('dashboard.availableCourses')}</h3>
            <p className="text-gray-400 text-sm max-w-2xl">
              {t('dashboard.availableCoursesDescription')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              {/* Select de Status */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-emerald-200" htmlFor="statusFilter">
                  {t('dashboard.quickActions') || 'Filtrar por status'}
                </label>
                <select
                  id="statusFilter"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">
                    {(t('dashboard.all') || 'Todos')} ({courses.length})
                  </option>
                  <option value="in_progress">
                    {(t('dashboard.inProgress') || 'Em andamento')} ({courses.filter((c) => (c.has_access || c.is_enrolled) && !courseCompletionMap[c.id]).length})
                  </option>
                  <option value="completed">
                    {(t('dashboard.completed') || 'Concluídos')} ({courses.filter((c) => (c.has_access || c.is_enrolled) && courseCompletionMap[c.id]).length})
                  </option>
                  <option value="favorites">
                    {(t('dashboard.favorites') || 'Favoritos')} ({courses.filter((c) => favoriteCourseIds.includes(c.id)).length})
                  </option>
                </select>
              </div>

              {/* Select de Categoria */}
              <div className="space-y-2">
                <label htmlFor="categoryFilter" className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                  {t('dashboard.filterByCategory')}
                </label>
                <select
                  id="categoryFilter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">
                    {t('dashboard.allCategories')} ({courses.length})
                  </option>
                  {getCategoriesWithCourses().map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name} ({cat.courseCount})
                    </option>
                  ))}
                </select>

                {getCategoriesWithCourses().length === 0 && courses.length > 0 && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-400/20">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    <p className="text-amber-300 text-sm">{t('dashboard.coursesWithoutCategories')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 sm:py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-emerald-500 border-t-transparent" />
              <p className="text-gray-400 mt-4 text-sm sm:text-base">{t('dashboard.loadingCourses')}</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 sm:py-20 space-y-4">
              <BookOpen size={48} className="sm:w-16 sm:h-16 mx-auto text-gray-600" />
              {languageFilteredOut ? (
                <>
                  <p className="text-gray-300 text-base sm:text-lg">{t('dashboard.noCoursesInLanguage')}</p>
                  <p className="text-gray-500 text-sm max-w-xl mx-auto">{t('dashboard.viewAllCoursesHint')}</p>
                  <button
                    onClick={handleViewAllCourses}
                    className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 transition-colors"
                  >
                    {t('dashboard.viewAllCoursesButton')}
                  </button>
                </>
              ) : (
                <p className="text-gray-400 text-base sm:text-lg">{t('dashboard.noCoursesAvailable')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {showingAllLanguages && contentLanguage && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-50">
                  <p className="text-sm sm:text-base">{t('dashboard.viewingAllCourses')}</p>
                  <button
                    onClick={handleReturnToLanguage}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors text-sm"
                  >
                    {t('dashboard.viewMyLanguageButton')}
                  </button>
                </div>
              )}
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
                      <span className="text-gray-400 text-sm">({(groupedCourses[selectedCategory] || []).filter((course) => {
                        if (courseFilter === 'in_progress') return (course.has_access || course.is_enrolled) && !courseCompletionMap[course.id];
                        if (courseFilter === 'completed') return (course.has_access || course.is_enrolled) && courseCompletionMap[course.id];
                        if (courseFilter === 'favorites') return favoriteCourseIds.includes(course.id);
                        return true;
                      }).length} {t('dashboard.courses')})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {(groupedCourses[selectedCategory] || [])
                        .filter((course) => {
                          if (courseFilter === 'in_progress') return (course.has_access || course.is_enrolled) && !courseCompletionMap[course.id];
                          if (courseFilter === 'completed') return (course.has_access || course.is_enrolled) && courseCompletionMap[course.id];
                          if (courseFilter === 'favorites') return favoriteCourseIds.includes(course.id);
                          return true;
                        })
                        .map((course, index) => (
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
                            {/* Favorite toggle */}
                            <button
                              type="button"
                              className={`absolute top-3 right-3 rounded-full p-2 border transition-colors ${favoriteCourseIds.includes(course.id) ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'}`}
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
                              aria-label="Toggle favorite"
                            >
                              <Star size={16} className={favoriteCourseIds.includes(course.id) ? 'fill-current' : ''} />
                            </button>
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
                      <span className="text-gray-400 text-sm">({categoryCourses.filter((course) => {
                        if (courseFilter === 'in_progress') return (course.has_access || course.is_enrolled) && !courseCompletionMap[course.id];
                        if (courseFilter === 'completed') return (course.has_access || course.is_enrolled) && courseCompletionMap[course.id];
                        if (courseFilter === 'favorites') return favoriteCourseIds.includes(course.id);
                        return true;
                      }).length} {t('dashboard.courses')})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {categoryCourses
                        .filter((course) => {
                          if (courseFilter === 'in_progress') return (course.has_access || course.is_enrolled) && !courseCompletionMap[course.id];
                          if (courseFilter === 'completed') return (course.has_access || course.is_enrolled) && courseCompletionMap[course.id];
                          if (courseFilter === 'favorites') return favoriteCourseIds.includes(course.id);
                          return true;
                        })
                        .map((course, index) => (
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
                            {/* Favorite toggle */}
                            <button
                              type="button"
                              className={`absolute top-3 right-3 rounded-full p-2 border transition-colors ${favoriteCourseIds.includes(course.id) ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'}`}
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
                              aria-label="Toggle favorite"
                            >
                              <Star size={16} className={favoriteCourseIds.includes(course.id) ? 'fill-current' : ''} />
                            </button>
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
                  onClick={() => handleLanguageChange(null)}
                  disabled={updatingLanguage}
                  className={`w-full p-3 rounded-xl border transition-colors text-left ${
                    contentLanguage === null
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

                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleLanguageChange(option.code)}
                    disabled={updatingLanguage}
                    className={`w-full p-3 rounded-xl border transition-colors text-left ${
                      contentLanguage === option.code
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    } ${updatingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{option.flag}</span>
                      <div>
                        <p className="font-medium">
                          {option.code === 'pt'
                            ? t('dashboard.portuguese')
                            : option.code === 'en'
                            ? 'English'
                            : option.code === 'es'
                            ? 'Español'
                            : option.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {option.code === 'pt'
                            ? t('dashboard.portugueseCourses')
                            : option.code === 'en'
                            ? t('dashboard.englishCourses')
                            : option.code === 'es'
                            ? t('dashboard.spanishCourses')
                            : option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
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
