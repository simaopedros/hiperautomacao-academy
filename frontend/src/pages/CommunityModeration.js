import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, Trash2, Users, TrendingUp, Filter, Search, AlertTriangle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CommunityModeration({ user, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [postReplies, setPostReplies] = useState([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalComments: 0,
    activeUsers: 0,
    todayPosts: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
  }, [filter]);

  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch all posts
      const filterParam = filter !== 'all' ? `?filter=${filter}` : '';
      const postsResponse = await axios.get(`${API}/social/feed${filterParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(postsResponse.data);

      // Fetch users
      const usersResponse = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(usersResponse.data);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayPosts = postsResponse.data.filter(p => {
        const postDate = new Date(p.created_at);
        return postDate >= today;
      }).length;

      const totalComments = postsResponse.data.reduce((sum, p) => sum + (p.replies_count || 0), 0);
      
      // Get unique users who posted
      const activeUserIds = new Set(postsResponse.data.map(p => p.user_id));

      setStats({
        totalPosts: postsResponse.data.length,
        totalComments: totalComments,
        activeUsers: activeUserIds.size,
        todayPosts: todayPosts
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
      setShowDetailDialog(true);
    } catch (error) {
      console.error('Error fetching post detail:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta publicação e todas as suas respostas?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/comments/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchAllData();
      setShowDetailDialog(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Erro ao excluir publicação');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Tem certeza que deseja excluir este comentário?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh post detail
      if (selectedPost) {
        fetchPostDetail(selectedPost.id);
      }
      fetchAllData();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Erro ao excluir comentário');
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Usuário';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredPosts = posts.filter(post => {
    if (!searchTerm) return true;
    return post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
           post.user_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft size={20} className="mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Moderação da Comunidade</h1>
              <p className="text-sm text-gray-400">Gerencie discussões e comentários</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageCircle className="text-emerald-400" size={24} />
              <h3 className="font-semibold text-white">Total de Posts</h3>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{stats.totalPosts}</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageCircle className="text-cyan-400" size={24} />
              <h3 className="font-semibold text-white">Comentários</h3>
            </div>
            <p className="text-3xl font-bold text-cyan-400">{stats.totalComments}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-purple-400" size={24} />
              <h3 className="font-semibold text-white">Usuários Ativos</h3>
            </div>
            <p className="text-3xl font-bold text-purple-400">{stats.activeUsers}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-yellow-400" size={24} />
              <h3 className="font-semibold text-white">Posts Hoje</h3>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{stats.todayPosts}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por conteúdo ou usuário..."
                  className="pl-10 bg-[#111111] border-[#2a2a2a] text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setFilter('all')}
                variant={filter === 'all' ? 'default' : 'outline'}
                className={filter === 'all' ? 'bg-emerald-500' : 'border-[#2a2a2a]'}
              >
                Todos
              </Button>
              <Button
                onClick={() => setFilter('discussions')}
                variant={filter === 'discussions' ? 'default' : 'outline'}
                className={filter === 'discussions' ? 'bg-emerald-500' : 'border-[#2a2a2a]'}
              >
                Discussões
              </Button>
              <Button
                onClick={() => setFilter('lessons')}
                variant={filter === 'lessons' ? 'default' : 'outline'}
                className={filter === 'lessons' ? 'bg-emerald-500' : 'border-[#2a2a2a]'}
              >
                Aulas
              </Button>
            </div>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <MessageCircle size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma publicação encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                        {post.user_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{post.user_name}</p>
                        <p className="text-xs text-gray-500">{formatDate(post.created_at)}</p>
                      </div>
                      {!post.lesson_id && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full">
                          Discussão
                        </span>
                      )}
                      {post.lesson_id && (
                        <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded-full">
                          Aula
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-300 mb-4 line-clamp-3">{post.content}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <MessageCircle size={16} />
                        {post.replies_count || 0} respostas
                      </span>
                      <span>{post.likes} curtidas</span>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => fetchPostDetail(post.id)}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                    >
                      Ver Detalhes
                    </Button>
                    <Button
                      onClick={() => handleDeletePost(post.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Post Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Detalhes da Publicação</DialogTitle>
              </DialogHeader>

              {/* Original Post */}
              <div className="bg-[#111111] rounded-xl p-6 border border-[#252525] mb-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {selectedPost.user_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-white">{selectedPost.user_name}</p>
                        <p className="text-sm text-gray-400">{formatDate(selectedPost.created_at)}</p>
                      </div>
                      <Button
                        onClick={() => handleDeletePost(selectedPost.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Excluir Post
                      </Button>
                    </div>
                    <p className="text-gray-200 leading-relaxed">{selectedPost.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-[#252525]">
                  <div className="flex items-center gap-2 text-gray-400">
                    <MessageCircle size={18} />
                    <span className="text-sm">{postReplies.length} respostas</span>
                  </div>
                  <div className="text-gray-400 text-sm">{selectedPost.likes} curtidas</div>
                </div>
              </div>

              {/* Replies */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                  <MessageCircle size={20} />
                  Respostas ({postReplies.length})
                </h3>
                
                {postReplies.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nenhuma resposta</p>
                ) : (
                  postReplies.map((reply) => (
                    <div key={reply.id} className="bg-[#111111] rounded-lg p-4 border border-[#252525]">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {reply.user_name[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-white">{reply.user_name}</span>
                              <span className="text-xs text-gray-500">{formatDate(reply.created_at)}</span>
                            </div>
                            <p className="text-gray-300 text-sm mb-2">{reply.content}</p>
                            <div className="text-xs text-gray-500">{reply.likes} curtidas</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDeleteComment(reply.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </Button>
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
