import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, LogOut, Plus, Edit, Trash2, FolderOpen, FileText, Users, MessageCircle, Gift, CreditCard, Package, Settings, DollarSign, ChevronDown, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function CourseList({ onLogout, user }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showFinanceMenu, setShowFinanceMenu] = useState(false);
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    category: '',
    published: false,
    price_brl: 0,
    price_credits: 50,
    hotmart_product_id: '',
    hotmart_checkout_url: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = () => {
      setShowFinanceMenu(false);
      setShowSystemMenu(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editingCourse) {
        await axios.put(`${API}/admin/courses/${editingCourse.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/admin/courses`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowDialog(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', thumbnail_url: '', category: '', published: false, price_brl: 0, price_credits: 50, hotmart_product_id: '', hotmart_checkout_url: '' });
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url || '',
      category: course.category || '',
      published: course.published,
      price_brl: course.price_brl || 0,
      price_credits: course.price_credits || 50,
      hotmart_product_id: course.hotmart_product_id || '',
      hotmart_checkout_url: course.hotmart_checkout_url || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (courseId) => {
    if (!window.confirm('Tem certeza que deseja excluir este curso?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold gradient-text">Hiperautomação Admin</h1>
            <nav className="flex gap-6">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <BookOpen size={20} />
                Cursos
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Users size={20} />
                Usuários
              </button>
              <button
                onClick={() => navigate('/admin/community')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <MessageCircle size={20} />
                Comunidade
              </button>
              
              {/* Financeiro Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFinanceMenu(!showFinanceMenu);
                    setShowSystemMenu(false);
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <DollarSign size={20} />
                  Financeiro
                  <ChevronDown size={16} />
                </button>
                {showFinanceMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[200px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/finance');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <DollarSign size={16} />
                      Finanças
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/gateway');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      Gateway
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/payment-settings');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <Settings size={16} />
                      Config. Pagamentos
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/credit-packages');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <Package size={16} />
                      Pacotes de Créditos
                    </button>
                  </div>
                )}
              </div>

              {/* Sistema Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSystemMenu(!showSystemMenu);
                    setShowFinanceMenu(false);
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Settings size={20} />
                  Sistema
                  <ChevronDown size={16} />
                </button>
                {showSystemMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[200px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/email-settings');
                        setShowSystemMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <Mail size={16} />
                      Config. Email
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/gamification');
                        setShowSystemMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <Gift size={16} />
                      Gamificação
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Administrador</p>
              <p className="font-semibold text-white">{user.name}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <LogOut size={20} className="text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gerenciar Cursos</h2>
            <p className="text-gray-400">Crie e gerencie cursos, módulos e aulas</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button
                data-testid="create-course-button"
                onClick={() => {
                  setEditingCourse(null);
                  setFormData({ title: '', description: '', thumbnail_url: '', category: '', published: false, price_brl: 0, price_credits: 50, hotmart_product_id: '', hotmart_checkout_url: '' });
                }}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Plus size={20} className="mr-2" />
                Novo Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white">
              <DialogHeader>
                <DialogTitle>{editingCourse ? 'Editar Curso' : 'Criar Novo Curso'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    data-testid="course-title-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    data-testid="course-description-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={4}
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>URL da Imagem</Label>
                  <Input
                    data-testid="course-thumbnail-input"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    data-testid="course-category-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Programação, Design..."
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Preço em R$</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_brl || 0}
                      onChange={(e) => setFormData({ ...formData, price_brl: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="bg-[#111111] border-[#2a2a2a]"
                    />
                  </div>
                  <div>
                    <Label>Preço em Créditos</Label>
                    <Input
                      type="number"
                      value={formData.price_credits || 50}
                      onChange={(e) => setFormData({ ...formData, price_credits: parseInt(e.target.value) })}
                      placeholder="50"
                      className="bg-[#111111] border-[#2a2a2a]"
                    />
                  </div>
                </div>
                <div>
                  <Label>ID Produto Hotmart (Opcional)</Label>
                  <Input
                    type="text"
                    value={formData.hotmart_product_id || ''}
                    onChange={(e) => setFormData({ ...formData, hotmart_product_id: e.target.value })}
                    placeholder="Ex: 6315704"
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Configure se vender este curso pela Hotmart</p>
                </div>
                <div>
                  <Label>URL Checkout Hotmart (Opcional)</Label>
                  <Input
                    type="url"
                    value={formData.hotmart_checkout_url || ''}
                    onChange={(e) => setFormData({ ...formData, hotmart_checkout_url: e.target.value })}
                    placeholder="https://pay.hotmart.com/..."
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Link do checkout da Hotmart para este curso</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    data-testid="course-published-checkbox"
                    type="checkbox"
                    id="published"
                    checked={formData.published}
                    onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="published">Publicar curso</Label>
                </div>
                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  {editingCourse ? 'Atualizar' : 'Criar'} Curso
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <BookOpen size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg mb-4">Nenhum curso criado ainda</p>
            <p className="text-gray-500 text-sm">Clique em "Novo Curso" para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                data-testid={`course-item-${course.id}`}
                className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 hover:border-emerald-500/50 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{course.title}</h3>
                      {course.published ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full">
                          Publicado
                        </span>
                      ) : (
                        <span className="bg-gray-500/20 text-gray-400 text-xs px-3 py-1 rounded-full">
                          Rascunho
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 mb-4">{course.description}</p>
                    {course.category && (
                      <span className="text-sm text-gray-500">Categoria: {course.category}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      data-testid={`manage-course-${course.id}`}
                      onClick={() => navigate(`/admin/course/${course.id}`)}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Gerenciar
                    </Button>
                    <Button
                      onClick={() => handleEdit(course)}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      onClick={() => handleDelete(course.id)}
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
    </div>
  );
}

import UserManagement from './UserManagement';
import CommunityModeration from './CommunityModeration';
import EmailSettings from './EmailSettings';

export default function AdminDashboard({ user, onLogout }) {
  return (
    <Routes>
      <Route index element={<CourseList user={user} onLogout={onLogout} />} />
      <Route path="course/:courseId" element={<CourseManagement user={user} onLogout={onLogout} />} />
      <Route path="users" element={<UserManagement user={user} onLogout={onLogout} />} />
      <Route path="community" element={<CommunityModeration user={user} onLogout={onLogout} />} />
      <Route path="email-settings" element={<EmailSettings user={user} onLogout={onLogout} />} />
    </Routes>
  );
}

function CourseManagement({ user, onLogout }) {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Module dialog state
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', order: 0 });

  // Lesson dialog state
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ title: '', type: 'video', content: '', duration: 0, order: 0, links: [] });

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  useEffect(() => {
    if (selectedModule) {
      fetchLessons(selectedModule.id);
    }
  }, [selectedModule]);

  const fetchCourseData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [courseRes, modulesRes] = await Promise.all([
        axios.get(`${API}/admin/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/modules/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setCourse(courseRes.data);
      setModules(modulesRes.data);
      if (modulesRes.data.length > 0) {
        setSelectedModule(modulesRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (moduleId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/lessons/${moduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLessons(response.data);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const handleModuleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editingModule) {
        await axios.put(`${API}/admin/modules/${editingModule.id}`, moduleForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/admin/modules`, { ...moduleForm, course_id: courseId }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModuleDialog(false);
      setEditingModule(null);
      setModuleForm({ title: '', description: '', order: 0 });
      fetchCourseData();
    } catch (error) {
      console.error('Error saving module:', error);
    }
  };

  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    if (!selectedModule) return;
    try {
      const token = localStorage.getItem('token');
      if (editingLesson) {
        await axios.put(`${API}/admin/lessons/${editingLesson.id}`, lessonForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/admin/lessons`, { ...lessonForm, module_id: selectedModule.id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowLessonDialog(false);
      setEditingLesson(null);
      setLessonForm({ title: '', type: 'video', content: '', duration: 0, order: 0, links: [] });
      fetchLessons(selectedModule.id);
    } catch (error) {
      console.error('Error saving lesson:', error);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Excluir este módulo e todas as aulas?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/modules/${moduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCourseData();
    } catch (error) {
      console.error('Error deleting module:', error);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Excluir esta aula?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLessons(selectedModule.id);
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111111] border-b border-[#252525]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white"
            >
              ← Voltar
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">{course?.title}</h1>
              <p className="text-sm text-gray-400">Gerenciar módulos e aulas</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modules Column */}
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Módulos</h2>
              <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="add-module-button"
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => {
                      setEditingModule(null);
                      setModuleForm({ title: '', description: '', order: modules.length });
                    }}
                  >
                    <Plus size={16} className="mr-1" /> Módulo
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white">
                  <DialogHeader>
                    <DialogTitle>{editingModule ? 'Editar' : 'Novo'} Módulo</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleModuleSubmit} className="space-y-4">
                    <div>
                      <Label>Título</Label>
                      <Input
                        value={moduleForm.title}
                        onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                        required
                        className="bg-[#111111] border-[#2a2a2a]"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={moduleForm.description}
                        onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                        rows={3}
                        className="bg-[#111111] border-[#2a2a2a]"
                      />
                    </div>
                    <div>
                      <Label>Ordem</Label>
                      <Input
                        type="number"
                        value={moduleForm.order}
                        onChange={(e) => setModuleForm({ ...moduleForm, order: parseInt(e.target.value) })}
                        className="bg-[#111111] border-[#2a2a2a]"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                      {editingModule ? 'Atualizar' : 'Criar'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedModule?.id === module.id
                      ? 'bg-emerald-500/10 border-emerald-500'
                      : 'bg-[#1a1a1a] border-[#252525] hover:border-[#3a3a3a]'
                  }`}
                  onClick={() => setSelectedModule(module)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{module.title}</h3>
                      {module.description && (
                        <p className="text-sm text-gray-400 line-clamp-2">{module.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingModule(module);
                          setModuleForm({
                            title: module.title,
                            description: module.description || '',
                            order: module.order
                          });
                          setShowModuleDialog(true);
                        }}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteModule(module.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lessons Column */}
          <div className="lg:col-span-2">
            {selectedModule ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">Aulas - {selectedModule.title}</h2>
                  <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
                    <DialogTrigger asChild>
                      <Button
                        data-testid="add-lesson-button"
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => {
                          setEditingLesson(null);
                          setLessonForm({ title: '', type: 'video', content: '', duration: 0, order: lessons.length, links: [] });
                        }}
                      >
                        <Plus size={16} className="mr-1" /> Aula
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white">
                      <DialogHeader>
                        <DialogTitle>{editingLesson ? 'Editar' : 'Nova'} Aula</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleLessonSubmit} className="space-y-4">
                        <div>
                          <Label>Título</Label>
                          <Input
                            value={lessonForm.title}
                            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                            required
                            className="bg-[#111111] border-[#2a2a2a]"
                          />
                        </div>
                        <div>
                          <Label>Tipo</Label>
                          <select
                            value={lessonForm.type}
                            onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}
                            className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
                          >
                            <option value="video">Vídeo</option>
                            <option value="text">Texto</option>
                            <option value="file">Arquivo</option>
                          </select>
                        </div>
                        <div>
                          <Label>
                            {lessonForm.type === 'video' ? 'Código HTML Embed (Bunny.net)' : 
                             lessonForm.type === 'text' ? 'Conteúdo de Texto' : 'URL do Arquivo'}
                          </Label>
                          {lessonForm.type === 'video' || lessonForm.type === 'text' ? (
                            <Textarea
                              value={lessonForm.content}
                              onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                              required
                              rows={lessonForm.type === 'video' ? 4 : 6}
                              placeholder={lessonForm.type === 'video' 
                                ? '<div style="position:relative;padding-top:56.25%;"><iframe src="..." ... ></iframe></div>'
                                : 'Digite o conteúdo da aula...'
                              }
                              className="bg-[#111111] border-[#2a2a2a] font-mono text-sm"
                            />
                          ) : (
                            <Input
                              value={lessonForm.content}
                              onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                              required
                              placeholder="https://..."
                              className="bg-[#111111] border-[#2a2a2a]"
                            />
                          )}
                          {lessonForm.type === 'video' && (
                            <p className="text-xs text-gray-500 mt-1">
                              Cole o código embed completo do Bunny.net (incluindo as tags &lt;div&gt; e &lt;iframe&gt;)
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Duração (segundos)</Label>
                          <Input
                            type="number"
                            value={lessonForm.duration}
                            onChange={(e) => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })}
                            className="bg-[#111111] border-[#2a2a2a]"
                          />
                        </div>
                        <div>
                          <Label>Ordem</Label>
                          <Input
                            type="number"
                            value={lessonForm.order}
                            onChange={(e) => setLessonForm({ ...lessonForm, order: parseInt(e.target.value) })}
                            className="bg-[#111111] border-[#2a2a2a]"
                          />
                        </div>

                        {/* Links Section */}
                        <div className="border-t border-[#2a2a2a] pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <Label>Links Adicionais</Label>
                            <Button
                              type="button"
                              onClick={() => {
                                const newLinks = [...(lessonForm.links || []), { title: '', url: '' }];
                                setLessonForm({ ...lessonForm, links: newLinks });
                              }}
                              size="sm"
                              className="bg-cyan-500 hover:bg-cyan-600"
                            >
                              <Plus size={14} className="mr-1" /> Adicionar Link
                            </Button>
                          </div>
                          
                          {lessonForm.links && lessonForm.links.length > 0 && (
                            <div className="space-y-3">
                              {lessonForm.links.map((link, index) => (
                                <div key={index} className="bg-[#111111] p-3 rounded-lg border border-[#2a2a2a] space-y-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-400">Link {index + 1}</span>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        const newLinks = lessonForm.links.filter((_, i) => i !== index);
                                        setLessonForm({ ...lessonForm, links: newLinks });
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                  </div>
                                  <Input
                                    placeholder="Título do link"
                                    value={link.title}
                                    onChange={(e) => {
                                      const newLinks = [...lessonForm.links];
                                      newLinks[index].title = e.target.value;
                                      setLessonForm({ ...lessonForm, links: newLinks });
                                    }}
                                    className="bg-[#0a0a0a] border-[#2a2a2a] text-sm"
                                  />
                                  <Input
                                    placeholder="https://..."
                                    value={link.url}
                                    onChange={(e) => {
                                      const newLinks = [...lessonForm.links];
                                      newLinks[index].url = e.target.value;
                                      setLessonForm({ ...lessonForm, links: newLinks });
                                    }}
                                    className="bg-[#0a0a0a] border-[#2a2a2a] text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {(!lessonForm.links || lessonForm.links.length === 0) && (
                            <p className="text-xs text-gray-500 text-center py-4">
                              Nenhum link adicionado. Clique em "Adicionar Link" para começar.
                            </p>
                          )}
                        </div>

                        <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                          {editingLesson ? 'Atualizar' : 'Criar'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {lessons.length === 0 ? (
                    <div className="text-center py-12 bg-[#1a1a1a] rounded-lg border border-[#252525]">
                      <FileText size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400">Nenhuma aula criada</p>
                    </div>
                  ) : (
                    lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="bg-[#1a1a1a] border border-[#252525] rounded-lg p-4 hover:border-[#3a3a3a] transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded">
                                {lesson.type}
                              </span>
                              <h3 className="font-semibold text-white">{lesson.title}</h3>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2">
                              {lesson.type === 'text' ? lesson.content.substring(0, 100) + '...' : lesson.content}
                            </p>
                            {lesson.duration > 0 && (
                              <p className="text-xs text-gray-500 mt-2">
                                Duração: {Math.floor(lesson.duration / 60)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingLesson(lesson);
                                setLessonForm({
                                  title: lesson.title,
                                  type: lesson.type,
                                  content: lesson.content,
                                  duration: lesson.duration,
                                  order: lesson.order,
                                  links: lesson.links || []
                                });
                                setShowLessonDialog(true);
                              }}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteLesson(lesson.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20 bg-[#1a1a1a] rounded-lg border border-[#252525]">
                <FolderOpen size={64} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Selecione um módulo para ver as aulas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useParams } from 'react-router-dom';