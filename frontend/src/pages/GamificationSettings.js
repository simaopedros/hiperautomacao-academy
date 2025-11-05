import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';

export default function GamificationSettings({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Gamificação</h1>
          <p className="text-gray-400">Sistema de gamificação da plataforma</p>
        </div>

        <div className="bg-[#111111] rounded-lg border border-[#252525] p-8">
          <div className="text-center">
            <Info className="mx-auto text-gray-400 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-white mb-4">Sistema de Gamificação Removido</h2>
            <p className="text-gray-400 text-lg mb-6">
              O sistema de gamificação e créditos foi removido da plataforma.
            </p>
            <p className="text-gray-500">
              Esta página não está mais em uso. O foco agora está nos cursos e no sistema de indicações.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
