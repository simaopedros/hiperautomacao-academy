import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Plus, Edit, Trash2, BookOpen, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserManagement({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userEnrollments, setUserEnrollments] = useState([]);
  const navigate = useNavigate();

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    full_access: false
  });

  const [enrollForm, setEnrollForm] = useState({
    course_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchCourses();
  }, []);

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
        await axios.put(`${API}/admin/users/${editingUser.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/admin/users`, userForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowUserDialog(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role: 'student', full_access: false });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao salvar usuário');
    }
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

  const handleEnrollUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/enrollments`, {
        user_id: selectedUser.id,
        course_id: enrollForm.course_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnrollForm({ course_id: '' });
      fetchUserEnrollments(selectedUser.id);
      alert('Usuário matriculado com sucesso!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao matricular usuário');
    }
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
            <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white">
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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="full_access"
                    checked={userForm.full_access}
                    onChange={(e) => setUserForm({ ...userForm, full_access: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="full_access" className="cursor-pointer">
                    Acesso completo (todos os cursos)
                  </Label>
                </div>
                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  {editingUser ? 'Atualizar' : 'Criar'} Usuário
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-[#252525]">
            <Users size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {users.map((u) => (
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
                      <div className="flex gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          u.role === 'admin' 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {u.role === 'admin' ? 'Administrador' : 'Aluno'}
                        </span>
                        {u.full_access ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <CheckCircle size={14} />
                            Acesso Total
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 flex items-center gap-1">
                            <XCircle size={14} />
                            Acesso Limitado
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
        )}

        {/* Enrollment Dialog */}
        <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
          <DialogContent className="bg-[#1a1a1a] border-[#252525] text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Cursos - {selectedUser?.name}</DialogTitle>
            </DialogHeader>
            
            {selectedUser?.full_access ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <CheckCircle size={48} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-emerald-400 font-semibold">Este usuário tem acesso total</p>
                <p className="text-gray-400 text-sm mt-1">Acesso a todos os cursos da plataforma</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleEnrollUser} className="space-y-4">
                  <div>
                    <Label>Adicionar Curso</Label>
                    <div className="flex gap-2">
                      <select
                        value={enrollForm.course_id}
                        onChange={(e) => setEnrollForm({ course_id: e.target.value })}
                        required
                        className="flex-1 bg-[#111111] border border-[#2a2a2a] text-white py-2 px-3 rounded-lg"
                      >
                        <option value="">Selecione um curso</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="mt-6">
                  <h4 className="font-semibold text-white mb-3">Cursos Matriculados</h4>
                  {userEnrollments.length === 0 ? (
                    <div className="text-center py-8 bg-[#111111] rounded-lg border border-[#252525]">
                      <p className="text-gray-400">Nenhum curso atribuído</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userEnrollments.map((enrollment) => (
                        <div
                          key={enrollment.enrollment_id}
                          className="flex justify-between items-center bg-[#111111] rounded-lg p-3 border border-[#252525]"
                        >
                          <span className="text-white">{enrollment.course_title}</span>
                          <Button
                            onClick={() => handleRemoveEnrollment(selectedUser.id, enrollment.course_id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
