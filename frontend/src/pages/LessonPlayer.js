import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
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
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  LayoutDashboard,
  ChevronLeft,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import useI18n from '@/hooks/useI18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LessonPlayer({ user, onLogout }) {
  const [embeddedPdfUrl, setEmbeddedPdfUrl] = useState(null);

  const isPdfLink = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.includes('.pdf');
  };

  const handleResourceClick = (link, e) => {
    if (isPdfLink(link?.url)) {
      e.preventDefault();
      setEmbeddedPdfUrl(link.url);
    }
  };
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [lesson, setLesson] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [moduleInfo, setModuleInfo] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [nextModuleEntry, setNextModuleEntry] = useState(null);
  const [previousLesson, setPreviousLesson] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});
  const [progressSummary, setProgressSummary] = useState({
    totalLessons: 0,
    totalCompleted: 0,
    coursePercent: 0,
    modulePercentMap: {}
  });
  const [isImmersive, setIsImmersive] = useState(false);
  const [motivationMessage, setMotivationMessage] = useState(null);
  const [completionPulse, setCompletionPulse] = useState(false);
  const [isQuickMenuCollapsed, setIsQuickMenuCollapsed] = useState(false);

  const motivationTimeoutRef = useRef(null);
  const completionPulseTimeoutRef = useRef(null);
  const discussionRef = useRef(null);

  const calculateProgress = (detail) => {
    const modules = detail?.modules ?? [];
    let totalLessons = 0;
    let totalCompleted = 0;
    const modulePercentMap = {};

    modules.forEach((module) => {
      const lessons = module?.lessons ?? [];
      const moduleKey = module.id ?? module.title;
      const completedCount = lessons.filter(
        (lessonItem) => lessonItem.completed || lessonItem.progress === 100
      ).length;

      totalLessons += lessons.length;
      totalCompleted += completedCount;
      const percent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
      modulePercentMap[moduleKey] = {
        completed: completedCount,
        total: lessons.length,
        percent: Math.min(100, Math.max(0, percent))
      };
    });

    const coursePercent = totalLessons
      ? Math.min(100, Math.max(0, Math.round((totalCompleted / totalLessons) * 100)))
      : 0;

    return { totalLessons, totalCompleted, coursePercent, modulePercentMap };
  };

  const enhanceCourseWithProgress = (detail, progressList) => {
    if (!detail?.modules) return detail;

    const progressMap = new Map();
    (progressList || []).forEach((item) => {
      if (!item) return;
      const key = String(item.lesson_id ?? item.lessonId ?? item.id);
      if (!key) return;
      progressMap.set(key, item);
    });

    const modules = detail.modules.map((module) => {
      const lessons = module?.lessons ?? [];
      if (!lessons.length) return module;

      return {
        ...module,
        lessons: lessons.map((lessonItem) => {
          const progress = progressMap.get(String(lessonItem.id));
          if (!progress) {
            return {
              ...lessonItem,
              completed: Boolean(lessonItem.completed || lessonItem.progress === 100),
              progress: lessonItem.progress ?? (lessonItem.completed ? 100 : 0)
            };
          }

          const resolvedProgress =
            progress.progress ??
            progress.progress_percent ??
            progress.progressPercentage ??
            (progress.completed ? 100 : lessonItem.progress ?? 0);

          return {
            ...lessonItem,
            completed: Boolean(progress.completed),
            progress: resolvedProgress,
            estimated_time:
              lessonItem.estimated_time ??
              progress.estimated_time ??
              progress.duration ??
              lessonItem.duration,
            duration: lessonItem.duration
          };
        })
      };
    });

    return { ...detail, modules };
  };

  const handleImmersiveToggle = () => {
    setIsImmersive((prev) => {
      const next = !prev;
      if (next) {
        setOutlineOpen(false);
      } else if (isDesktop) {
        setOutlineOpen(true);
      }
      return next;
    });
  };

  const scrollToDiscussion = () => {
    if (discussionRef.current) {
      discussionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };


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

  useEffect(() => {
    setMotivationMessage(null);
  }, [lessonId]);

  useEffect(
    () => () => {
      if (motivationTimeoutRef.current) {
        clearTimeout(motivationTimeoutRef.current);
      }
      if (completionPulseTimeoutRef.current) {
        clearTimeout(completionPulseTimeoutRef.current);
      }
    },
    []
  );

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

        let detail = detailResponse.data;
        const modules = detail.modules || [];

        const moduleFound = modules.find((module) => module.id === moduleId);
        if (!moduleFound) continue;

        let progressItems = [];
        try {
          const progressResponse = await axios.get(`${API}/progress/${detail.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          progressItems = Array.isArray(progressResponse.data) ? progressResponse.data : [];
        } catch (progressError) {
          console.error('Error fetching progress data:', progressError);
        }

        detail = enhanceCourseWithProgress(detail, progressItems);
        const enhancedModules = detail.modules || [];
        const enhancedModule = enhancedModules.find((module) => module.id === moduleId) ?? moduleFound;

        setCourseData(detail);
        setProgressSummary(calculateProgress(detail));
        setModuleInfo({
          courseId: detail.id,
          courseTitle: detail.title,
          moduleId: enhancedModule.id,
          moduleTitle: enhancedModule.title
        });

        const currentLessonData = enhancedModules
          .flatMap((moduleItem) => moduleItem.lessons || [])
          .find((lessonItem) => String(lessonItem.id) === String(lessonId));
        if (currentLessonData) {
          setIsCompleted(Boolean(currentLessonData.completed || currentLessonData.progress === 100));
        }

        setExpandedModules((previous) => {
          const modulesState = { ...(previous || {}) };
          const modulesList = enhancedModules || [];
          const activeKey = enhancedModule.id ?? enhancedModule.title;

          // Remove modules that no longer exist
          Object.keys(modulesState).forEach((key) => {
            const exists = modulesList.some((item) => (item.id ?? item.title) === key);
            if (!exists) delete modulesState[key];
          });

          // Ensure all modules have an entry
          modulesList.forEach((moduleItem) => {
            const key = moduleItem.id ?? moduleItem.title;
            if (!(key in modulesState)) {
              modulesState[key] = moduleItem.id === enhancedModule.id;
            }
          });

          if (activeKey != null) {
            modulesState[activeKey] = true;
          }

          return modulesState;
        });

        setPreviousLesson(null);
        setNextLesson(null);
        setNextModuleEntry(null);

        let lastVisited = null;
        let foundCurrent = false;

        for (let moduleIndex = 0; moduleIndex < enhancedModules.length; moduleIndex += 1) {
          const module = enhancedModules[moduleIndex];
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
            if (!nextLesson) {
              const upcomingLessons = module.lessons || [];
              const currentIndex = upcomingLessons.findIndex(
                (lessonItem) => String(lessonItem.id) === String(lessonId)
              );
              const localNext = currentIndex >= 0 ? upcomingLessons[currentIndex + 1] : null;
              if (!localNext) {
                const nextModule = enhancedModules[moduleIndex + 1];
                if (nextModule) {
                  const firstLesson = (nextModule.lessons || [])[0];
                  if (firstLesson) {
                    setNextModuleEntry({
                      moduleId: nextModule.id,
                      moduleTitle: nextModule.title,
                      lesson: firstLesson
                    });
                  }
                }
              }
            }
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

  const checkProgress = () => {
    if (!courseData?.modules?.length) {
      setIsCompleted(false);
      return;
    }

    let lessonFound = false;
    let completed = false;

    for (const module of courseData.modules) {
      for (const lessonItem of module.lessons || []) {
        if (String(lessonItem.id) === String(lessonId)) {
          lessonFound = true;
          completed = Boolean(lessonItem.completed || lessonItem.progress === 100);
          break;
        }
      }
      if (lessonFound) break;
    }

    setIsCompleted(completed);
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

  const updateLessonCompletion = async (
    targetCompleted,
    { navigateAfterCompleted = false, force = false, nextLessonId = null } = {}
  ) => {
    try {
      if (!force && targetCompleted === isCompleted && !navigateAfterCompleted) {
        return;
      }

      const token = localStorage.getItem('token');

      await axios.post(
        `${API}/progress`,
        { lesson_id: lessonId, completed: targetCompleted, last_position: 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsCompleted(targetCompleted);

      if (completionPulseTimeoutRef.current) {
        clearTimeout(completionPulseTimeoutRef.current);
      }

      if (targetCompleted) {
        setCompletionPulse(true);
        completionPulseTimeoutRef.current = setTimeout(() => {
          setCompletionPulse(false);
        }, 800);
      } else {
        setCompletionPulse(false);
      }

      let projectedSummary = progressSummary;
      if (courseData) {
        setCourseData((previous) => {
          if (!previous?.modules) return previous;

          const updatedModules = previous.modules.map((module) => {
            const lessons = module?.lessons ?? [];
            if (!lessons.length) return module;

            return {
              ...module,
              lessons: lessons.map((lessonItem) => {
                if (String(lessonItem.id) !== String(lessonId)) return lessonItem;

                const resolvedProgress = targetCompleted ? 100 : 0;

                return {
                  ...lessonItem,
                  completed: targetCompleted,
                  progress: resolvedProgress
                };
              })
            };
          });

          const updatedCourse = { ...previous, modules: updatedModules };
          const summary = calculateProgress(updatedCourse);
          projectedSummary = summary;
          setProgressSummary(summary);
          return updatedCourse;
        });
      }

      if (motivationTimeoutRef.current) {
        clearTimeout(motivationTimeoutRef.current);
      }

      if (targetCompleted) {
        const fallbackSummary = courseData ? calculateProgress(courseData) : progressSummary;
        const totalLessons = projectedSummary.totalLessons || fallbackSummary.totalLessons;
        const completedLessons =
          projectedSummary.totalCompleted || fallbackSummary.totalCompleted || 0;

        if (totalLessons) {
          setMotivationMessage(`Excelente! Você concluiu ${completedLessons}/${totalLessons} aulas 🎉`);
        } else {
          setMotivationMessage('Excelente! Aula concluída 🎉');
        }

        motivationTimeoutRef.current = setTimeout(() => {
          setMotivationMessage(null);
        }, 5000);
      } else {
        setMotivationMessage(null);
      }

      if (moduleInfo) {
        await fetchCourseAndFindNeighbours(moduleInfo.moduleId, token);
      }
      checkProgress();

      if (targetCompleted && navigateAfterCompleted) {
        const destinationId = nextLessonId ?? nextLesson?.id;
        if (destinationId) {
          setTimeout(() => navigate(`/lesson/${destinationId}`), 400);
        } else {
          alert(t('lesson.congratulationsCompleted'));
        }
      }
    } catch (error) {
      console.error('Error updating completion:', error);
    }
  };

  const handleNextLesson = async () => {
    const destinationId = nextLesson?.id ?? nextModuleEntry?.lesson?.id ?? null;
    if (!destinationId) return;
    if (isCompleted) {
      navigate(`/lesson/${destinationId}`);
      return;
    }
    await updateLessonCompletion(true, {
      navigateAfterCompleted: true,
      force: true,
      nextLessonId: destinationId
    });
  };

  const toggleCompleted = async () => {
    await updateLessonCompletion(!isCompleted, { force: true });
  };

  const toggleQuickMenu = () => {
    setIsQuickMenuCollapsed((previous) => !previous);
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

    return courseData.modules.map((module) => {
      const lessons = module?.lessons ?? [];
      const moduleKey = module.id ?? module.title;
      const completedCount = lessons.filter(
        (lessonItem) => lessonItem.completed || lessonItem.progress === 100
      ).length;
      const moduleProgress =
        progressSummary.modulePercentMap[moduleKey] ?? {
          completed: completedCount,
          total: lessons.length,
          percent: lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0
        };
      const isExpanded = expandedModules[moduleKey] ?? module.id === moduleInfo?.moduleId;
      const isModuleCompleted = moduleProgress.total > 0 && moduleProgress.completed === moduleProgress.total;

      return (
        <div
          key={moduleKey}
          className={`glass-panel transition-all duration-300 hover:scale-[1.01] ${
            isModuleCompleted ? 'p-4' : 'p-5'
          }`}
        >
          <button
            type="button"
            onClick={() =>
              setExpandedModules((prev) => ({
                ...prev,
                [moduleKey]: !isExpanded
              }))
            }
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0 space-y-1">
              <h3 className={`text-base font-semibold ${isModuleCompleted ? 'text-emerald-200' : 'text-white'}`}>
                {module.title}
              </h3>
              {isModuleCompleted ? (
                <p className="text-xs font-semibold text-emerald-300">Módulo concluído</p>
              ) : (
                <p className="text-xs text-gray-400">
                  {lessons.length} aulas • {moduleProgress.completed}/{moduleProgress.total} concluídas • {moduleProgress.percent}%
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isModuleCompleted ? 'text-emerald-300' : 'text-gray-300'}`} />
              ) : (
                <ChevronRight className={`h-5 w-5 transition-transform duration-200 ${isModuleCompleted ? 'text-emerald-300' : 'text-gray-300'}`} />
              )}
            </div>
          </button>

          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isModuleCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-blue-500'
              }`}
              style={{ width: `${moduleProgress.percent}%` }}
            />
          </div>

          {isExpanded && (
            <div className="mt-5 space-y-2">
              {lessons.map((lessonItem) => {
                const isActive = String(lessonItem.id) === String(lessonId);
                const completed =
                  lessonItem.completed ||
                  lessonItem.progress === 100 ||
                  (isActive && isCompleted);
                const estimatedTime = lessonItem.duration || lessonItem.estimated_time;
                const shortDescription =
                  lessonItem.short_description || lessonItem.summary || lessonItem.description;

                return (
                  <button
                    type="button"
                    key={lessonItem.id ?? lessonItem.title}
                    onClick={() => navigate(`/lesson/${lessonItem.id}`)}
                    className={`group w-full rounded-2xl border p-3 text-left transition-all duration-300 ${
                      isActive
                        ? 'border-emerald-400/70 bg-gradient-to-r from-emerald-600/20 to-blue-600/10 shadow-[0_8px_30px_rgba(16,185,129,0.25)] scale-[1.01]'
                        : 'border-white/10 bg-white/[0.04] hover:border-emerald-400/40 hover:bg-white/[0.07] hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                          completed
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'bg-gray-500/20 text-gray-400 group-hover:bg-emerald-500/15 group-hover:text-emerald-200'
                        }`}
                      >
                        {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-sm font-semibold transition-colors ${
                              isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'
                            }`}
                          >
                            {lessonItem.title}
                          </p>
                          {estimatedTime && (
                            <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
                              <Clock className="h-3 w-3" />
                              {estimatedTime}
                            </span>
                          )}
                        </div>
                        {shortDescription && (
                          <p className="text-xs text-gray-400">{shortDescription}</p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          {lessonItem.type === 'video' && <Play className="h-3 w-3" />}
                          {lessonItem.type === 'text' && <FileText className="h-3 w-3" />}
                          {lessonItem.type === 'file' && <Download className="h-3 w-3" />}
                          <span className="capitalize">{lessonItem.type}</span>
                          {completed && <span className="text-emerald-300">• Concluída</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const showDesktopOutline = outlineOpen && isDesktop && !isImmersive && !embeddedPdfUrl;
  const showMobileOutline = outlineOpen && !isDesktop && !isImmersive;

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
        {!isImmersive && (
          <>
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
          </>
        )}

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
          <div className={`mx-auto w-full ${embeddedPdfUrl ? 'max-w-none' : 'max-w-7xl'} px-4 pb-16 pt-8 sm:px-6 lg:px-8`}>
            {/* Mobile Navigation */}
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                onClick={() => setOutlineOpen((prev) => !prev)}
                className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm disabled:opacity-50"
                disabled={isImmersive}
              >
                <BookOpen size={16} className="mr-2" />
                {outlineOpen ? t('lesson.closeCourseMap') : t('lesson.courseMap')}
              </Button>
              <Button
                variant="outline"
                onClick={() => (moduleInfo ? navigate(`/course/${moduleInfo.courseId}`) : navigate('/dashboard'))}
                className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm disabled:opacity-50"
                disabled={!moduleInfo}
              >
                <ExternalLink size={16} className="mr-2" />
                {t('lesson.course')}
              </Button>
            </div>


            {motivationMessage && (
              <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-emerald-100 shadow-lg shadow-emerald-500/10">
                <Sparkles className="h-6 w-6 text-emerald-300" />
                <span className="text-sm font-medium">{motivationMessage}</span>
              </div>
            )}

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

                  <div className="space-y-8">
                    {/* Video Content with optional PDF split-view */}
                    {lesson.type === 'video' && (
                      <>
                        {embeddedPdfUrl ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Left: Video */}
                            <div>
                              <div
                                className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-black/70 shadow-[0_20px_60px_rgba(10,20,40,0.65)] transition-all duration-500 ${
                                  isImmersive ? 'ring-2 ring-emerald-400/40' : ''
                                }`}
                              >
                                {isImmersive && (
                                  <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-emerald-400/40 bg-black/60 px-3 py-1 text-xs text-emerald-100 backdrop-blur">
                                    <Sparkles className="h-3 w-3 text-emerald-300" />
                                    Modo imersivo ativo
                                  </div>
                                )}
                                <div
                                  className="video-embed-container aspect-video w-full"
                                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                                />
                                {isImmersive && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleImmersiveToggle}
                                    className="absolute right-4 top-4 z-30 border-white/20 bg-black/40 text-white hover:bg-black/60"
                                  >
                                    <Minimize2 className="mr-2 h-4 w-4" />
                                    Sair
                                  </Button>
                                )}
                              </div>
                            </div>
                            {/* Right: PDF Embed */}
                            <div>
                              <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(10,20,40,0.35)]">
                                <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-gray-200 backdrop-blur">
                                  <FileText className="h-3 w-3 text-emerald-300" />
                                  Arquivo PDF
                                </div>
                                <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (embeddedPdfUrl) {
                                        window.open(embeddedPdfUrl, '_blank', 'noopener,noreferrer');
                                        setEmbeddedPdfUrl(null);
                                      }
                                    }}
                                    className="border-white/20 bg-black/40 text-white hover:bg-black/60"
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Destacar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEmbeddedPdfUrl(null)}
                                    className="border-white/20 bg-black/40 text-white hover:bg-black/60"
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Fechar
                                  </Button>
                                </div>
                                <iframe
                                  src={embeddedPdfUrl}
                                  title="PDF da aula"
                                  className="w-full aspect-video"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div
                              className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-black/70 shadow-[0_20px_60px_rgba(10,20,40,0.65)] transition-all duration-500 ${
                                isImmersive ? 'ring-2 ring-emerald-400/40' : ''
                              }`}
                            >
                              {isImmersive && (
                                <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-emerald-400/40 bg-black/60 px-3 py-1 text-xs text-emerald-100 backdrop-blur">
                                  <Sparkles className="h-3 w-3 text-emerald-300" />
                                  Modo imersivo ativo
                                </div>
                              )}
                              <div
                                className="video-embed-container aspect-video w-full"
                                dangerouslySetInnerHTML={{ __html: lesson.content }}
                              />
                              {isImmersive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleImmersiveToggle}
                                  className="absolute right-4 top-4 z-30 border-white/20 bg-black/40 text-white hover:bg-black/60"
                                >
                                  <Minimize2 className="mr-2 h-4 w-4" />
                                  Sair
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
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
                    <div className="space-y-4">
                      <div className="md:sticky md:top-24 md:z-20 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">Atalhos rápidos</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Play className="h-3 w-3" />
                            <span>{lesson.title}</span>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                          <Button
                            variant="outline"
                            className="w-full items-start justify-start gap-2 border-white/15 bg-white/[0.06] text-left text-white hover:border-emerald-400/40 hover:bg-white/[0.1] disabled:opacity-40 min-h-[88px] whitespace-normal break-words"
                            disabled={!previousLesson}
                            onClick={() => previousLesson && navigate(`/lesson/${previousLesson.id}`)}
                          >
                            <div className="flex flex-col text-left">
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                <ArrowLeft className="h-4 w-4" />
                                Aula anterior
                              </span>
                              <span className="truncate text-xs text-gray-300">
                                {previousLesson ? previousLesson.title : t('lesson.noPreviousLesson')}
                              </span>
                            </div>
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full items-start justify-start gap-2 border-emerald-400/40 bg-emerald-500/10 text-left text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40 min-h-[88px] whitespace-normal break-words"
                            disabled={!nextLesson && !nextModuleEntry}
                            onClick={handleNextLesson}
                          >
                            <div className="flex flex-col text-left">
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                <ArrowRight className="h-4 w-4" />
                                {nextLesson ? 'Próxima' : nextModuleEntry ? 'Próximo módulo' : 'Próxima aula'}
                              </span>
                              <span className="truncate text-xs text-emerald-100/80">
                                {nextLesson
                                  ? nextLesson.title
                                  : nextModuleEntry
                                    ? nextModuleEntry.lesson.title
                                    : t('lesson.noNextLesson')}
                              </span>
                            </div>
                          </Button>
                        </div>
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
                      {lesson.links.map((link, index) => {
                        const isPdf = isPdfLink(link.url);
                        return (
                          <a
                            key={`${link.url}-${index}`}
                            href={link.url}
                            onClick={(e) => handleResourceClick(link, e)}
                            target={isPdf ? undefined : '_blank'}
                            rel={isPdf ? undefined : 'noopener noreferrer'}
                            className="group glass-panel p-4 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400/30"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 group-hover:from-emerald-500/30 group-hover:to-blue-500/30 transition-all">
                                {isPdf ? (
                                  <FileText className="h-6 w-6 text-emerald-400" />
                                ) : (
                                  <ExternalLink className="h-6 w-6 text-emerald-400" />
                                )}
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
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Course Map pushed below when PDF is embedded */}
                {embeddedPdfUrl && outlineOpen && isDesktop && !isImmersive && (
                  <section className="glass-panel p-6 sm:p-8 transition-all">
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white">Mapa do Curso</h3>
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
                    <div className="space-y-4">
                      {renderOutline()}
                    </div>
                  </section>
                )}

                {/* Enhanced Discussion Section */}
                <section
                  ref={discussionRef}
                  className="glass-panel p-6 sm:p-8 transition-all duration-300 hover:scale-[1.01]"
                >
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
                      <div className="space-y-3 flex-1">
                        {progressSummary.totalLessons > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-300">
                              Progresso do curso
                            </p>
                            <div className="h-1 w-full rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all duration-500"
                                style={{ width: `${progressSummary.coursePercent}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-400">
                              {progressSummary.totalCompleted}/{progressSummary.totalLessons} aulas
                            </p>
                          </div>
                        )}
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-white">Mapa do Curso</h3>
                          {moduleInfo && (
                            <p className="text-sm text-gray-400">{moduleInfo.courseTitle}</p>
                          )}
                        </div>
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

        <div className={`fixed bottom-6 right-6 z-40 hidden flex-col md:flex ${isQuickMenuCollapsed ? 'w-[72px]' : 'w-[320px]'}`}>
          <div className={`glass-panel flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl ${isQuickMenuCollapsed ? 'items-center p-3' : 'p-4'}`}>
            <div className={`flex w-full items-center ${isQuickMenuCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isQuickMenuCollapsed && (
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
                  <LayoutDashboard className="h-4 w-4 text-emerald-300" />
                  Menu rápido
                </div>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleQuickMenu}
                className="text-gray-300 hover:text-white"
              >
                {isQuickMenuCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
            <div className={`${isQuickMenuCollapsed ? 'flex flex-col items-center gap-2' : 'flex flex-wrap gap-2 w-full'}`}>
              <Button
                size={isQuickMenuCollapsed ? 'icon' : 'sm'}
                variant="outline"
                className={`border-white/15 bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 ${
                  isQuickMenuCollapsed ? '!w-10 !h-10 justify-center p-0' : ''
                }`}
                onClick={() => {
                  if (isImmersive) {
                    handleImmersiveToggle();
                  }
                  setOutlineOpen(true);
                }}
                disabled={!courseData?.modules?.length}
              >
                <BookOpen className="h-4 w-4" />
                {!isQuickMenuCollapsed && <span>Mapa</span>}
              </Button>
              <Button
                size={isQuickMenuCollapsed ? 'icon' : 'sm'}
                variant="outline"
                className={`border-white/15 bg-white/10 text-white hover:bg-white/20 ${
                  isQuickMenuCollapsed ? '!w-10 !h-10 justify-center p-0' : ''
                }`}
                onClick={scrollToDiscussion}
              >
                <MessageCircle className="h-4 w-4" />
                {!isQuickMenuCollapsed && <span>Comentários</span>}
              </Button>
              <Button
                size={isQuickMenuCollapsed ? 'icon' : 'sm'}
                variant="outline"
                className={`border-white/15 bg-white/10 text-white hover:bg-white/20 ${
                  isQuickMenuCollapsed ? '!w-10 !h-10 justify-center p-0' : ''
                }`}
                onClick={handleImmersiveToggle}
              >
                {isImmersive ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
                {!isQuickMenuCollapsed && <span>{isImmersive ? 'Sair modo imersivo' : 'Modo imersivo'}</span>}
              </Button>
              <Button
                size={isQuickMenuCollapsed ? 'icon' : 'sm'}
                className={`bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600 ${
                  isQuickMenuCollapsed ? '!w-10 !h-10 justify-center p-0' : ''
                }`}
                onClick={toggleCompleted}
              >
                {isCompleted ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {!isQuickMenuCollapsed && (isCompleted ? <span>Desmarcar</span> : <span>Concluir</span>)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
