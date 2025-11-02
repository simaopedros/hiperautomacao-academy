import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AdminNavigation from '../components/AdminNavigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminCategories({ user, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', icon: 'FolderOpen', color: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/categories`, { headers: { Authorization: `Bearer ${token}` } });
      setCategories(res.data);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', icon: 'FolderOpen', color: '' });
    setShowDialog(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description, icon: cat.icon || 'FolderOpen', color: cat.color || '' });
    setShowDialog(true);
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editing) {
        await axios.put(`${API}/admin/categories/${editing.id}`, form, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API}/admin/categories`, form, { headers: { Authorization: `Bearer ${token}` } });
      }
      setShowDialog(false);
      setEditing(null);
      await fetchCategories();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao salvar categoria');
    }
  };

  const deleteCategory = async (cat) => {
    if (!confirm(`Excluir categoria "${cat.name}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/categories/${cat.id}`, { headers: { Authorization: `Bearer ${token}` } });
      await fetchCategories();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erro ao excluir categoria');
    }
  };

  const IconComp = ({ name, className }) => {
    const IconEl = Icons[name] || Icons.FolderOpen;
    return <IconEl className={className} size={20} />;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <AdminNavigation user={user} onLogout={onLogout} />
      
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Categorias</h1>
            <p className="text-gray-400">Gerencie as categorias dos cursos</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-500">Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#121212] border border-[#2a2a2a]">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Categoria' : 'Criar Categoria'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveCategory} className="space-y-4">
                <div>
                  <Label htmlFor="cat-name">Nome</Label>
                  <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="cat-desc">Descrição</Label>
                  <Textarea id="cat-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cat-icon">Ícone (lucide)</Label>
                    <Input id="cat-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                    <div className="mt-2 flex items-center gap-2 text-gray-400">
                      <IconComp name={form.icon} />
                      <span className="text-xs">Ex.: FolderOpen, BookOpen, Users</span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cat-color">Cor (Tailwind)</Label>
                    <Input id="cat-color" placeholder="text-emerald-400" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">Salvar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        {loading ? (
          <p className="text-gray-400">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <IconComp name={cat.icon} className={cat.color || 'text-emerald-400'} />
                  <div>
                    <h2 className="font-semibold">{cat.name}</h2>
                    <p className="text-sm text-gray-400">{cat.description}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => openEdit(cat)}>Editar</Button>
                  <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => deleteCategory(cat)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}