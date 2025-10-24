import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Plus, Edit, Trash2, BookOpen, CheckCircle, XCircle, ArrowLeft, Upload, Download, Settings, Mail, Key, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserManagement({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [bulkImportAccessType, setBulkImportAccessType] = useState('courses');
  const [bulkImportCourses, setBulkImportCourses] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userEnrollments, setUserEnrollments] = useState([]);
  
  // Filtros e Paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterAccessType, setFilterAccessType] = useState('all'); // all, full_access, enrolled, invited
  const [filterRole, setFilterRole] = useState('all'); // all, student, admin
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  
  const navigate = useNavigate();

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    access_type: 'courses', // 'full' or 'courses'
    selected_courses: []
  });

  const [enrollForm, setEnrollForm] = useState({
    access_type: 'courses', // 'full' or 'courses'
    selected_courses: []
  });

  useEffect(() => {
    fetchUsers();
    fetchCourses();
  }, []);

  // Aplicar filtros sempre que mudar
  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, filterCourse, filterAccessType, filterRole]);

  const applyFilters = () => {
    let filtered = [...users];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por curso
    if (filterCourse !== 'all') {
      filtered = filtered.filter(u => {
        if (u.has_full_access) return true;
        return u.enrolled_courses && u.enrolled_courses.includes(filterCourse);
      });
    }

    // Filtro por tipo de acesso
    if (filterAccessType === 'full_access') {
      filtered = filtered.filter(u => u.has_full_access);
    } else if (filterAccessType === 'enrolled') {
      filtered = filtered.filter(u => !u.has_full_access && u.enrolled_courses && u.enrolled_courses.length > 0);
    } else if (filterAccessType === 'invited') {
      filtered = filtered.filter(u => u.invited && !u.password_created);
    } else if (filterAccessType === 'accepted') {
      filtered = filtered.filter(u => u.invited && u.password_created);
    }

    // Filtro por role
    if (filterRole !== 'all') {
      filtered = filtered.filter(u => u.role === filterRole);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset para primeira página ao filtrar
  };

  // Paginação
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchUserEnrollments = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/enrollments/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserEnrollments(response.data);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (editingUser) {
        const updateData = { ...userForm };
        if (!updateData.password) {
          delete updateData.password;
        }
        // Remove campos de acesso do update (não usado na edição)
        delete updateData.access_type;
        delete updateData.selected_courses;
        
        await axios.put(`${API}/admin/users/${editingUser.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Criar novo usuário
        const userData = {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          has_full_access: userForm.access_type === 'full'
        };
        
        // Criar usuário
        const response = await axios.post(`${API}/admin/users`, userData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const newUserId = response.data.id;
        
        // Se acesso for por cursos específicos, matricular
        if (userForm.access_type === 'courses' && userForm.selected_courses.length > 0) {
          for (const courseId of userForm.selected_courses) {
            await axios.post(`${API}/admin/enrollments`, {
              user_id: newUserId,
              course_id: courseId
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        }
      }
      
      setShowUserDialog(false);
      setEditingUser(null);
      setUserForm({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'student', 
        access_type: 'courses',
        selected_courses: []
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao salvar usuário');
    }
  };

  const toggleUserCourseSelection = (courseId) => {
    setUserForm(prev => {
      const isSelected = prev.selected_courses.includes(courseId);
      return {
        ...prev,
        selected_courses: isSelected
          ? prev.selected_courses.filter(id => id !== courseId)
          : [...prev.selected_courses, courseId]
      };
    });
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao excluir usuário');
    }
  };

  const handleResendPasswordEmail = async (userId) => {
    if (!window.confirm('Reenviar email de criação de senha para este usuário?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/users/${userId}/resend-password-email`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Email enviado com sucesso!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao enviar email');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Resetar senha deste usuário? Um email será enviado para ele criar uma nova senha.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/users/${userId}/reset-password`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Senha resetada e email enviado com sucesso!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao resetar senha');
    }
  };

  const handleEnrollUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (enrollForm.access_type === 'full') {
        // Set full access
        await axios.put(`${API}/admin/users/${selectedUser.id}`, {
          has_full_access: true
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Usuário agora tem acesso completo à plataforma!');
      } else {
        // Enroll in selected courses
        if (enrollForm.selected_courses.length === 0) {
          alert('Selecione pelo menos um curso');
          return;
        }
        
        // Enroll in multiple courses
        for (const courseId of enrollForm.selected_courses) {
          await axios.post(`${API}/admin/enrollments`, {
            user_id: selectedUser.id,
            course_id: courseId
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        alert(`Usuário matriculado em ${enrollForm.selected_courses.length} curso(s) com sucesso!`);
      }
      
      setEnrollForm({ access_type: 'courses', selected_courses: [] });
      setShowEnrollDialog(false);
      fetchUsers();
      if (selectedUser) {
        fetchUserEnrollments(selectedUser.id);
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao atualizar acesso do usuário');
    }
  };

  const toggleCourseSelection = (courseId) => {
    setEnrollForm(prev => {
      const isSelected = prev.selected_courses.includes(courseId);
      return {
        ...prev,
        selected_courses: isSelected
          ? prev.selected_courses.filter(id => id !== courseId)
          : [...prev.selected_courses, courseId]
      };
    });
  };

  const handleRemoveEnrollment = async (userId, courseId) => {
    if (!window.confirm('Remover acesso a este curso?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/enrollments/user/${userId}/course/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUserEnrollments(userId);
    } catch (error) {
      alert('Erro ao remover matrícula');
    }
  };

  const openEnrollDialog = (user) => {
    setSelectedUser(user);
    fetchUserEnrollments(user.id);
    setShowEnrollDialog(true);
  };

  const toggleBulkCourseSelection = (courseId) => {
    setBulkImportCourses(prev => {
      const isSelected = prev.includes(courseId);
      return isSelected
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId];
    });
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    
    if (!csvFile) {
      alert('Selecione um arquivo CSV');
      return;
    }
    
    if (bulkImportAccessType === 'courses' && bulkImportCourses.length === 0) {
      alert('Selecione pelo menos um curso');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        // Use TextEncoder for proper UTF-8 to base64 conversion
        const text = event.target.result;
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(text);
        
        // Convert to base64
        let binary = '';
        uint8Array.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        const base64Content = btoa(binary);
        
        const response = await axios.post(`${API}/admin/bulk-import`, {
          has_full_access: bulkImportAccessType === 'full',
          course_ids: bulkImportAccessType === 'courses' ? bulkImportCourses : [],
          csv_content: base64Content
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setImportResult(response.data);
        setCsvFile(null);
        setBulkImportAccessType('courses');
        setBulkImportCourses([]);
        fetchUsers();
      };

      reader.readAsText(csvFile);
    } catch (error) {
      setImportResult({
        message: error.response?.data?.detail || 'Erro ao importar usuários',
        imported_count: 0,
        errors: [error.message]
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'name,email\\nJoão Silva,joao@example.com\\nMaria Santos,maria@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_importacao.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
              <h1 className="text-xl font-bold text-white">Gerenciar Usuários</h1>
              <p className="text-sm text-gray-400">Controle de acesso e matrículas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Usuários da Plataforma</h2>
            <p className="text-gray-400">Gerencie usuários e suas permissões de acesso</p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/admin/email-settings')}
              variant="outline"
              className="border-[#2a2a2a] hover:bg-[#252525]"
            >
              <Settings size={18} className="mr-2" />
              Config. Email
            </Button>
            <Button
              onClick={() => setShowBulkImportDialog(true)}
              variant="outline"
              className="border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
            >
              <Upload size={18} className="mr-2" />
              Importar CSV
            </Button>
          </div>
          
          {/* Create User Dialog */}
          <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
            <DialogTrigger asChild>
              <Button
                data-testid="create-user-button"
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ name: '', email: '', password: '', role: 'student', full_access: false });
                }}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Plus size={20} className="mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Editar' : 'Criar Novo'} Usuário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    required
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    required
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>Senha {editingUser && '(deixe em branco para manter)'}</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    required={!editingUser}
                    className="bg-[#111111] border-[#2a2a2a]"
                  />
                </div>
                <div>
                  <Label>Tipo de Usuário</Label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
                  >
                    <option value="student">Aluno</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Access Type Selection - Only for new users */}
                {!editingUser && (
                  <>
                    <div className="border-t border-[#2a2a2a] pt-4">
                      <Label className="text-base font-semibold mb-3 block">Tipo de Acesso</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div 
                          onClick={() => setUserForm({ ...userForm, access_type: 'full', selected_courses: [] })}
                          className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                            userForm.access_type === 'full'
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              userForm.access_type === 'full' ? 'border-emerald-500' : 'border-gray-500'
                            }`}>
                              {userForm.access_type === 'full' && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              )}
                            </div>
                            <span className="font-medium">Acesso Completo</span>
                          </div>
                        </div>

                        <div 
                          onClick={() => setUserForm({ ...userForm, access_type: 'courses' })}
                          className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                            userForm.access_type === 'courses'
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              userForm.access_type === 'courses' ? 'border-blue-500' : 'border-gray-500'
                            }`}>
                              {userForm.access_type === 'courses' && (
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              )}
                            </div>
                            <span className="font-medium">Cursos Específicos</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Course Selection */}
                    {userForm.access_type === 'courses' && (
                      <div className="space-y-3">
                        <Label className="text-sm">
                          Selecionar Cursos ({userForm.selected_courses.length} selecionado(s))
                        </Label>
                        <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                          {courses.length === 0 ? (
                            <p className="text-center text-gray-400 py-4 text-sm">Nenhum curso disponível</p>
                          ) : (
                            courses.map((course) => (
                              <div
                                key={course.id}
                                onClick={() => toggleUserCourseSelection(course.id)}
                                className="flex items-center gap-2 p-2 rounded hover:bg-[#1a1a1a] cursor-pointer"
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  userForm.selected_courses.includes(course.id)
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-500'
                                }`}>
                                  {userForm.selected_courses.includes(course.id) && (
                                    <CheckCircle size={12} className="text-white" />
                                  )}
                                </div>
                                <span className="text-sm text-white">{course.title}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  {editingUser ? 'Atualizar' : 'Criar'} Usuário
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Filtros e Busca</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Campo de Busca */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-gray-400 text-sm mb-2">Buscar</Label>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#111111] border-[#2a2a2a] pl-10"
                />
              </div>
            </div>

            {/* Filtro por Curso */}
            <div>
              <Label className="text-gray-400 text-sm mb-2">Curso</Label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
              >
                <option value="all">Todos os cursos</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Tipo de Acesso */}
            <div>
              <Label className="text-gray-400 text-sm mb-2">Tipo de Acesso</Label>
              <select
                value={filterAccessType}
                onChange={(e) => setFilterAccessType(e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
              >
                <option value="all">Todos</option>
                <option value="full_access">Acesso Completo</option>
                <option value="enrolled">Com Matrícula</option>
                <option value="invited">Convidados (Pendente)</option>
                <option value="accepted">Convites Aceitos</option>
              </select>
            </div>

            {/* Filtro por Role */}
            <div>
              <Label className="text-gray-400 text-sm mb-2">Tipo de Usuário</Label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
              >
                <option value="all">Todos</option>
                <option value="student">Alunos</option>
                <option value="admin">Administradores</option>
              </select>
            </div>
          </div>

          {/* Resumo dos Resultados */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-400">
              Mostrando <span className="text-emerald-400 font-semibold">{currentUsers.length}</span> de{' '}
              <span className="text-emerald-400 font-semibold">{filteredUsers.length}</span> usuários
              {filteredUsers.length !== users.length && (
                <span className="text-gray-500"> (filtrados de {users.length} total)</span>
              )}
            </p>
            {(searchTerm || filterCourse !== 'all' || filterAccessType !== 'all' || filterRole !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterCourse('all');
                  setFilterAccessType('all');
                  setFilterRole('all');
                }}
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <Users size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {currentUsers.map((u) => (
              <div
                key={u.id}
                className="bg-[#1a1a1a] border border-[#252525] rounded-xl p-6 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{u.name}</h3>
                      <p className="text-gray-400 mb-2">{u.email}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          u.role === 'admin' 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {u.role === 'admin' ? 'Administrador' : 'Aluno'}
                        </span>
                        {u.has_full_access ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <CheckCircle size={14} />
                            Acesso Total
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 flex items-center gap-1">
                            <XCircle size={14} />
                            {u.enrolled_courses?.length || 0} curso(s)
                          </span>
                        )}
                        {u.invited && !u.password_created && (
                          <span className="text-xs px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                            <Mail size={14} />
                            Convite Pendente
                          </span>
                        )}
                        {u.invited && u.password_created && (
                          <span className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                            <CheckCircle size={14} />
                            Convite Aceito
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {u.role !== 'admin' && (
                      <Button
                        onClick={() => openEnrollDialog(u)}
                        variant="outline"
                        size="sm"
                        className="border-[#2a2a2a] hover:bg-[#252525]"
                      >
                        <BookOpen size={16} className="mr-2" />
                        Cursos
                      </Button>
                    )}
                    <Button
                      onClick={() => handleResendPasswordEmail(u.id)}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                      title="Reenviar email de acesso"
                    >
                      <Mail size={16} />
                    </Button>
                    <Button
                      onClick={() => handleResetPassword(u.id)}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                      title="Resetar senha"
                    >
                      <Key size={16} />
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingUser(u);
                        setUserForm({
                          name: u.name,
                          email: u.email,
                          password: '',
                          role: u.role,
                          full_access: u.full_access || false
                        });
                        setShowUserDialog(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] hover:bg-[#252525]"
                    >
                      <Edit size={16} />
                    </Button>
                    {u.id !== user.id && (
                      <Button
                        onClick={() => handleDeleteUser(u.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="border-[#2a2a2a] hover:bg-[#252525]"
              >
                <ChevronLeft size={16} />
              </Button>
              
              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  // Mostrar apenas páginas próximas
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        className={
                          currentPage === pageNumber
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : "border-[#2a2a2a] hover:bg-[#252525]"
                        }
                      >
                        {pageNumber}
                      </Button>
                    );
                  } else if (
                    pageNumber === currentPage - 2 ||
                    pageNumber === currentPage + 2
                  ) {
                    return <span key={pageNumber} className="px-2 text-gray-500">...</span>;
                  }
                  return null;
                })}
              </div>

              <Button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="border-[#2a2a2a] hover:bg-[#252525]"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
          </>
        )}

        {/* Enrollment Dialog */}
        <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
          <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Acesso - {selectedUser?.name}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleEnrollUser} className="space-y-6">
              {/* Access Type Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Tipo de Acesso</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Access Option */}
                  <div 
                    onClick={() => setEnrollForm({ ...enrollForm, access_type: 'full', selected_courses: [] })}
                    className={`cursor-pointer border-2 rounded-xl p-6 transition-all ${
                      enrollForm.access_type === 'full'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        enrollForm.access_type === 'full' ? 'border-emerald-500' : 'border-gray-500'
                      }`}>
                        {enrollForm.access_type === 'full' && (
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle size={20} className="text-emerald-400" />
                          <h4 className="font-semibold">Acesso Completo</h4>
                        </div>
                        <p className="text-sm text-gray-400">
                          Acesso ilimitado a todos os cursos da plataforma
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Specific Courses Option */}
                  <div 
                    onClick={() => setEnrollForm({ ...enrollForm, access_type: 'courses' })}
                    className={`cursor-pointer border-2 rounded-xl p-6 transition-all ${
                      enrollForm.access_type === 'courses'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        enrollForm.access_type === 'courses' ? 'border-blue-500' : 'border-gray-500'
                      }`}>
                        {enrollForm.access_type === 'courses' && (
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen size={20} className="text-blue-400" />
                          <h4 className="font-semibold">Cursos Específicos</h4>
                        </div>
                        <p className="text-sm text-gray-400">
                          Selecionar cursos individuais para este usuário
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Selection (only when access_type is 'courses') */}
              {enrollForm.access_type === 'courses' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Selecionar Cursos</Label>
                    <span className="text-sm text-gray-400">
                      {enrollForm.selected_courses.length} curso(s) selecionado(s)
                    </span>
                  </div>
                  
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-2">
                    {courses.length === 0 ? (
                      <p className="text-center text-gray-400 py-4">Nenhum curso disponível</p>
                    ) : (
                      courses.map((course) => (
                        <div
                          key={course.id}
                          onClick={() => toggleCourseSelection(course.id)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            enrollForm.selected_courses.includes(course.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-500'
                          }`}>
                            {enrollForm.selected_courses.includes(course.id) && (
                              <CheckCircle size={16} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-white truncate">{course.title}</h5>
                            {course.description && (
                              <p className="text-xs text-gray-400 truncate">{course.description}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {enrollForm.selected_courses.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <CheckCircle size={16} />
                      <span>{enrollForm.selected_courses.length} curso(s) será(ão) atribuído(s)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Current Enrollments */}
              {selectedUser && !selectedUser.has_full_access && userEnrollments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cursos Já Matriculados</Label>
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 space-y-2">
                    {userEnrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between p-2 rounded bg-[#1a1a1a]"
                      >
                        <span className="text-white text-sm">{enrollment.course_title}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnrollment(selectedUser.id, enrollment.course_id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowEnrollDialog(false)}
                  variant="outline"
                  className="flex-1 border-[#2a2a2a] hover:bg-[#252525]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className={`flex-1 ${
                    enrollForm.access_type === 'full'
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  disabled={enrollForm.access_type === 'courses' && enrollForm.selected_courses.length === 0}
                >
                  {enrollForm.access_type === 'full' ? 'Conceder Acesso Completo' : `Matricular em ${enrollForm.selected_courses.length} Curso(s)`}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Bulk Import Dialog */}
        <Dialog open={showBulkImportDialog} onOpenChange={setShowBulkImportDialog}>
          <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importação em Massa de Usuários</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleBulkImport} className="space-y-4">
              {/* Access Type Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Tipo de Acesso para Usuários Importados</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div 
                    onClick={() => {
                      setBulkImportAccessType('full');
                      setBulkImportCourses([]);
                    }}
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                      bulkImportAccessType === 'full'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        bulkImportAccessType === 'full' ? 'border-emerald-500' : 'border-gray-500'
                      }`}>
                        {bulkImportAccessType === 'full' && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        )}
                      </div>
                      <span className="font-medium">Acesso Completo</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setBulkImportAccessType('courses')}
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                      bulkImportAccessType === 'courses'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        bulkImportAccessType === 'courses' ? 'border-blue-500' : 'border-gray-500'
                      }`}>
                        {bulkImportAccessType === 'courses' && (
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                      </div>
                      <span className="font-medium">Cursos Específicos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Selection */}
              {bulkImportAccessType === 'courses' && (
                <div className="space-y-3">
                  <Label className="text-sm">
                    Selecionar Cursos ({bulkImportCourses.length} selecionado(s))
                  </Label>
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                    {courses.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-sm">Nenhum curso disponível</p>
                    ) : (
                      courses.map((course) => (
                        <div
                          key={course.id}
                          onClick={() => toggleBulkCourseSelection(course.id)}
                          className="flex items-center gap-2 p-2 rounded hover:bg-[#1a1a1a] cursor-pointer"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            bulkImportCourses.includes(course.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-500'
                          }`}>
                            {bulkImportCourses.includes(course.id) && (
                              <CheckCircle size={12} className="text-white" />
                            )}
                          </div>
                          <span className="text-sm text-white">{course.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <Label>Arquivo CSV</Label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    required
                    className="w-full bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-600"
                  />
                  <Button
                    type="button"
                    onClick={downloadTemplate}
                    variant="outline"
                    className="border-[#2a2a2a] hover:bg-[#252525] text-sm"
                  >
                    <Download size={16} className="mr-2" />
                    Baixar Template CSV
                  </Button>
                </div>
              </div>
              
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">Formato do CSV:</h4>
                <p className="text-gray-400 text-sm mb-2">O arquivo deve conter as colunas: name, email</p>
                <code className="text-xs text-cyan-400 bg-[#0a0a0a] p-2 rounded block">
                  name,email<br/>
                  João Silva,joao@example.com<br/>
                  Maria Santos,maria@example.com
                </code>
              </div>
              
              <Button 
                type="submit" 
                disabled={importing || (bulkImportAccessType === 'courses' && bulkImportCourses.length === 0)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {importing ? 'Importando...' : 'Importar Usuários'}
              </Button>
            </form>
            
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg border ${
                importResult.imported_count > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <h4 className="font-semibold mb-2">Resultado da Importação:</h4>
                <p className="text-sm mb-2">
                  Usuários importados: {importResult.imported_count}
                </p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Erros:</p>
                    <ul className="text-xs space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-red-400">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {importResult.message && (
                  <p className="text-sm mt-2">{importResult.message}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
