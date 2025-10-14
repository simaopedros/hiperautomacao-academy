import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, ThumbsUp, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SocialFeed({ user, onLogout }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/social/feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeed(response.data);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
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
      console.error('Error liking comment:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // diff in seconds

    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold gradient-text">Hiperautomação</h1>
            <nav className="flex gap-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <BookOpen size={20} />
                Meus Cursos
              </button>
              <button
                data-testid="social-feed-nav"
                className="flex items-center gap-2 text-emerald-400 font-medium"
              >
                <MessageCircle size={20} />
                Social
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Bem-vindo,</p>
              <p className="font-semibold text-white">{user.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-white mb-3">Feed Social</h2>
          <p className="text-gray-400 text-lg">Veja as últimas discussões da comunidade</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <MessageCircle size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma discussão ainda</p>
            <p className="text-gray-500 text-sm mt-2">Seja o primeiro a comentar nas aulas!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((comment) => (
              <div
                key={comment.id}
                data-testid={`feed-item-${comment.id}`}
                className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 hover:border-emerald-500/30 transition-all animate-fade-in"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {comment.user_name[0].toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-white">{comment.user_name}</span>
                      <span className="text-gray-500 text-sm">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-gray-300 mb-4 leading-relaxed">{comment.content}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleLike(comment.id)}
                        className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors"
                      >
                        <ThumbsUp size={18} />
                        <span className="text-sm font-medium">{comment.likes}</span>
                      </button>
                      <button
                        onClick={() => navigate(`/lesson/${comment.lesson_id}`)}
                        className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors"
                      >
                        <MessageCircle size={18} />
                        <span className="text-sm font-medium">Ver aula</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}