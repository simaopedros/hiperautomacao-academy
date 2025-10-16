import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, FileText, Download, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CourseView({ user, onLogout }) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!course && !courseInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-xl">Curso não encontrado</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // If user doesn't have access, show purchase page
  if (!hasAccess && courseInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft size={20} className="mr-2" />
              Voltar aos Cursos
            </Button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-[#111111] rounded-xl border border-[#252525] p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{courseInfo.title}</h1>
              <p className="text-gray-400">{courseInfo.description}</p>
            </div>

            <div className="space-y-4 mb-8">
              <h2 className="text-xl font-bold text-white">Este curso requer matrícula</h2>
              <p className="text-gray-400">
                Para acessar o conteúdo deste curso, você precisa se matricular usando créditos ou fazer a compra direta.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {courseInfo.price_credits > 0 && (
                <div className="bg-[#1a1a1a] rounded-lg p-6 border-2 border-emerald-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Usar Créditos</h3>
                  <div className="text-3xl font-bold text-emerald-400 mb-4">
                    {courseInfo.price_credits} créditos
                  </div>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Matricular com Créditos
                  </button>
                </div>
              )}

              {courseInfo.price_brl > 0 && (
                <div className="bg-[#1a1a1a] rounded-lg p-6 border-2 border-blue-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Compra Direta</h3>
                  <div className="text-3xl font-bold text-blue-400 mb-4">
                    R$ {courseInfo.price_brl.toFixed(2)}
                  </div>
                  <button
                    onClick={() => navigate('/buy-credits')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Comprar Curso
                  </button>
                </div>
              )}
            </div>

            {(!courseInfo.price_credits || courseInfo.price_credits === 0) && (!courseInfo.price_brl || courseInfo.price_brl === 0) && (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Este curso não está disponível para compra no momento.</p>
                <Button onClick={() => navigate('/dashboard')}>
                  Voltar aos Cursos
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button
            data-testid="back-button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar aos Cursos
          </Button>
        </div>
      </header>

      {/* Course Hero */}
      <div className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-cyan-900/40">
          {course.thumbnail_url && (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover opacity-30"
            />
          )}
        </div>
        <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          {course.category && (
            <span className="inline-block bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-2 rounded-full mb-4 w-fit">
              {course.category}
            </span>
          )}
          <h1 className="text-5xl font-bold text-white mb-4">{course.title}</h1>
          <p className="text-xl text-gray-300 max-w-3xl">{course.description}</p>
        </div>
      </div>

      {/* Course Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-white mb-8">Conteúdo do Curso</h2>

        {course.modules && course.modules.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <p className="text-gray-400">Este curso ainda não possui conteúdo disponível.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {course.modules?.map((module, moduleIndex) => (
              <div
                key={module.id}
                data-testid={`module-${module.id}`}
                className="bg-[#1a1a1a] border border-[#252525] rounded-xl overflow-hidden animate-fade-in"
                style={{ animationDelay: `${moduleIndex * 0.1}s` }}
              >
                <div className="p-6 border-b border-[#252525]">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Módulo {moduleIndex + 1}: {module.title}
                  </h3>
                  {module.description && (
                    <p className="text-gray-400">{module.description}</p>
                  )}
                </div>

                <div className="divide-y divide-[#252525]">
                  {module.lessons?.map((lesson, lessonIndex) => (
                    <div
                      key={lesson.id}
                      data-testid={`lesson-${lesson.id}`}
                      className="p-4 hover:bg-[#1f1f1f] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-shrink-0 w-10 h-10 bg-[#252525] rounded-lg flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                            {getLessonIcon(lesson.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-semibold group-hover:text-emerald-400 transition-colors">
                              {lessonIndex + 1}. {lesson.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 uppercase">{lesson.type}</span>
                              {lesson.duration > 0 && (
                                <span className="text-xs text-gray-500">
                                  {Math.floor(lesson.duration / 60)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isLessonCompleted(lesson.id) ? (
                            <CheckCircle size={24} className="text-emerald-400" />
                          ) : (
                            <Circle size={24} className="text-gray-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}