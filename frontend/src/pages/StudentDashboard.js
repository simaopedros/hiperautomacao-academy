import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, LogOut, MessageCircle, Play, Clock, Coins, History } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StudentDashboard({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCredits, setUserCredits] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
    fetchCredits();
  }, []);

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/student/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCredits(response.data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold gradient-text">Hiperautomação</h1>
            <nav className="flex gap-6">
              <button
                data-testid="courses-nav"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-emerald-400 font-medium"
              >
                <BookOpen size={20} />
                Meus Cursos
              </button>
              <button
                data-testid="social-nav"
                onClick={() => navigate('/social')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
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
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={20} className="text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Credits Banner */}
      {userCredits && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 border-b border-emerald-500">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="bg-white/20 p-4 rounded-xl">
                  <Coins size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm mb-1">Seu Saldo de Créditos</p>
                  <p className="text-4xl font-bold text-white">{userCredits.balance}</p>
                  <p className="text-emerald-100 text-sm mt-1">créditos disponíveis</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/credit-history')}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <History size={18} />
                  Histórico
                </button>
                <button
                  onClick={() => navigate('/buy-credits')}
                  className="flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-600 px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  <Coins size={18} />
                  Comprar Créditos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-3">Cursos Disponíveis</h2>
          <p className="text-gray-400 text-lg">Escolha um curso e comece a aprender agora</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-gray-400 mt-4">Carregando cursos...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhum curso disponível no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <div
                key={course.id}
                data-testid={`course-card-${course.id}`}
                className="card cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/course/${course.id}`)}
              >
                {/* Course Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center relative overflow-hidden">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Play size={64} className="text-white/70" />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                </div>

                {/* Course Info */}
                <div className="p-6">
                  {course.category && (
                    <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                      {course.category}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock size={16} />
                      <span>Ver curso</span>
                    </div>
                    <button
                      className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/course/${course.id}`);
                      }}
                    >
                      Acessar →
                    </button>
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