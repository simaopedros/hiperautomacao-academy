import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  MessageCircle,
  ThumbsUp,
  Send,
  Trash2,
  Download,
  Home,
  BookOpen,
  Circle,
  CheckCircle2,
  Play,
  FileText,
  ExternalLink,
  Clock,
  Users,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import useI18n from '@/hooks/useI18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LessonPlayer({ user, onLogout }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [lesson, setLesson] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [moduleInfo, setModuleInfo] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [previousLesson, setPreviousLesson] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    fetchLesson();
    fetchComments();
  }, [lessonId]);

  useEffect(() => {
    if (courseData) {
      checkProgress();
    }
  }, [courseData, lessonId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(min-width: 1280px)');

    const handleChange = (event) => {
      setIsDesktop(event.matches);
      setOutlineOpen(event.matches);
    };

    handleChange(query);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLesson(response.data);

      await fetchCourseAndFindNeighbours(response.data.module_id, token);
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseAndFindNeighbours = async (moduleId, token) => {
    try {
      const coursesResponse = await axios.get(`${API}/student/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      for (const course of coursesResponse.data) {
        const detailResponse = await axios.get(`${API}/student/courses/${course.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const detail = detailResponse.data;
        const modules = detail.modules || [];

        const moduleFound = modules.find((module) => module.id === moduleId);
        if (!moduleFound) continue;

        setCourseData(detail);
        setModuleInfo({
          courseId: detail.id,
          courseTitle: detail.title,
          moduleId: moduleFound.id,
          moduleTitle: moduleFound.title
        });

        setPreviousLesson(null);
        setNextLesson(null);

        let lastVisited = null;
        let foundCurrent = false;

        for (const module of modules) {
          const lessons = module.lessons || [];
          for (let index = 0; index < lessons.length; index += 1) {
            const lessonItem = lessons[index];
            const isCurrent = String(lessonItem.id) === String(lessonId);

            if (foundCurrent) {
              setNextLesson((current) => current ?? lessonItem);
              break;
            }

            if (isCurrent) {
              setPreviousLesson(lastVisited);
              foundCurrent = true;
            } else {
              lastVisited = lessonItem;
            }
          }

          if (foundCurrent) {
            break;
          }
        }

        return;
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/comments/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const checkProgress = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/progress/${courseData.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const progressItem = response.data.find(
        (item) => String(item.lesson_id) === String(lessonId)
      );
      setIsCompleted(Boolean(progressItem?.completed));
    } catch (error) {
      console.error('Error checking progress:', error);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/comments`,
        {
          lesson_id: lessonId,
          content: newComment,
          parent_id: replyTo?.id || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      setReplyTo(null);
      fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleLike = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/comments/${commentId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm(t('lesson.confirmDeleteComment'))) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const toggleCompleted = async () => {
    try {
      const token = localStorage.getItem('token');
      const newCompleted = !isCompleted;

      await axios.post(
        `${API}/progress`,
        { lesson_id: lessonId, completed: newCompleted, last_position: 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsCompleted(newCompleted);

      if (moduleInfo) {
        await fetchCourseAndFindNeighbours(moduleInfo.moduleId, token);
      }
      await checkProgress();

      if (newCompleted && nextLesson) {
        setTimeout(() => navigate(`/lesson/${nextLesson.id}`), 400);
      } else if (newCompleted && !nextLesson) {
        alert(t('lesson.congratulationsCompleted'));
      }
    } catch (error) {
      console.error('Error toggling completed:', error);
    }
  };

  const organizeComments = () => {
    const topLevel = comments.filter((comment) => !comment.parent_id);
    const replies = comments.filter((comment) => comment.parent_id);

    return topLevel.map((comment) => ({
      ...comment,
      replies: replies.filter((reply) => reply.parent_id === comment.id)
    }));
  };

  const renderOutline = () => {
    if (!courseData?.modules?.length) {
      return (
        <div className="glass-panel p-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 mx-auto">
            <BookOpen className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-gray-400">{t('lesson.mapNotAvailable')}</p>
        </div>
      );
    }

    return courseData.modules.map((module) => (
      <div key={module.id ?? module.title} className="glass-panel p-6 transition-all duration-300 hover:scale-[1.02]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white">{module.title}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              <span>{(module.lessons || []).length} {t('lesson.lessons')}</span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
            <BookOpen className="h-5 w-5 text-emerald-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          {(module.lessons || []).map((lessonItem) => {
            const isActive = String(lessonItem.id) === String(lessonId);
            const completed = lessonItem.completed || lessonItem.progress === 100;

            return (
              <button
                type="button"
                key={lessonItem.id}
                onClick={() => navigate(`/lesson/${lessonItem.id}`)}
                className={`group w-full rounded-xl border p-3 text-left transition-all duration-300 ${
                  isActive
                    ? 'border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-blue-500/10 shadow-[0_8px_30px_rgba(16,185,129,0.25)] scale-105'
                    : 'border-white/10 bg-white/[0.02] hover:border-emerald-400/30 hover:bg-white/[0.05] hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    completed 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-gray-500/20 text-gray-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400'
                  }`}>
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'
                    }`}>
                      {lessonItem.title}
                    </p>
                    {lessonItem.type && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        {lessonItem.type === 'video' && <Play className="h-3 w-3" />}
                        {lessonItem.type === 'text' && <FileText className="h-3 w-3" />}
                        {lessonItem.type === 'file' && <Download className="h-3 w-3" />}
                        <span className="capitalize">{lessonItem.type}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ));
  };

  const showDesktopOutline = outlineOpen && isDesktop;
  const showMobileOutline = outlineOpen && !isDesktop;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0f1c] via-[#111827] to-[#1e293b]">
        <div className="glass-panel p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 mx-auto">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </div>
          <p className="text-lg font-medium text-white">Carregando aula...</p>
          <p className="mt-1 text-sm text-gray-400">Preparando o conteúdo para você</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0f1c] via-[#111827] to-[#1e293b]">
        <div className="glass-panel p-8 text-center max-w-md">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 mx-auto">
            <ExternalLink className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Aula não encontrada</h2>
          <p className="text-gray-400 mb-6">{t('lesson.lessonNotFound')}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600"
          >
            <Home className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1c] via-[#111827] to-[#1e293b] text-white">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-20 top-32 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -right-28 bottom-16 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Enhanced Header */}
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                  <Play className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-400">
                  {t('lesson.lesson')}
                </span>
              </div>
              {moduleInfo && (
                <div className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
                  <span className="truncate font-medium">{moduleInfo.courseTitle}</span>
                  <span className="text-gray-600">•</span>
                  <span className="truncate">{moduleInfo.moduleTitle}</span>
                  <span className="text-gray-600">•</span>
                  <span className="truncate font-medium text-white">{lesson.title}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex"
              >
                <ArrowLeft size={16} className="mr-1" />
                {t('lesson.back')}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
              >
                <Home size={16} className="mr-2" />
                Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => setOutlineOpen((prev) => !prev)}
                className="hidden border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm md:inline-flex"
              >
                <BookOpen size={16} className="mr-2" />
                {outlineOpen ? t('lesson.hideCourseMap') : t('lesson.courseMap')}
              </Button>
              <Button
                onClick={() => (moduleInfo ? navigate(`/course/${moduleInfo.courseId}`) : navigate('/dashboard'))}
                className="hidden bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 md:inline-flex"
                disabled={!moduleInfo}
              >
                <BookOpen size={16} className="mr-2" />
                {moduleInfo ? t('lesson.viewCourse') : t('lesson.course')}
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Outline Overlay */}
        {showMobileOutline && (
          <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#0a0f1c] via-[#111827] to-[#1e293b]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">{t('lesson.courseMap')}</h2>
                {moduleInfo && (
                  <p className="text-sm text-gray-400">{moduleInfo.courseTitle}</p>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={() => setOutlineOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">{renderOutline()}</div>
            </div>
          </div>
        )}

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            {/* Mobile Navigation */}
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                onClick={() => setOutlineOpen((prev) => !prev)}
                className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
              >
                <BookOpen size={16} className="mr-2" />
                {outlineOpen ? t('lesson.closeCourseMap') : t('lesson.courseMap')}
              </Button>
              <Button
                variant="outline"
                onClick={() => (moduleInfo ? navigate(`/course/${moduleInfo.courseId}`) : navigate('/dashboard'))}
                className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
                disabled={!moduleInfo}
              >
                <ExternalLink size={16} className="mr-2" />
                {t('lesson.course')}
              </Button>
            </div>

            <div className={showDesktopOutline ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid gap-8'}>
              <section className="space-y-8">
                {/* Enhanced Lesson Content */}
                <article className="glass-panel p-6 sm:p-8 transition-all duration-300 hover:scale-[1.01]">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                        {lesson.type === 'video' && <Play className="h-5 w-5 text-emerald-400" />}
                        {lesson.type === 'text' && <FileText className="h-5 w-5 text-emerald-400" />}
                        {lesson.type === 'file' && <Download className="h-5 w-5 text-emerald-400" />}
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span className="capitalize">{lesson.type}</span>
                          {isCompleted && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Concluída</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Video Content */}
                    {lesson.type === 'video' && (
                      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-2xl">
                        <div
                          className="video-embed-container aspect-video w-full"
                          dangerouslySetInnerHTML={{ __html: lesson.content }}
                        />
                      </div>
                    )}

                    {/* Text Content */}
                    {lesson.type === 'text' && (
                      <div className="glass-panel p-6 text-lg leading-relaxed text-gray-200 whitespace-pre-wrap">
                        {lesson.content}
                      </div>
                    )}

                    {/* File Content */}
                    {lesson.type === 'file' && (
                      <div className="glass-panel p-8 text-center bg-gradient-to-br from-emerald-500/10 to-blue-500/10">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 mx-auto">
                          <Download className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Material para Download</h3>
                        <p className="text-gray-400 mb-6">Clique no botão abaixo para baixar o material da aula</p>
                        <a
                          href={lesson.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-6 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-blue-600 hover:scale-105"
                        >
                          <Download size={20} />
                          {t('lesson.downloadMaterial')}
                        </a>
                      </div>
                    )}

                    {/* Description */}
                    {lesson.description && (
                      <div className="glass-panel p-6">
                        <h3 className="text-lg font-bold text-white mb-3">Descrição</h3>
                        <p className="text-base leading-relaxed text-gray-300">
                          {lesson.description}
                        </p>
                      </div>
                    )}

                    {/* Enhanced Action Buttons */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        data-testid="mark-completed-button"
                        onClick={toggleCompleted}
                        className={`group relative overflow-hidden rounded-xl py-4 px-6 text-base font-semibold transition-all duration-300 ${
                          isCompleted
                            ? 'border border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-200 hover:from-emerald-500/30 hover:to-green-500/30'
                            : 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600 hover:scale-105'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                          {isCompleted ? t('lesson.lessonCompletedUnmark') : t('lesson.markAsCompleted')}
                        </div>
                      </Button>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          className="border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm disabled:opacity-50"
                          disabled={!previousLesson}
                          onClick={() => previousLesson && navigate(`/lesson/${previousLesson.id}`)}
                        >
                          {previousLesson ? `${previousLesson.title}` : t('lesson.noPreviousLesson')}
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 backdrop-blur-sm disabled:opacity-50"
                          disabled={!nextLesson}
                          onClick={() => nextLesson && navigate(`/lesson/${nextLesson.id}`)}
                        >
                          {nextLesson ? `${nextLesson.title}` : t('lesson.noNextLesson')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>

                {/* Enhanced Additional Resources */}
                {lesson.links?.length > 0 && (
                  <section className="glass-panel p-6 sm:p-8 transition-all duration-300 hover:scale-[1.01]">
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                          <ExternalLink className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">{t('lesson.additionalResources')}</h2>
                          <p className="text-sm text-gray-400">{lesson.links.length} {t('lesson.items')} disponíveis</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {lesson.links.map((link, index) => (
                        <a
                          key={`${link.url}-${index}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group glass-panel p-4 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 group-hover:from-emerald-500/30 group-hover:to-blue-500/30 transition-all">
                              <ExternalLink className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-white group-hover:text-emerald-200 transition-colors">
                                {link.title || 'Recurso Adicional'}
                              </p>
                              <p className="truncate text-sm text-gray-400">{link.url}</p>
                            </div>
                            <ArrowLeft className="h-4 w-4 rotate-180 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* Enhanced Discussion Section */}
                <section className="glass-panel p-6 sm:p-8 transition-all duration-300 hover:scale-[1.01]">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <MessageCircle className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{t('lesson.discussion')}</h2>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="h-4 w-4" />
                        <span>{comments.length} comentários</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Comment Form */}
                  <form onSubmit={handleCommentSubmit} className="mb-8 space-y-4">
                    {replyTo && (
                      <div className="glass-panel p-4 border-l-4 border-emerald-400">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            {t('lesson.replyingTo')} <span className="font-semibold text-emerald-400">{replyTo.user_name}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setReplyTo(null)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            {t('lesson.cancel')}
                          </Button>
                        </div>
                      </div>
                    )}
                    <Textarea
                      data-testid="comment-input"
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder={t('lesson.commentPlaceholder')}
                      rows={4}
                      className="border-white/20 bg-white/5 text-white placeholder:text-gray-400 focus-visible:ring-emerald-400 backdrop-blur-sm"
                    />
                    <Button
                      data-testid="submit-comment"
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 disabled:opacity-50"
                      disabled={!newComment.trim()}
                    >
                      <Send size={16} className="mr-2" />
                      {t('lesson.send')}
                    </Button>
                  </form>

                  {/* Enhanced Comments List */}
                  <div className="max-h-[600px] space-y-4 overflow-y-auto pr-2">
                    {organizeComments().map((comment) => (
                      <div
                        key={comment.id}
                        data-testid={`comment-${comment.id}`}
                        className="glass-panel p-4 transition-all duration-300 hover:scale-[1.01]"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-white font-bold">
                              {comment.user_name[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-white">{comment.user_name}</span>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Clock className="h-3 w-3" />
                                <span>Há alguns minutos</span>
                              </div>
                            </div>
                          </div>
                          {(comment.user_id === user.id || user.role === 'admin') && (
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(comment.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                        
                        <p className="text-gray-200 mb-4 leading-relaxed">{comment.content}</p>
                        
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            onClick={() => handleLike(comment.id)}
                            className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <ThumbsUp size={14} />
                            <span>{comment.likes}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setReplyTo(comment)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                          >
                            Responder
                          </Button>
                        </div>

                        {/* Enhanced Replies */}
                        {comment.replies?.length > 0 && (
                          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="glass-panel p-3 ml-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-bold">
                                      {reply.user_name[0].toUpperCase()}
                                    </div>
                                    <span className="text-sm font-semibold text-white">{reply.user_name}</span>
                                  </div>
                                  {(reply.user_id === user.id || user.role === 'admin') && (
                                    <Button
                                      variant="ghost"
                                      onClick={() => handleDelete(reply.id)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                  )}
                                </div>
                                <p className="text-sm text-gray-200 mb-2">{reply.content}</p>
                                <Button
                                  variant="ghost"
                                  onClick={() => handleLike(reply.id)}
                                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  <ThumbsUp size={12} />
                                  <span>{reply.likes}</span>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {organizeComments().length === 0 && (
                      <div className="glass-panel p-8 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-500/20 to-gray-600/20 mx-auto">
                          <MessageCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Nenhum comentário ainda</h3>
                        <p className="text-gray-400">Seja o primeiro a comentar sobre esta aula!</p>
                      </div>
                    )}
                  </div>
                </section>
              </section>

              {/* Enhanced Desktop Sidebar */}
              {showDesktopOutline && (
                <aside className="space-y-6">
                  <div className="glass-panel p-6 xl:sticky xl:top-24">
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">Mapa do Curso</h3>
                        {moduleInfo && (
                          <p className="text-sm text-gray-400">{moduleInfo.courseTitle}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setOutlineOpen(false)}
                        className="text-gray-400 hover:text-white xl:hidden"
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                      {renderOutline()}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
