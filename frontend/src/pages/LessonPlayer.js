import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MessageCircle, ThumbsUp, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LessonPlayer({ user, onLogout }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLesson();
    fetchComments();
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLesson(response.data);
      
      // Fetch full course data to find next lesson
      await fetchCourseAndFindNext(response.data.module_id, token);
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseAndFindNext = async (moduleId, token) => {
    try {
      // Get module to find course
      const modulesResponse = await axios.get(`${API}/admin/modules/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Find the course by checking all modules
      let currentCourseId = null;
      for (const mod of modulesResponse.data) {
        if (mod.id === moduleId) {
          currentCourseId = mod.course_id;
          break;
        }
      }
      
      if (!currentCourseId) return;
      
      // Get full course data with modules and lessons
      const courseResponse = await axios.get(`${API}/student/courses/${currentCourseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCourseData(courseResponse.data);
      
      // Find current lesson and next lesson
      const modules = courseResponse.data.modules || [];
      let foundCurrent = false;
      
      for (const module of modules) {
        const lessons = module.lessons || [];
        for (let i = 0; i < lessons.length; i++) {
          if (foundCurrent) {
            setNextLesson(lessons[i]);
            return;
          }
          if (lessons[i].id === lessonId) {
            foundCurrent = true;
            // Check if there's a next lesson in same module
            if (i < lessons.length - 1) {
              setNextLesson(lessons[i + 1]);
              return;
            }
          }
        }
      }
      
      // If no next lesson found, set to null
      setNextLesson(null);
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

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
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
    if (!window.confirm('Excluir este comentário?')) return;
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

  const markAsCompleted = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/progress`,
        { lesson_id: lessonId, completed: true, last_position: 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking as completed:', error);
    }
  };

  const organizeComments = () => {
    const topLevel = comments.filter(c => !c.parent_id);
    const replies = comments.filter(c => c.parent_id);
    
    return topLevel.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_id === comment.id)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-400">Aula não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button
            data-testid="back-to-course"
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar ao Curso
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Lesson */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">{lesson.title}</h1>
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-emerald-500/20 text-emerald-400 text-sm px-3 py-1 rounded-full">
                  {lesson.type}
                </span>
                {lesson.duration > 0 && (
                  <span className="text-gray-400 text-sm">
                    {Math.floor(lesson.duration / 60)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            {/* Content Display */}
            {lesson.type === 'video' && (
              <div className="w-full mb-6">
                <div 
                  className="video-embed-container"
                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                />
              </div>
            )}
            
            {lesson.type === 'text' && (
              <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl overflow-hidden p-8 prose prose-invert max-w-none">
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {lesson.content}
                </div>
              </div>
            )}
            
            {lesson.type === 'file' && (
              <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl overflow-hidden p-8 text-center">
                <a
                  href={lesson.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Download size={20} />
                  Baixar Material
                </a>
              </div>
            )}

            <Button
              data-testid="mark-completed-button"
              onClick={markAsCompleted}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              Marcar como Concluído
            </Button>
          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1">
            <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <MessageCircle size={24} className="text-emerald-400" />
                <h2 className="text-2xl font-bold text-white">Discussões</h2>
              </div>

              {/* Comment Form */}
              <form onSubmit={handleCommentSubmit} className="mb-6">
                {replyTo && (
                  <div className="bg-[#252525] p-3 rounded-lg mb-3 flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      Respondendo a <span className="text-emerald-400">{replyTo.user_name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                <Textarea
                  data-testid="comment-input"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Deixe seu comentário..."
                  rows={3}
                  className="bg-[#111111] border-[#2a2a2a] text-white mb-3"
                />
                <Button
                  data-testid="submit-comment"
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                  disabled={!newComment.trim()}
                >
                  <Send size={16} className="mr-2" />
                  Enviar
                </Button>
              </form>

              {/* Comments List */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {organizeComments().map((comment) => (
                  <div key={comment.id} data-testid={`comment-${comment.id}`} className="space-y-3">
                    {/* Main Comment */}
                    <div className="bg-[#111111] rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {comment.user_name[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-white text-sm">{comment.user_name}</span>
                        </div>
                        {(comment.user_id === user.id || user.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{comment.content}</p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLike(comment.id)}
                          className="flex items-center gap-1 text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          <ThumbsUp size={14} />
                          <span className="text-xs">{comment.likes}</span>
                        </button>
                        <button
                          onClick={() => setReplyTo(comment)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          Responder
                        </button>
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies?.length > 0 && (
                      <div className="ml-8 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="bg-[#0f0f0f] rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                  {reply.user_name[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-white text-xs">{reply.user_name}</span>
                              </div>
                              {(reply.user_id === user.id || user.role === 'admin') && (
                                <button
                                  onClick={() => handleDelete(reply.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <p className="text-gray-300 text-xs">{reply.content}</p>
                            <button
                              onClick={() => handleLike(reply.id)}
                              className="flex items-center gap-1 text-gray-400 hover:text-emerald-400 transition-colors mt-2"
                            >
                              <ThumbsUp size={12} />
                              <span className="text-xs">{reply.likes}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Download } from 'lucide-react';