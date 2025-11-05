import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, 
  BookOpen, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  FileText,
  FolderOpen,
  LogOut,
  ChevronDown,
  Mail,
  MessageCircle,
  Gift,
  Package,
  DollarSign,
  CreditCard,
  GraduationCap,
  UserCheck,
  HeadphonesIcon,
  BarChart3,
  GripVertical,
  Upload
} from 'lucide-react';
import { Eye } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import UserManagement from './UserManagement';
import CommunityModeration from './CommunityModeration';
import EmailSettings from './EmailSettings';
import LeadSettings from './LeadSettings';
import ReplicationSettings from './ReplicationSettings';
import AnalyticsSettings from './AnalyticsSettings';
import BunnySettings from './BunnySettings';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function CourseList({ onLogout, user }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showContentMenu, setShowContentMenu] = useState(false);
  const [showUsersMenu, setShowUsersMenu] = useState(false);
  const [showFinanceMenu, setShowFinanceMenu] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    categories: [],
    published: false,
    price_brl: 0,
    language: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
    fetchAllCategories();
  }, []);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = () => {
      setShowContentMenu(false);
      setShowUsersMenu(false);
      setShowFinanceMenu(false);
      setShowConfigMenu(false);
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

  const fetchAllCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/categories`, { headers: { Authorization: `Bearer ${token}` } });
      setAllCategories(res.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cats = formData.categories || [];
      if (!cats.length) {
        alert('Selecione pelo menos uma categoria para o curso.');
        return;
      }
      const token = localStorage.getItem('token');
      console.log('Saving course with data:', formData);
      
      let response;
      if (editingCourse) {
        console.log('Updating course:', editingCourse.id);
        response = await axios.put(`${API}/admin/courses/${editingCourse.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        console.log('Creating new course');
        response = await axios.post(`${API}/admin/courses`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      console.log('Course saved successfully:', response.data);
      alert('Curso salvo com sucesso!');
      setShowDialog(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', thumbnail_url: '', categories: [], published: false, price_brl: 0, language: null });
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Erro ao salvar o curso. ';
      if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail;
      } else if (error.response?.status === 401) {
        errorMessage += 'Você não tem permissão para realizar esta ação.';
      } else if (error.response?.status === 400) {
        errorMessage += 'Dados inválidos. Verifique os campos obrigatórios.';
      } else {
        errorMessage += 'Tente novamente.';
      }
      
      alert(errorMessage);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    
    // Para cursos antigos com campo 'category' (nome), deixar categories vazio
    // O backend vai lidar com a retrocompatibilidade
    let categories = [];
    if (Array.isArray(course.categories) && course.categories.length > 0) {
      // Curso novo com categories (IDs)
      categories = course.categories;
    }
    // Para cursos antigos com apenas 'category' (nome), deixamos categories vazio
    // e o usuário precisará selecionar as categorias novamente
    
    setFormData({
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url || '',
      categories: categories,
      published: course.published,
      price_brl: course.price_brl || 0,
      language: course.language || null
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

  const previewCourse = (courseId) => {
    if (!courseId) return;
    const previewUrl = `/course/${courseId}?preview=1`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold gradient-text">Hiperautomação Admin</h1>
            <nav className="flex gap-6">
              {/* Conteúdo Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContentMenu(!showContentMenu);
                    setShowUsersMenu(false);
                    setShowFinanceMenu(false);
                    setShowConfigMenu(false);
                  }}
                  className={`flex items-center gap-2 transition-colors ${
                    location.pathname === '/admin' || location.pathname.includes('/admin/categories')
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <GraduationCap size={20} />
                  Conteúdo
                  <ChevronDown size={16} />
                </button>
                {showContentMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[200px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin');
                        setShowContentMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <GraduationCap size={16} />
                      Cursos & Aulas
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/categories');
                        setShowContentMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <FolderOpen size={16} />
                      Categorias
                    </button>
                  </div>
                )}
              </div>

              {/* Usuários & Comunidade Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUsersMenu(!showUsersMenu);
                    setShowContentMenu(false);
                    setShowFinanceMenu(false);
                    setShowConfigMenu(false);
                  }}
                  className={`flex items-center gap-2 transition-colors ${
                    location.pathname.includes('/admin/users') || location.pathname.includes('/admin/community')
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <UserCheck size={20} />
                  Usuários & Comunidade
                  <ChevronDown size={16} />
                </button>
                {showUsersMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[200px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/users');
                        setShowUsersMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <Users size={16} />
                      Gerenciar Usuários
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/community');
                        setShowUsersMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <MessageCircle size={16} />
                      Comunidade
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/gamification');
                        setShowUsersMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <Gift size={16} />
                      Gamificação
                    </button>
                  </div>
                )}
              </div>
              
              {/* Financeiro Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFinanceMenu(!showFinanceMenu);
                    setShowContentMenu(false);
                    setShowUsersMenu(false);
                    setShowConfigMenu(false);
                  }}
                  className={`flex items-center gap-2 transition-colors ${
                    location.pathname.includes('/admin/finance') || 
                    location.pathname.includes('/admin/gateway') || 
                    location.pathname.includes('/admin/payment') ||
                    location.pathname.includes('/admin/subscription')
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <BarChart3 size={20} />
                  Financeiro
                  <ChevronDown size={16} />
                </button>
                {showFinanceMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[220px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/finance');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <DollarSign size={16} />
                      Relatórios Financeiros
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/subscription-plans');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      Planos & Preços
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/gateway');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <Settings size={16} />
                      Gateway Pagamento
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/payment-settings');
                        setShowFinanceMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <Settings size={16} />
                      Config. Pagamentos
                    </button>
                  </div>
                )}
              </div>

              {/* Configurações Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfigMenu(!showConfigMenu);
                    setShowContentMenu(false);
                    setShowUsersMenu(false);
                    setShowFinanceMenu(false);
                  }}
                  className={`flex items-center gap-2 transition-colors ${
                    location.pathname.includes('/admin/email') || 
                    location.pathname.includes('/admin/lead') || 
                    location.pathname.includes('/admin/support') ||
                    location.pathname.includes('/admin/analytics')
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Settings size={20} />
                  Configurações
                  <ChevronDown size={16} />
                </button>
                {showConfigMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[200px] z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/email-settings');
                        setShowConfigMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-t-lg"
                    >
                      <Mail size={16} />
                      Configurar Email
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/lead-settings');
                        setShowConfigMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <UserCheck size={16} />
                      Captura de Leads
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/analytics');
                        setShowConfigMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <BarChart3 size={16} />
                      Configurar Analytics
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/admin/support');
                        setShowConfigMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      <HeadphonesIcon size={16} />
                      Configurar Suporte
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
        {/* Header Section - Inspired by README.md structure */}
        <div className="mb-12">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <BookOpen size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white">Gerenciar Cursos</h1>
                  <p className="text-lg text-gray-400 mt-1">Crie e gerencie cursos, módulos e aulas da plataforma</p>
                </div>
              </div>
              
              {/* Stats Overview - Similar to README.md key features */}
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-300">{courses.filter(c => c.published).length} Cursos Publicados</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-300">{courses.filter(c => !c.published).length} Rascunhos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">{courses.length} Total</span>
                </div>
              </div>
            </div>
            
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button
                  data-testid="create-course-button"
                  onClick={() => {
                    setEditingCourse(null);
                    setFormData({ title: '', description: '', thumbnail_url: '', categories: [], published: false, price_brl: 0, language: null });
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all duration-200"
                >
                  <Plus size={20} className="mr-2" />
                  Novo Curso
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingCourse ? 'Editar Curso' : 'Criar Novo Curso'}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                 <form id="course-form" onSubmit={handleSubmit} className="space-y-4">
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
                  <Label>Categorias</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {allCategories.map((cat) => {
                      const checked = (formData.categories || []).includes(cat.id);
                      const IconEl = Icons[cat.icon] || Icons.FolderOpen;
                      return (
                        <label key={cat.id} className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(formData.categories || []);
                              if (e.target.checked) next.add(cat.id); else next.delete(cat.id);
                              setFormData({ ...formData, categories: Array.from(next) });
                            }}
                          />
                          <IconEl size={16} className={cat.color || 'text-emerald-400'} />
                          <span className="text-sm">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Selecione pelo menos uma categoria.</p>
                </div>
                <div>
                  <Label>Idioma do Curso</Label>
                  <select
                    value={formData.language || ''}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value || null })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Todos os idiomas (padrão)</option>
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Deixe vazio para mostrar em todos os idiomas.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </form>
              </div>
              <div className="flex-shrink-0 pt-4 border-t border-[#252525]">
                <Button 
                  type="submit" 
                  form="course-form"
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  {editingCourse ? 'Atualizar' : 'Criar'} Curso
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-gray-400 mt-4">Carregando cursos...</p>
          </div>
        ) : courses.length === 0 ? (
          /* Empty State - Enhanced with README.md styling */
          <div className="text-center py-20 bg-gradient-to-br from-[#1a1a1a] to-[#111111] rounded-2xl border border-[#252525] shadow-2xl">
            <div className="max-w-md mx-auto">
              <div className="p-4 bg-emerald-500/10 rounded-full w-fit mx-auto mb-6">
                <BookOpen size={64} className="text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Nenhum curso criado ainda</h3>
              <p className="text-gray-400 text-lg mb-6">Comece criando seu primeiro curso para compartilhar conhecimento com seus alunos</p>
              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setEditingCourse(null);
                    setFormData({ title: '', description: '', thumbnail_url: '', categories: [], published: false, price_brl: 0, language: null });
                    setShowDialog(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3"
                >
                  <Plus size={20} className="mr-2" />
                  Criar Primeiro Curso
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Course Grid - Enhanced layout inspired by README.md structure */
          <div className="space-y-6">
            {/* Section Header */}
            <div className="border-b border-[#252525] pb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Seus Cursos</h2>
              <p className="text-gray-400">Gerencie o conteúdo e configurações dos seus cursos</p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  data-testid={`course-item-${course.id}`}
                  className="group bg-gradient-to-br from-[#1a1a1a] to-[#111111] border border-[#252525] rounded-2xl p-8 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-4">
                      {/* Course Header */}
                      <div className="flex items-start gap-4">
                        {course.thumbnail_url && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#252525] flex-shrink-0">
                            <img 
                              src={course.thumbnail_url} 
                              alt={course.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                              {course.title}
                            </h3>
                            {course.published ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-3 py-1 rounded-full border border-emerald-500/30">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                Publicado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-sm font-semibold px-3 py-1 rounded-full border border-yellow-500/30">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                Rascunho
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-lg leading-relaxed">{course.description}</p>
                        </div>
                      </div>

                      {/* Course Metadata */}
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        {/* Categories */}
                        <div className="flex flex-wrap gap-2">
                          {(
                            (Array.isArray(course.categories) && course.categories.length ? course.categories : [])
                              .map((catId) => {
                                const catObj = allCategories.find((c) => c.id === catId);
                                if (!catObj) return null;
                                const IconEl = Icons[catObj.icon] || Icons.FolderOpen;
                                return (
                                  <span key={`${course.id}-${catId}`} className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-sm font-medium px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                    <IconEl size={14} />
                                    {catObj.name}
                                  </span>
                                );
                              })
                          )}
                          {(!course.categories || course.categories.length === 0) && course.category && (
                            <span className="inline-flex items-center gap-2 bg-gray-500/10 text-gray-400 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-500/20">
                              <FolderOpen size={14} />
                              {course.category}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        {course.price_brl > 0 && (
                          <div className="flex items-center gap-1 text-sm text-gray-400">
                            <DollarSign size={14} />
                            <span>R$ {course.price_brl.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 ml-6">
                      <Button
                        data-testid={`manage-course-${course.id}`}
                        onClick={() => navigate(`/admin/course/${course.id}`)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 font-medium px-4 py-2 transition-all duration-200"
                      >
                        <FolderOpen size={16} className="mr-2" />
                        Gerenciar
                      </Button>
                      <Button
                        onClick={() => handleEdit(course)}
                        variant="outline"
                        className="border-[#2a2a2a] hover:bg-[#252525] hover:border-[#3a3a3a] text-gray-300 hover:text-white transition-all duration-200"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        onClick={() => previewCourse(course.id)}
                        variant="outline"
                        className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 hover:border-blue-500/50 transition-all duration-200"
                      >
                        <Eye size={16} className="mr-2" />
                        Visualizar
                      </Button>
                      <Button
                        onClick={() => handleDelete(course.id)}
                        variant="outline"
                        className="border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 hover:border-red-500/50 transition-all duration-200"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboard({ user, onLogout }) {
  return (
    <Routes>
      <Route index element={<CourseList user={user} onLogout={onLogout} />} />
      <Route path="course/:courseId" element={<CourseManagement user={user} onLogout={onLogout} />} />
      <Route path="users" element={<UserManagement user={user} onLogout={onLogout} />} />
      <Route path="community" element={<CommunityModeration user={user} onLogout={onLogout} />} />
  <Route path="email-settings" element={<EmailSettings user={user} onLogout={onLogout} />} />
  <Route path="lead-settings" element={<LeadSettings user={user} onLogout={onLogout} />} />
  <Route path="analytics" element={<AnalyticsSettings user={user} onLogout={onLogout} />} />
  <Route path="replication" element={<ReplicationSettings user={user} onLogout={onLogout} />} />
  <Route path="media" element={<BunnySettings user={user} onLogout={onLogout} />} />
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
  const [draggingModuleId, setDraggingModuleId] = useState(null);
  const [dragOverModuleId, setDragOverModuleId] = useState(null);
  const [moduleOrderSaving, setModuleOrderSaving] = useState(false);
  const [draggingLessonId, setDraggingLessonId] = useState(null);
  const [dragOverLessonId, setDragOverLessonId] = useState(null);
  const [lessonOrderSaving, setLessonOrderSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [bunnyConfig, setBunnyConfig] = useState(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  useEffect(() => {
    if (selectedModule?.id) {
      fetchLessons(selectedModule.id);
    }
  }, [selectedModule?.id]);

  useEffect(() => {
    const loadBunnyConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/admin/media/bunny/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBunnyConfig(response.data);
      } catch (error) {
        console.error('Erro ao carregar configuração Bunny:', error);
      }
    };

    loadBunnyConfig();
  }, []);

  useEffect(() => {
    if (!showLessonDialog) {
      setUploadingVideo(false);
      setUploadingFile(false);
      setUploadingAttachment(false);
      setUploadFeedback(null);
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
    }
  }, [showLessonDialog]);

  useEffect(() => {
    setUploadFeedback(null);
  }, [lessonForm.type]);

  const streamConfigured = Boolean(bunnyConfig?.stream_library_id && bunnyConfig?.stream_api_key);
  const storageConfigured = Boolean(bunnyConfig?.storage_zone_name && bunnyConfig?.storage_api_key);

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

  const uploadFileToBunny = async (selected) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selected);

      const response = await axios.post(`${API}/admin/media/bunny/upload/file`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const publicUrl = response.data?.public_url;
      if (!publicUrl) {
        throw new Error('Upload concluído, porém a Bunny não retornou uma URL pública.');
      }
      return publicUrl;
    } catch (error) {
      console.error('Erro ao enviar arquivo para Bunny:', error);
      setUploadFeedback({
        type: 'error',
        text: error.response?.data?.detail || 'Falha ao enviar arquivo para Bunny. Verifique as credenciais nas configurações.'
      });
      throw error;
    }
  };

  const handleVideoFileSelected = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected || !streamConfigured) return;
    setUploadFeedback(null);
    setUploadingVideo(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selected);
      const resolvedTitle = (lessonForm.title || selected.name || 'Aula em vídeo').trim();
      formData.append('title', resolvedTitle);

      const response = await axios.post(`${API}/admin/media/bunny/upload/video`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const embedHtml = response.data?.embed_html || '';
      const autoDuration = response.data?.duration_seconds;
      if (embedHtml) {
        setLessonForm((prev) => ({
          ...prev,
          type: 'video',
          content: embedHtml,
          duration: typeof autoDuration === 'number' && autoDuration > 0 ? autoDuration : prev.duration
        }));
        let successMessage = 'Vídeo enviado para Bunny e embed aplicado automaticamente.';
        if (autoDuration && autoDuration > 0) {
          successMessage += ` Duração estimada: ${autoDuration}s.`;
        }
        setUploadFeedback({ type: 'success', text: successMessage });
      } else {
        setUploadFeedback({
          type: 'error',
          text: 'Upload concluído, mas não foi possível gerar o embed automaticamente. Verifique o retorno da API.'
        });
      }
    } catch (error) {
      console.error('Erro ao enviar vídeo para Bunny:', error);
      setUploadFeedback({
        type: 'error',
        text: error.response?.data?.detail || 'Falha ao enviar vídeo para Bunny. Verifique as credenciais nas configurações.'
      });
    } finally {
      setUploadingVideo(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleMaterialFileSelected = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected || !storageConfigured) return;
    setUploadFeedback(null);
    setUploadingFile(true);

    try {
      const publicUrl = await uploadFileToBunny(selected);
      setLessonForm((prev) => ({ ...prev, type: 'file', content: publicUrl }));
      setUploadFeedback({ type: 'success', text: 'Arquivo enviado para Bunny Storage. Link aplicado automaticamente.' });
    } catch (error) {
      // Feedback já foi tratado em uploadFileToBunny
    } finally {
      setUploadingFile(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleAttachmentUpload = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected || !storageConfigured) return;
    setUploadFeedback(null);
    setUploadingAttachment(true);

    try {
      const publicUrl = await uploadFileToBunny(selected);
      const defaultTitle = selected.name || 'Material adicional';
      setLessonForm((prev) => ({
        ...prev,
        links: [
          ...(prev.links || []),
          { title: defaultTitle, url: publicUrl }
        ]
      }));
      setUploadFeedback({ type: 'success', text: 'Material enviado para Bunny e adicionado à lista de recursos.' });
    } catch (error) {
      // Feedback já foi tratado em uploadFileToBunny
    } finally {
      setUploadingAttachment(false);
      if (event.target) {
        event.target.value = '';
      }
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

  const previewCourse = () => {
    if (!courseId) return;
    const previewUrl = `/course/${courseId}?preview=1`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
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

  const reorderByTarget = (items, draggedId, targetId) => {
    if (!draggedId) return items;
    if (draggedId === targetId) return items;
    const draggedItem = items.find((item) => item.id === draggedId);
    if (!draggedItem) return items;
    const remaining = items.filter((item) => item.id !== draggedId);

    if (!targetId || targetId === '__end') {
      remaining.push(draggedItem);
    } else {
      const targetIndex = remaining.findIndex((item) => item.id === targetId);
      if (targetIndex === -1) {
        remaining.push(draggedItem);
      } else {
        remaining.splice(targetIndex, 0, draggedItem);
      }
    }

    return remaining.map((item, index) => ({ ...item, order: index }));
  };

  const persistModuleOrder = async (orderedModules) => {
    const token = localStorage.getItem('token');
    await Promise.all(
      orderedModules.map((module, index) =>
        axios.put(
          `${API}/admin/modules/${module.id}`,
          {
            title: module.title,
            description: module.description ?? '',
            order: index
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      )
    );
  };

  const persistLessonOrder = async (orderedLessons) => {
    const token = localStorage.getItem('token');
    await Promise.all(
      orderedLessons.map((lesson, index) =>
        axios.put(
          `${API}/admin/lessons/${lesson.id}`,
          {
            title: lesson.title,
            type: lesson.type,
            content: lesson.content,
            duration: lesson.duration || 0,
            order: index,
            links: lesson.links || []
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      )
    );
  };

  const handleModuleDragStart = (event, moduleId) => {
    setDraggingModuleId(moduleId);
    setDragOverModuleId(moduleId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', moduleId);
  };

  const handleModuleDragOver = (event, targetId) => {
    event.preventDefault();
    setDragOverModuleId(targetId ?? '__end');
    event.dataTransfer.dropEffect = 'move';
  };

  const handleModuleDragEnd = () => {
    setDraggingModuleId(null);
    setDragOverModuleId(null);
  };

  const handleModuleDrop = async (event, targetId) => {
    event.preventDefault();
    if (moduleOrderSaving || draggingModuleId == null) {
      handleModuleDragEnd();
      return;
    }

    const originalModules = modules;
    const reordered = reorderByTarget(modules, draggingModuleId, targetId ?? '__end');
    const hasChanged = reordered.some((module, index) => module.id !== modules[index]?.id);
    if (!reordered || !hasChanged) {
      handleModuleDragEnd();
      return;
    }

    setModules(reordered);
    if (selectedModule) {
      const updatedSelected = reordered.find((module) => module.id === selectedModule.id);
      if (updatedSelected) {
        setSelectedModule(updatedSelected);
      }
    }

    try {
      setModuleOrderSaving(true);
      await persistModuleOrder(reordered);
    } catch (error) {
      console.error('Error updating module order:', error);
      setModules(originalModules);
    } finally {
      setModuleOrderSaving(false);
      handleModuleDragEnd();
    }
  };

  const handleLessonDragStart = (event, lessonId) => {
    setDraggingLessonId(lessonId);
    setDragOverLessonId(lessonId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lessonId);
  };

  const handleLessonDragOver = (event, targetId) => {
    event.preventDefault();
    setDragOverLessonId(targetId ?? '__end');
    event.dataTransfer.dropEffect = 'move';
  };

  const handleLessonDragEnd = () => {
    setDraggingLessonId(null);
    setDragOverLessonId(null);
  };

  const handleLessonDrop = async (event, targetId) => {
    event.preventDefault();
    if (lessonOrderSaving || draggingLessonId == null) {
      handleLessonDragEnd();
      return;
    }

    const originalLessons = lessons;
    const reordered = reorderByTarget(lessons, draggingLessonId, targetId ?? '__end');
    const hasChanged = reordered.some((lesson, index) => lesson.id !== lessons[index]?.id);
    if (!reordered || !hasChanged) {
      handleLessonDragEnd();
      return;
    }

    setLessons(reordered);
    try {
      setLessonOrderSaving(true);
      await persistLessonOrder(reordered);
    } catch (error) {
      console.error('Error updating lesson order:', error);
      setLessons(originalLessons);
    } finally {
      setLessonOrderSaving(false);
      handleLessonDragEnd();
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
              onClick={previewCourse}
            >
              <Eye size={16} className="mr-2" />
              Visualizar curso
            </Button>
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

            {moduleOrderSaving && (
              <p className="text-xs text-emerald-300 mb-2">Salvando ordem dos módulos...</p>
            )}

            <div className="space-y-2">
              {modules.map((module) => {
                const isSelected = selectedModule?.id === module.id;
                const isDragging = draggingModuleId === module.id;
                const isDragOver = dragOverModuleId === module.id;

                return (
                  <div
                    key={module.id}
                    role="button"
                    tabIndex={0}
                    onDragOver={(event) => handleModuleDragOver(event, module.id)}
                    onDrop={(event) => handleModuleDrop(event, module.id)}
                    onDragLeave={() => setDragOverModuleId(null)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500'
                        : 'bg-[#1a1a1a] border-[#252525] hover:border-[#3a3a3a]'
                    } ${isDragging ? 'opacity-60' : ''} ${
                      isDragOver && !isDragging ? 'border-emerald-500/60 ring-2 ring-emerald-500/20' : ''
                    }`}
                    onClick={() => setSelectedModule(module)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedModule(module);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          className="text-gray-500 mt-1 cursor-grab active:cursor-grabbing focus:outline-none"
                          draggable={!moduleOrderSaving}
                          onDragStart={(event) => handleModuleDragStart(event, module.id)}
                          onDragEnd={handleModuleDragEnd}
                        >
                          <GripVertical size={16} />
                        </button>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">{module.title}</h3>
                          {module.description && (
                            <p className="text-sm text-gray-400 line-clamp-2">{module.description}</p>
                          )}
                        </div>
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
                );
              })}
              <div
                className={`transition-all ${
                  draggingModuleId
                    ? `h-4 rounded border border-dashed border-emerald-500/40 ${
                        dragOverModuleId === '__end' ? 'bg-emerald-500/10' : 'bg-transparent'
                      }`
                    : 'h-0 overflow-hidden'
                }`}
                onDragOver={(event) => handleModuleDragOver(event, '__end')}
                onDrop={(event) => handleModuleDrop(event, '__end')}
                onDragLeave={() => setDragOverModuleId(null)}
              />
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
                        onClick={() => {
                          setEditingLesson(null);
                          setLessonForm({
                            title: '',
                            type: 'video',
                            content: '',
                            duration: 0,
                            order: lessons.filter(l => l.module_id === selectedModule.id).length + 1,
                            links: []
                          });
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all duration-200"
                      >
                        <Plus size={16} className="mr-2" />
                        Nova Aula
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
                              onChange={(e) => {
                                setLessonForm({ ...lessonForm, content: e.target.value });
                                if (uploadFeedback) setUploadFeedback(null);
                              }}
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
                              onChange={(e) => {
                                setLessonForm({ ...lessonForm, content: e.target.value });
                                if (uploadFeedback) setUploadFeedback(null);
                              }}
                              required
                              placeholder="https://..."
                              className="bg-[#111111] border-[#2a2a2a]"
                            />
                          )}
                          {lessonForm.type === 'video' && (
                            <>
                              <p className="text-xs text-gray-500 mt-1">
                                Cole o código embed completo do Bunny.net (incluindo as tags &lt;div&gt; e &lt;iframe&gt;) ou envie o arquivo
                                direto para gerar automaticamente.
                              </p>
                              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <p className="text-xs text-emerald-100/80">
                                    Envie arquivos em MP4 ou MOV. O embed será preenchido automaticamente após o upload.
                                  </p>
                                  <Button
                                    type="button"
                                    onClick={() => videoInputRef.current?.click()}
                                    disabled={!streamConfigured || uploadingVideo}
                                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Upload size={16} className="mr-2" />
                                    {uploadingVideo ? 'Enviando vídeo...' : 'Enviar vídeo via Bunny'}
                                  </Button>
                                </div>
                                {!streamConfigured && (
                                  <p className="text-xs text-yellow-200/80">
                                    Configure Bunny Stream em Configurações &gt; Bunny para liberar o upload automático.
                                  </p>
                                )}
                                {uploadingVideo && (
                                  <p className="text-xs text-emerald-100/80 animate-pulse">Upload em andamento, aguarde...</p>
                                )}
                              </div>
                              <input
                                ref={videoInputRef}
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={handleVideoFileSelected}
                              />
                            </>
                          )}
                          {lessonForm.type === 'file' && (
                            <>
                              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <p className="text-xs text-blue-100/80">
                                    Faça upload de PDFs, slides ou planilhas para armazenar na Bunny Storage automaticamente.
                                  </p>
                                  <Button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!storageConfigured || uploadingFile}
                                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Upload size={16} className="mr-2" />
                                    {uploadingFile ? 'Enviando arquivo...' : 'Enviar arquivo via Bunny'}
                                  </Button>
                                </div>
                                {!storageConfigured && (
                                  <p className="text-xs text-yellow-200/80">
                                    Configure a Storage Zone em Configurações &gt; Bunny para habilitar o upload.
                                  </p>
                                )}
                                {uploadingFile && (
                                  <p className="text-xs text-blue-100/80 animate-pulse">Upload em andamento, aguarde...</p>
                                )}
                              </div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleMaterialFileSelected}
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              />
                            </>
                          )}
                        </div>
                        {uploadFeedback && (
                          <div
                            className={`rounded-lg border p-3 text-sm ${
                              uploadFeedback.type === 'success'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                : 'border-red-500/40 bg-red-500/10 text-red-200'
                            }`}
                          >
                            {uploadFeedback.text}
                          </div>
                        )}
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
                          {(lessonForm.type === 'video' || lessonForm.type === 'text') && (
                            <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <p className="text-xs text-blue-100/80">
                                  Envie PDF, slides ou outros materiais para anexar à aula. O link é criado automaticamente.
                                </p>
                                <Button
                                  type="button"
                                  onClick={() => attachmentInputRef.current?.click()}
                                  disabled={!storageConfigured || uploadingAttachment}
                                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Upload size={16} className="mr-2" />
                                  {uploadingAttachment ? 'Enviando recurso...' : 'Enviar recurso via Bunny'}
                                </Button>
                              </div>
                              {!storageConfigured && (
                                <p className="mt-2 text-xs text-yellow-100/80">
                                  Configure a Storage Zone em Configurações &gt; Bunny para liberar o upload de materiais.
                                </p>
                              )}
                              {uploadingAttachment && (
                                <p className="mt-2 text-xs text-blue-100/80 animate-pulse">Upload em andamento, aguarde...</p>
                              )}
                              <input
                                ref={attachmentInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleAttachmentUpload}
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              />
                            </div>
                          )}
                          
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
                              Nenhum link adicionado. Clique em &quot;Adicionar Link&quot; para começar.
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
                  {lessonOrderSaving && (
                    <p className="text-xs text-emerald-300">Salvando ordem das aulas...</p>
                  )}
                  {lessons.length === 0 ? (
                    <div className="text-center py-12 bg-[#1a1a1a] rounded-lg border border-[#252525]">
                      <FileText size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400">Nenhuma aula criada</p>
                    </div>
                  ) : (
                    lessons.map((lesson) => {
                      const isDragging = draggingLessonId === lesson.id;
                      const isDragOver = dragOverLessonId === lesson.id;

                      return (
                        <div
                          key={lesson.id}
                          onDragOver={(event) => handleLessonDragOver(event, lesson.id)}
                          onDrop={(event) => handleLessonDrop(event, lesson.id)}
                          onDragEnd={handleLessonDragEnd}
                          onDragLeave={() => setDragOverLessonId(null)}
                          className={`bg-[#1a1a1a] border border-[#252525] rounded-lg p-4 transition-all select-none cursor-pointer ${
                            isDragging ? 'opacity-60' : 'hover:border-[#3a3a3a]'
                          } ${isDragOver && !isDragging ? 'border-emerald-500/60 ring-2 ring-emerald-500/20' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <button
                              type="button"
                              className="text-gray-500 mt-1 cursor-grab active:cursor-grabbing focus:outline-none"
                              draggable={!lessonOrderSaving}
                              onDragStart={(event) => handleLessonDragStart(event, lesson.id)}
                              onDragEnd={handleLessonDragEnd}
                            >
                              <GripVertical size={16} />
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded">
                                  {lesson.type}
                                </span>
                                <h3 className="font-semibold text-white">{lesson.title}</h3>
                              </div>
                              <p className="text-sm text-gray-400 line-clamp-2">
                                {lesson.type === 'text' ? `${lesson.content.substring(0, 100)}...` : lesson.content}
                              </p>
                              {lesson.duration > 0 && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Duração: {Math.floor(lesson.duration / 60)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                                </p>
                              )}
                            </div>
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
                      );
                    })
                  )}
                  {lessons.length > 0 && (
                    <div
                      className={`transition-all ${
                        draggingLessonId
                          ? `h-4 rounded border border-dashed border-emerald-500/40 ${
                              dragOverLessonId === '__end' ? 'bg-emerald-500/10' : 'bg-transparent'
                            }`
                          : 'h-0 overflow-hidden'
                      }`}
                      onDragOver={(event) => handleLessonDragOver(event, '__end')}
                      onDrop={(event) => handleLessonDrop(event, '__end')}
                      onDragLeave={() => setDragOverLessonId(null)}
                    />
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
