import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

export default function GamificationSettings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#252525] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <Info className="text-gray-400" size={24} />
              <h1 className="text-2xl font-bold text-white">Gamificação</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
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
