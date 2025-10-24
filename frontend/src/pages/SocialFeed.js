import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, ThumbsUp, BookOpen, LogOut, Send, Users, TrendingUp, Filter, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SocialFeed({ user, onLogout }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [postReplies, setPostReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [showPostDetail, setShowPostDetail] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeed();
  }, [filter]);

  const fetchFeed = async () => {
    try {
      const token = localStorage.getItem('token');
      const filterParam = filter !== 'all' ? `?filter=${filter}` : '';
      const response = await axios.get(`${API}/social/feed${filterParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeed(response.data);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLesson = async (lessonId) => {
    try {
      const token = localStorage.getItem('token');
      // Try to fetch lesson details - this will fail if user doesn't have access
      await axios.get(`${API}/student/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If successful, navigate to the lesson
      navigate(`/lesson/${lessonId}`);
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Você precisa estar matriculado neste curso para acessar esta aula');
      } else if (error.response?.status === 404) {
        alert('Aula não encontrada');
      } else {
        console.error('Error accessing lesson:', error);
        alert('Erro ao acessar a aula. Tente novamente.');
      }
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/comments`,
        {
          content: newPostContent,
          lesson_id: null,
          parent_id: null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPostContent('');
      setShowCreatePost(false);
      fetchFeed();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/comments/${commentId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFeed();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const fetchPostDetail = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/social/post/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedPost(response.data.post);
      setPostReplies(response.data.replies);
      setShowPostDetail(true);
    } catch (error) {
      console.error('Error fetching post detail:', error);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedPost) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/comments`,
        {
          content: replyContent,
          lesson_id: selectedPost.lesson_id,
          parent_id: selectedPost.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyContent('');
      fetchPostDetail(selectedPost.id);
      fetchFeed();
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-8 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold gradient-text">Hiperautomação</h1>
              <nav className="hidden md:flex gap-4 lg:gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm lg:text-base"
                >
                  <BookOpen size={18} className="lg:w-5 lg:h-5" />
                  <span className="hidden lg:inline">Meus Cursos</span>
                  <span className="lg:hidden">Cursos</span>
                </button>
                <button
                  data-testid="social-feed-nav"
                  className="flex items-center gap-2 text-emerald-400 font-medium text-sm lg:text-base"
                >
                  <MessageCircle size={18} className="lg:w-5 lg:h-5" />
                  <span className="hidden lg:inline">Comunidade</span>
                  <span className="lg:hidden">Social</span>
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base">
                  {user.name[0].toUpperCase()}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-semibold text-white text-sm">{user.name}</p>
                  <p className="text-xs text-gray-400">Membro</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              >
                <LogOut size={18} className="sm:w-5 sm:h-5 text-gray-400 hover:text-red-400" />
              </button>
            </div>
          </div>
          
          {/* Mobile Navigation */}
          <nav className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs bg-[#1a1a1a] px-3 py-1.5 rounded-full whitespace-nowrap"
            >
              <BookOpen size={14} />
              Cursos
            </button>
            <button
              data-testid="social-feed-nav-mobile"
              className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs bg-emerald-500/10 px-3 py-1.5 rounded-full whitespace-nowrap"
            >
              <MessageCircle size={14} />
              Social
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Create Post Button */}
            <Button
              onClick={() => setShowCreatePost(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-6"
            >
              <Plus size={20} className="mr-2" />
              Nova Discussão
            </Button>

            {/* Filters */}
            <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={18} className="text-emerald-400" />
                <h3 className="font-semibold text-white">Filtros</h3>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    filter === 'all'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  Tudo
                </button>
                <button
                  onClick={() => setFilter('discussions')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    filter === 'discussions'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  Discussões
                </button>
                <button
                  onClick={() => setFilter('lessons')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    filter === 'lessons'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  Aulas
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-emerald-400" />
                <h3 className="font-semibold text-white">Comunidade Ativa</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{feed.length}</p>
              <p className="text-xs text-gray-400 mt-1">discussões em andamento</p>
            </div>
          </div>

          {/* Feed */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Feed da Comunidade</h2>
                <p className="text-gray-400">Participe das discussões e aprenda junto</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : feed.length === 0 ? (
              <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
                <MessageCircle size={64} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg mb-2">Nenhuma discussão ainda</p>
                <p className="text-gray-500 text-sm">Seja o primeiro a iniciar uma conversa!</p>
                <Button
                  onClick={() => setShowCreatePost(true)}
                  className="mt-4 bg-emerald-500 hover:bg-emerald-600"
                >
                  Criar Discussão
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {feed.map((post) => (
                  <div
                    key={post.id}
                    data-testid={`feed-item-${post.id}`}
                    className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer animate-fade-in"
                    onClick={() => fetchPostDetail(post.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {post.user_name[0].toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-white">{post.user_name}</span>
                          <span className="text-gray-500 text-sm">{formatDate(post.created_at)}</span>
                          {!post.lesson_id && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full">
                              Discussão
                            </span>
                          )}
                        </div>
                        <p className="text-gray-200 mb-4 leading-relaxed">{post.content}</p>

                        {/* Actions */}
                        <div className="flex items-center gap-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike(post.id);
                            }}
                            className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors group"
                          >
                            <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors">
                              <ThumbsUp size={18} />
                            </div>
                            <span className="text-sm font-medium">{post.likes}</span>
                          </button>
                          <button
                            className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors group"
                          >
                            <div className="p-2 rounded-full group-hover:bg-cyan-500/10 transition-colors">
                              <MessageCircle size={18} />
                            </div>
                            <span className="text-sm font-medium">{post.replies_count || 0} respostas</span>
                          </button>
                          {post.lesson_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewLesson(post.lesson_id);
                              }}
                              className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors group"
                            >
                              <div className="p-2 rounded-full group-hover:bg-purple-500/10 transition-colors">
                                <BookOpen size={18} />
                              </div>
                              <span className="text-sm font-medium">Ver aula</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Post Dialog */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nova Discussão</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {user.name[0].toUpperCase()}
              </div>
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Compartilhe suas ideias, dúvidas ou conhecimento com a comunidade..."
                rows={6}
                className="bg-[#111111] border-[#2a2a2a] text-white flex-1"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePost(false)}
                className="border-[#2a2a2a] hover:bg-[#252525]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600"
                disabled={!newPostContent.trim()}
              >
                <Send size={16} className="mr-2" />
                Publicar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post Detail Dialog */}
      <Dialog open={showPostDetail} onOpenChange={setShowPostDetail}>
        <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Discussão</DialogTitle>
              </DialogHeader>

              {/* Original Post */}
              <div className="bg-[#111111] rounded-xl p-6 border border-[#252525]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {selectedPost.user_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-white">{selectedPost.user_name}</span>
                      <span className="text-gray-500 text-sm">{formatDate(selectedPost.created_at)}</span>
                    </div>
                    <p className="text-gray-200 leading-relaxed">{selectedPost.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-[#252525]">
                  <button
                    onClick={() => handleLike(selectedPost.id)}
                    className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors"
                  >
                    <ThumbsUp size={18} />
                    <span className="text-sm">{selectedPost.likes}</span>
                  </button>
                  <div className="flex items-center gap-2 text-gray-400">
                    <MessageCircle size={18} />
                    <span className="text-sm">{postReplies.length} respostas</span>
                  </div>
                </div>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleReply} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.name[0].toUpperCase()}
                  </div>
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    rows={3}
                    className="bg-[#111111] border-[#2a2a2a] text-white flex-1"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600"
                    disabled={!replyContent.trim()}
                  >
                    <Send size={16} className="mr-2" />
                    Responder
                  </Button>
                </div>
              </form>

              {/* Replies */}
              <div className="space-y-4 mt-6">
                <h3 className="font-semibold text-white text-lg">Respostas ({postReplies.length})</h3>
                {postReplies.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma resposta ainda. Seja o primeiro!</p>
                ) : (
                  postReplies.map((reply) => (
                    <div key={reply.id} className="bg-[#111111] rounded-lg p-4 border border-[#252525]">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {reply.user_name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-white">{reply.user_name}</span>
                            <span className="text-gray-500 text-xs">{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="text-gray-300 text-sm">{reply.content}</p>
                          <button
                            onClick={() => handleLike(reply.id)}
                            className="flex items-center gap-1 text-gray-400 hover:text-emerald-400 transition-colors mt-2"
                          >
                            <ThumbsUp size={14} />
                            <span className="text-xs">{reply.likes}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}