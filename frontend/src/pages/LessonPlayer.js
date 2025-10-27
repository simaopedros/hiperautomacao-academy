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
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LessonPlayer({ user, onLogout }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();

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
    if (!window.confirm('Excluir este comentario?')) return;
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
        alert('Parabens! Voce concluiu todas as aulas disponiveis!');
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
      return <p className="text-sm text-gray-500">Mapa ainda nao disponivel.</p>;
    }

    return courseData.modules.map((module) => (
      <div key={module.id ?? module.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{module.title}</p>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500">
              {(module.lessons || []).length} aulas
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {(module.lessons || []).map((lessonItem) => {
            const isActive = String(lessonItem.id) === String(lessonId);
            const completed = lessonItem.completed || lessonItem.progress === 100;

            return (
              <button
                type="button"
                key={lessonItem.id}
                onClick={() => navigate(`/lesson/${lessonItem.id}`)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-[0_8px_30px_rgba(16,185,129,0.28)]'
                    : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-emerald-400/50 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {completed ? (
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  ) : (
                    <Circle size={14} className="text-gray-500" />
                  )}
                  <span className="truncate">{lessonItem.title}</span>
                </span>
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
      <div className="flex min-h-screen items-center justify-center bg-[#02060f] text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#02060f] text-white">
        <p className="text-gray-400">Aula nao encontrada.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#02060f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.17),_transparent_58%)]" />
      <div className="pointer-events-none absolute -left-20 top-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-[150px]" />
      <div className="pointer-events-none absolute -right-28 bottom-16 h-80 w-80 rounded-full bg-blue-500/20 blur-[150px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#040914]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
                Aula
              </span>
              {moduleInfo && (
                <div className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
                  <span className="truncate">{moduleInfo.courseTitle}</span>
                  <span className="text-gray-600">/</span>
                  <span className="truncate">{moduleInfo.moduleTitle}</span>
                  <span className="text-gray-600">/</span>
                  <span className="truncate text-white">{lesson.title}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="hidden text-gray-300 hover:text-white sm:inline-flex"
              >
                <ArrowLeft size={16} className="mr-1" />
                Voltar
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-white/10 text-white hover:bg-white/10"
              >
                <Home size={16} className="mr-2" />
                Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => setOutlineOpen((prev) => !prev)}
                className="hidden border-white/10 text-white hover:bg-white/10 md:inline-flex"
              >
                {outlineOpen ? 'Ocultar mapa' : 'Mapa do curso'}
              </Button>
              <Button
                onClick={() => (moduleInfo ? navigate(`/course/${moduleInfo.courseId}`) : navigate('/dashboard'))}
                className="hidden bg-emerald-500 hover:bg-emerald-600 md:inline-flex"
                disabled={!moduleInfo}
              >
                <BookOpen size={16} className="mr-2" />
                {moduleInfo ? 'Ver curso' : 'Curso'}
              </Button>
            </div>
          </div>
        </header>

        {showMobileOutline && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-[#050b16]"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 16px)',
              paddingLeft: 'max(env(safe-area-inset-left), 16px)',
              paddingRight: 'max(env(safe-area-inset-right), 16px)',
              width: '100vw',
              maxWidth: '100vw',
              boxSizing: 'border-box'
            }}
          >
            <button
              type="button"
              onClick={() => setOutlineOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold text-gray-200 shadow focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              Fechar
            </button>
            <div className="px-6 pt-12">
              <p className="text-[11px] uppercase tracking-[0.45em] text-gray-500">Mapa do curso</p>
              {moduleInfo && (
                <p className="mt-1 text-lg font-semibold text-white">{moduleInfo.courseTitle}</p>
              )}
            </div>
            <div className="mt-4 flex-1 overflow-y-auto px-6 pb-12">
              <div className="space-y-4">{renderOutline()}</div>
            </div>
          </div>
        )}

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                onClick={() => setOutlineOpen((prev) => !prev)}
                className="flex-1 border-white/15 text-white hover:bg-white/10"
              >
                {outlineOpen ? 'Fechar mapa' : 'Mapa do curso'}
              </Button>
              <Button
                variant="outline"
                onClick={() => (moduleInfo ? navigate(`/course/${moduleInfo.courseId}`) : navigate('/dashboard'))}
                className="flex-1 border-white/15 text-white hover:bg-white/10"
                disabled={!moduleInfo}
              >
                Curso
              </Button>
            </div>

            <div className={showDesktopOutline ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-8'}>
              <section className="space-y-8 sm:space-y-10">
                <article className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 shadow-[0_35px_160px_rgba(4,15,32,0.65)] sm:px-8 sm:py-8">
                  <div className="flex flex-col gap-6">
                    {lesson.type === 'video' && (
                      <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_45px_160px_rgba(6,24,44,0.7)]">
                        <div
                          className="video-embed-container aspect-video w-full"
                          dangerouslySetInnerHTML={{ __html: lesson.content }}
                        />
                      </div>
                    )}

                    {lesson.type === 'text' && (
                      <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-lg leading-relaxed text-gray-200 whitespace-pre-wrap">
                        {lesson.content}
                      </div>
                    )}

                    {lesson.type === 'file' && (
                      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500/15 to-blue-500/15 p-8 text-center">
                        <a
                          href={lesson.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600"
                        >
                          <Download size={20} />
                          Baixar material
                        </a>
                      </div>
                    )}

                    {lesson.description && (
                      <p className="text-base leading-relaxed text-gray-300">
                        {lesson.description}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                        <Button
                          data-testid="mark-completed-button"
                          onClick={toggleCompleted}
                          className={`w-full justify-center rounded-2xl py-3 text-base font-semibold transition-all sm:w-auto sm:px-6 ${
                            isCompleted
                              ? 'bg-black/30 border border-emerald-400 text-emerald-200 hover:bg-black/40'
                              : 'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                        >
                          {isCompleted ? 'Aula concluida - desmarcar?' : 'Marcar como concluida'}
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/15 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!previousLesson}
                          onClick={() => previousLesson && navigate(`/lesson/${previousLesson.id}`)}
                        >
                          {previousLesson ? `Anterior: ${previousLesson.title}` : 'Sem aula anterior'}
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!nextLesson}
                          onClick={() => nextLesson && navigate(`/lesson/${nextLesson.id}`)}
                        >
                          {nextLesson ? `Proxima: ${nextLesson.title}` : 'Sem proxima aula'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>

                {lesson.links?.length > 0 && (
                  <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(6,24,44,0.55)] sm:p-8">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Download size={20} className="text-emerald-300" />
                        Recursos adicionais
                      </h2>
                      <span className="text-xs text-gray-500">{lesson.links.length} itens</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {lesson.links.map((link, index) => (
                        <a
                          key={`${link.url}-${index}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-gray-200 transition-colors hover:border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                              <Download size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{link.title || link.url}</p>
                              <p className="truncate text-xs text-gray-400">{link.url}</p>
                            </div>
                          </div>
                          <ArrowLeft size={16} className="rotate-180 text-emerald-300" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(6,24,44,0.55)] sm:p-8">
                  <div className="mb-6 flex items-center gap-2">
                    <MessageCircle size={24} className="text-emerald-300" />
                    <h2 className="text-2xl font-bold text-white">Discussao</h2>
                  </div>

                  <form onSubmit={handleCommentSubmit} className="mb-6 space-y-3">
                    {replyTo && (
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300">
                        <span>
                          Respondendo a <span className="text-emerald-300">{replyTo.user_name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyTo(null)}
                          className="text-red-300 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    <Textarea
                      data-testid="comment-input"
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder="Compartilhe sua duvida ou contribuicao..."
                      rows={3}
                      className="border border-white/10 bg-black/30 text-white focus-visible:ring-emerald-400"
                    />
                    <Button
                      data-testid="submit-comment"
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      disabled={!newComment.trim()}
                    >
                      <Send size={16} className="mr-2" />
                      Enviar
                    </Button>
                  </form>

                  <div className="max-h-[600px] space-y-4 overflow-y-auto pr-1">
                    {organizeComments().map((comment) => (
                      <div
                        key={comment.id}
                        data-testid={`comment-${comment.id}`}
                        className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold">
                              {comment.user_name[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-white">{comment.user_name}</span>
                          </div>
                          {(comment.user_id === user.id || user.role === 'admin') && (
                            <button
                              onClick={() => handleDelete(comment.id)}
                              className="text-red-300 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-200">{comment.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <button
                            onClick={() => handleLike(comment.id)}
                            className="flex items-center gap-1 transition-colors hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          >
                            <ThumbsUp size={14} />
                            <span>{comment.likes}</span>
                          </button>
                          <button
                            onClick={() => setReplyTo(comment)}
                            className="transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          >
                            Responder
                          </button>
                        </div>

                        {comment.replies?.length > 0 && (
                          <div className="space-y-2 border-t border-white/10 pt-3">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
                                      {reply.user_name[0].toUpperCase()}
                                    </div>
                                    <span className="text-xs font-semibold text-white">{reply.user_name}</span>
                                  </div>
                                  {(reply.user_id === user.id || user.role === 'admin') && (
                                    <button
                                      onClick={() => handleDelete(reply.id)}
                                      className="text-red-300 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-gray-200">{reply.content}</p>
                                <button
                                  onClick={() => handleLike(reply.id)}
                                  className="mt-2 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                >
                                  <ThumbsUp size={12} />
                                  <span>{reply.likes}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </section>

              {showDesktopOutline && (
                <aside className="space-y-6">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_rgba(6,24,44,0.55)] xl:sticky xl:top-24">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.45em] text-gray-500">Mapa do curso</p>
                        {moduleInfo && (
                          <p className="mt-1 text-sm font-semibold text-white">{moduleInfo.courseTitle}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOutlineOpen(false)}
                        className="text-xs text-gray-500 transition-colors hover:text-white xl:hidden"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="space-y-4">{renderOutline()}</div>
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
