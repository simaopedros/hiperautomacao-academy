import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, 
  MessageCircle, 
  LogOut, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const UnifiedHeader = ({ 
  user, 
  onLogout, 
  showInsights, 
  setShowInsights, 
  setShowLanguageSettings,
  showBackButton = false,
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isCurrentPage = (path) => location.pathname === path;

  const navigationItems = [
    {
      path: '/dashboard',
      label: t('dashboard.myCourses'),
      icon: BookOpen,
      testId: 'courses-nav'
    },
    {
      path: '/social',
      label: t('dashboard.social'),
      icon: MessageCircle,
      testId: 'social-nav'
    }
  ];

  return (
    <header 
      className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-2xl sticky top-0"
      role="banner"
      aria-label="Cabeçalho principal da aplicação"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Back Button for Subscribe Page */}
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-xl mr-2"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg"
                aria-hidden="true"
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Hiperautomação
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav 
              className="hidden md:flex gap-3 text-sm"
              role="navigation"
              aria-label="Navegação principal"
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = isCurrentPage(item.path);
                
                return (
                  <button
                    key={item.path}
                    data-testid={item.testId}
                    onClick={() => navigate(item.path)}
                    className={`chip transition-all duration-300 ${
                      isCurrent
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : 'border-white/15 text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={`Ir para ${item.label}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Right Side Controls */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Insights Toggle (only for dashboard) */}
            {setShowInsights && (
              <button
                onClick={() => setShowInsights((prev) => !prev)}
                className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {showInsights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showInsights ? 'Ocultar visão geral' : 'Mostrar visão geral'}
              </button>
            )}
            
            {/* User Info */}
            {user && (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-emerald-500/20 hover:ring-emerald-400/40 transition-all duration-300 hover:scale-105"
                    aria-label={`Ir para perfil de ${user.name}`}
                    title="Configurações do Perfil"
                  >
                    {user.name[0].toUpperCase()}
                  </button>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-400">{t('dashboard.welcome')}</p>
                    <p className="font-semibold text-white">{user.name}</p>
                  </div>
                </div>
                
                {/* Language Settings removed from top navigation */}
                
                {/* Logout Button */}
                <button
                  data-testid="logout-button"
                  onClick={onLogout}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
                  title={t('dashboard.logout')}
                  aria-label="Sair da conta"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav 
          className="flex md:hidden gap-2 overflow-x-auto pb-2"
          role="navigation"
          aria-label="Navegação móvel"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = isCurrentPage(item.path);
            
            return (
              <button
                key={`mobile-${item.path}`}
                onClick={() => navigate(item.path)}
                className={`chip whitespace-nowrap transition-all duration-300 ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                    : 'border-white/15 text-gray-200 hover:text-white hover:bg-white/5'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Ir para ${item.label}`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default UnifiedHeader;