import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, FileText, Download, CheckCircle, Circle, Clock, BookOpen, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useI18n from '@/hooks/useI18n';

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
      }
    } catch (error) {
      console.error('Error fetching basic course info:', error);
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

  // If user doesn't have access, show purchase page
  if (!hasAccess && courseInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#01030a] via-[#050b16] to-[#02060f]">
        {/* Header */}
        <header className="glass-panel border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft size={20} className="mr-2" />
              {t('course.backToCourses')}
            </Button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="glass-panel rounded-3xl border border-white/10 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">{courseInfo.title}</h1>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">{courseInfo.description}</p>
              
              {courseInfo.category && (
                <span className="inline-block bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-2 rounded-full mt-4">
                  {courseInfo.category}
                </span>
              )}
            </div>

            <div className="space-y-6 mb-8">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                  <Users size={24} className="text-emerald-400" />
                  {t('course.enrollmentRequired')}
                </h2>
                <p className="text-gray-300 text-lg leading-relaxed">
                  {t('course.enrollmentDescription')}
                </p>
              </div>
            </div>

            {courseInfo.price_brl > 0 && (
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-400/30 p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-white mb-2">{t('course.directPurchase')}</h3>
                  <div className="text-5xl font-bold text-blue-400 mb-6">
                    R$ {courseInfo.price_brl.toFixed(2)}
                  </div>
                  <button
                    onClick={handleBuyCourse}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-4 px-8 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    {t('course.buyCourse')}
                  </button>
                </div>
              </div>
            )}

            {(!courseInfo.price_brl || courseInfo.price_brl === 0) && (
              <div className="text-center bg-white/5 rounded-2xl border border-white/10 p-8">
                <p className="text-gray-400 mb-4 text-lg">{t('course.notAvailableForPurchase')}</p>
                <Button onClick={() => navigate('/dashboard')} className="bg-emerald-500 hover:bg-emerald-600">
                  {t('course.backToCourses')}
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