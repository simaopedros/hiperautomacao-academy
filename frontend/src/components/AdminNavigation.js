import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Mail,
  MessageCircle,
  Gift,
  DollarSign,
  CreditCard,
  FolderOpen,
  GraduationCap,
  UserCheck,
  HeadphonesIcon,
  BarChart3,
  Database,
  UploadCloud
} from 'lucide-react';

const AdminNavigation = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showContentMenu, setShowContentMenu] = useState(false);
  const [showUsersMenu, setShowUsersMenu] = useState(false);
  const [showFinanceMenu, setShowFinanceMenu] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);

  // Fechar menus quando clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContentMenu(false);
      setShowUsersMenu(false);
      setShowFinanceMenu(false);
      setShowConfigMenu(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
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
                  location.pathname.includes('/admin/users') || 
                  location.pathname.includes('/admin/community') ||
                  location.pathname.includes('/admin/gamification')
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
                <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg min-w-[240px] z-50">
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
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Config. Pagamentos
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/admin/webhook-monitor');
                      setShowFinanceMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                  >
                    <Settings size={16} />
                    Monitor de Webhooks
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
                  location.pathname.includes('/admin/media')
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
                      navigate('/admin/replication');
                      setShowConfigMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-t-lg"
                  >
                    <Database size={16} />
                    Replicação MongoDB
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/admin/email-settings');
                      setShowConfigMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
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
                    navigate('/admin/support');
                    setShowConfigMenu(false);
                  }}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2"
                  >
                    <HeadphonesIcon size={16} />
                    Configurar Suporte
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/admin/media');
                      setShowConfigMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#252525] transition-colors flex items-center gap-2 rounded-b-lg"
                  >
                    <UploadCloud size={16} />
                    Bunny Vídeos & Arquivos
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-emerald-500/20 hover:ring-emerald-400/40 transition-all duration-300 hover:scale-105"
              title="Configurações do Perfil"
              aria-label={`Ir para perfil de ${user?.name || 'Admin'}`}
            >
              {(user?.name || 'Admin')[0].toUpperCase()}
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-400">{t('navigation.dashboard')}</p>
              <p className="font-semibold text-white">{user?.name || 'Admin'}</p>
            </div>
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
  );
};

export default AdminNavigation;
