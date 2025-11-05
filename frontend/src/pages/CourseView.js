import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, FileText, Download, CheckCircle, Circle, Clock, BookOpen, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useI18n from '@/hooks/useI18n';
import { Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CourseView({ user, onLogout }) {
  const { t } = useI18n();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [courseInfo, setCourseInfo] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    fetchCourseData();
    fetchProgress();
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourse(response.data);
      setHasAccess(true);
    } catch (error) {
      console.error('Error fetching course:', error);
      if (error.response?.status === 403) {
        // User doesn't have access, fetch basic course info
        setHasAccess(false);
        fetchBasicCourseInfo();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBasicCourseInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      // Get course from all courses list
      const response = await axios.get(`${API}/student/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const foundCourse = response.data.find(c => c.id === courseId);
      if (foundCourse) {
        setCourseInfo(foundCourse);
        // After we know which course is restricted, fetch available subscription plans
        fetchSubscriptionPlans();
      }
    } catch (error) {
      console.error('Error fetching basic course info:', error);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await axios.get(`${API}/subscriptions/plans`);
      setPlans(response.data || []);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSubscribePlan = async (planId) => {
    if (!user) {
      alert('Você precisa estar logado para assinar');
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/billing/create`,
        {
          subscription_plan_id: planId,
          customer_name: user.name,
          customer_email: user.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem('last_billing_id', response.data.billing_id);
      window.location.href = response.data.payment_url;
    } catch (error) {
      console.error('Error creating subscription billing:', error);
      alert(error.response?.data?.detail || 'Erro ao criar assinatura');
    }
  };

  const handleBuyCourse = async () => {
    if (!courseInfo) return;

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
      alert(error.response?.data?.detail || t('course.paymentError'));
    }
  };

  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/progress/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProgress(response.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const isLessonCompleted = (lessonId) => {
    return progress.some(p => p.lesson_id === lessonId && p.completed);
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'video':
        return <Play size={20} className="text-emerald-400" />;
      case 'text':
        return <FileText size={20} className="text-blue-400" />;
      case 'file':
        return <Download size={20} className="text-purple-400" />;
      default:
        return <FileText size={20} />;
    }
  };

  const getModuleProgress = (module) => {
    if (!module.lessons || module.lessons.length === 0) return 0;
    const completedLessons = module.lessons.filter(lesson => isLessonCompleted(lesson.id)).length;
    return Math.round((completedLessons / module.lessons.length) * 100);
  };

  const getTotalProgress = () => {
    if (!course?.modules || course.modules.length === 0) return 0;
    const totalLessons = course.modules.reduce((acc, module) => acc + (module.lessons?.length || 0), 0);
    if (totalLessons === 0) return 0;
    const completedLessons = course.modules.reduce((acc, module) => 
      acc + (module.lessons?.filter(lesson => isLessonCompleted(lesson.id)).length || 0), 0);
    return Math.round((completedLessons / totalLessons) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#01030a] via-[#050b16] to-[#02060f] flex items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl border border-white/10">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4"></div>
          <p className="text-gray-300 text-center">Carregando curso...</p>
        </div>
      </div>
    );
  }

  if (!course && !courseInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#01030a] via-[#050b16] to-[#02060f] flex items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('course.notFound')}</h2>
          <p className="text-gray-400 mb-6">{t('course.notFound')}</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-emerald-500 hover:bg-emerald-600">
            {t('course.backToCourses')}
          </Button>
        </div>
      </div>
    );
  }

  // If user doesn't have access, show minimalist subscription upsell
  if (!hasAccess && courseInfo) {
    const recommendedPlan = plans.length > 1 ? plans[1] : (plans[0] || null);
    return (
      <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] pointer-events-none" />
        <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/20 blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-blue-500/15 blur-[130px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-10">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={18} />
              {t('course.backToCourses')}
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-emerald-300" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-1 truncate">{t('course.upsell.heading')}</h1>
              <p className="text-gray-300 text-xs whitespace-nowrap truncate">{t('course.upsell.subtitle')}</p>
              {courseInfo?.title && (
                <p className="text-gray-400 text-[11px] mt-2 whitespace-nowrap truncate">{courseInfo.title}</p>
              )}
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6">
              <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-200 mb-1 whitespace-nowrap truncate">{t('course.upsell.benefitsTitle')}</p>
              <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
                <li className="whitespace-nowrap truncate">{t('course.upsell.benefit1')}</li>
                <li className="whitespace-nowrap truncate">{t('course.upsell.benefit2')}</li>
                <li className="whitespace-nowrap truncate">{t('course.upsell.benefit3')}</li>
                <li className="whitespace-nowrap truncate">{t('course.upsell.benefit4')}</li>
              </ul>
            </div>

            {loadingPlans ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" aria-label={t('course.upsell.loadingPlans')} />
              </div>
            ) : recommendedPlan ? (
              <div className="space-y-3 text-center">
                <p className="text-gray-400 text-[11px] whitespace-nowrap truncate">{t('course.upsell.instantAccessNote')}</p>
                <Button
                  onClick={() => handleSubscribePlan(recommendedPlan.id)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white py-3 px-6 rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
                >
                  {t('course.upsell.cta')} · {recommendedPlan.name} · R$ {Number(recommendedPlan.price_brl).toFixed(2)}
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/subscribe')}
                  className="text-emerald-300 hover:text-emerald-200 text-xs whitespace-nowrap"
                >
                  {t('course.upsell.viewPlans')}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-gray-400 text-sm">{t('course.upsell.noPlans')}</p>
                <Button
                  onClick={() => navigate('/subscribe')}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                >
                  {t('course.upsell.viewPlans')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const totalProgress = getTotalProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01030a] via-[#050b16] to-[#02060f]">
      {/* Header */}
      <header className="glass-panel border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              data-testid="back-button"
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft size={20} className="mr-2" />
              {t('course.backToCourses')}
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Progresso</p>
                <p className="text-lg font-semibold text-white">{totalProgress}%</p>
              </div>
              <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Course Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-cyan-900/40 to-blue-900/40">
          {course.thumbnail_url && (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover opacity-20"
            />
          )}
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="glass-panel rounded-3xl border border-white/10 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex-1">
                {course.category && (
                  <span className="inline-block bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-2 rounded-full mb-4">
                    {course.category}
                  </span>
                )}
                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">{course.title}</h1>
                <p className="text-xl text-gray-300 leading-relaxed max-w-3xl">{course.description}</p>
              </div>
              
              <div className="flex-shrink-0">
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6 min-w-[200px]">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen size={32} className="text-emerald-400" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Módulos</p>
                    <p className="text-2xl font-bold text-white">{course.modules?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200 mb-3">{t('course.courseContent')}</p>
          <h2 className="text-3xl font-bold text-white">Módulos e Aulas</h2>
          <p className="text-gray-400 mt-2">Navegue pelo conteúdo do curso e acompanhe seu progresso</p>
        </div>

        {course.modules && course.modules.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-white/10 p-12 text-center">
            <div className="w-20 h-20 bg-gray-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen size={40} className="text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Nenhum conteúdo disponível</h3>
            <p className="text-gray-400 text-lg">{t('course.noContentAvailable')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {course.modules?.map((module, moduleIndex) => {
              const moduleProgress = getModuleProgress(module);
              return (
                <div
                  key={module.id}
                  data-testid={`module-${module.id}`}
                  className="glass-panel rounded-3xl border border-white/10 overflow-hidden animate-fade-in shadow-[0_25px_90px_rgba(0,0,0,0.35)]"
                  style={{ animationDelay: `${moduleIndex * 0.1}s` }}
                >
                  {/* Module Header */}
                  <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                            <span className="text-emerald-400 font-bold">{moduleIndex + 1}</span>
                          </div>
                          <h3 className="text-2xl font-bold text-white">
                            {module.title}
                          </h3>
                        </div>
                        {module.description && (
                          <p className="text-gray-300 ml-14">{module.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Progresso</p>
                          <p className="text-lg font-semibold text-white">{moduleProgress}%</p>
                        </div>
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                            style={{ width: `${moduleProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Module Lessons */}
                  <div className="p-6">
                    <div className="grid gap-4">
                      {module.lessons?.map((lesson, lessonIndex) => {
                        const isCompleted = isLessonCompleted(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            data-testid={`lesson-${lesson.id}`}
                            className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 rounded-2xl p-4 transition-all duration-300 cursor-pointer text-left"
                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center group-hover:from-emerald-500/20 group-hover:to-cyan-500/20 transition-all duration-300">
                                {getLessonIcon(lesson.type)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-semibold group-hover:text-emerald-400 transition-colors text-lg">
                                  {lessonIndex + 1}. {lesson.title}
                                </h4>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className="text-xs text-gray-400 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-full">
                                    {lesson.type}
                                  </span>
                                  {lesson.duration > 0 && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Clock size={12} />
                                      {Math.floor(lesson.duration / 60)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                    <CheckCircle size={20} className="text-emerald-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                    <Circle size={20} className="text-gray-500 group-hover:text-emerald-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}