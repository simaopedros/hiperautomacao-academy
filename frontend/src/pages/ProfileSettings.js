import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  Mail,
  Lock,
  Globe,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Camera,
  Trash2,
  Settings,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '../hooks/useI18n';
import UnifiedHeader from '../components/UnifiedHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProfileSettings({ user, onLogout }) {
  const { t, changeLanguage, getCurrentLanguage } = useI18n();
  const navigate = useNavigate();
  const statusLabelFallbacks = {
    ativa: 'Assinatura ativa',
    inativa: 'Assinatura inativa',
    ativa_ate_final_do_periodo: 'Assinatura ativa até o final do período',
    ativa_com_renovacao_automatica: 'Assinatura ativa com renovação automática',
    cancelada: 'Assinatura cancelada',
    expirada: 'Assinatura expirada'
  };

  const getSubscriptionStatusLabel = (status) => {
    if (!status) return null;
    const fallback = statusLabelFallbacks[status] || status;
    return t(`profile.subscription.status.statusTag.${status}`, fallback);
  };
  
  // Estados para dados do perfil
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    preferred_language: user?.preferred_language || 'pt-BR',
    avatar_url: user?.avatar_url || ''
  });

  // Estados para alteração de senha
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Estados para preferências
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    course_reminders: true,
    social_notifications: true,
    marketing_emails: false
  });

  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Estados para assinaturas
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const effectiveSubscriptionStatus = subscriptionData?.status || user?.subscription_status;
  const getSubscriptionPlanName = () => {
    if (!subscriptionData?.subscription_plan_id) return null;
    const plan = subscriptionData.subscription_plan;
    if (plan) {
      return plan.name || plan.display_name || plan.title || plan.id;
    }
    return subscriptionData.subscription_plan_name || subscriptionData.subscription_plan_id;
  };
  const planDisplayName = getSubscriptionPlanName();

  useEffect(() => {
    fetchUserPreferences();
    fetchSubscriptionData();
    fetchSubscriptionPlans();
  }, []);

  const fetchUserPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/user/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreferences(response.data);
    } catch (error) {
      console.error('Erro ao buscar preferências:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      
      // Converter código de idioma completo para código simples que o backend espera
      const profileDataToSend = { ...profileData };
      if (profileDataToSend.preferred_language) {
        if (profileDataToSend.preferred_language === 'pt-BR') {
          profileDataToSend.preferred_language = 'pt';
        } else if (profileDataToSend.preferred_language === 'en-US') {
          profileDataToSend.preferred_language = 'en';
        } else if (profileDataToSend.preferred_language === 'es-ES') {
          profileDataToSend.preferred_language = 'es';
        }
      }
      
      const response = await axios.put(`${API}/user/profile`, profileDataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Atualizar dados do usuário no localStorage com o código simples
      const updatedUser = { ...user, ...profileDataToSend };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Atualizar idioma se foi alterado
      if (profileData.preferred_language !== getCurrentLanguage()) {
        await changeLanguage(profileData.preferred_language);
        
        // Forçar recarregamento da página para atualizar os cursos no dashboard
        // Isso garante que os cursos sejam filtrados corretamente pelo novo idioma
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao atualizar perfil' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao alterar senha' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/user/preferences`, preferences, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: 'Preferências atualizadas com sucesso!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao atualizar preferências' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/user/account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onLogout();
      navigate('/login');
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao excluir conta' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Funções para gerenciar assinaturas
  const fetchSubscriptionData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/user/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionData(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados de assinatura:', error);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/plans`);
      setSubscriptionPlans(response.data);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    }
  };

  const handleSubscribe = async (planId) => {
    setLoadingSubscription(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/billing/create`,
        {
          subscription_plan_id: planId,
          customer_name: user.name,
          customer_email: user.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.payment_url) {
        window.location.href = response.data.payment_url;
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Erro ao processar assinatura'
      });
    } finally {
      setLoadingSubscription(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01030a] via-[#050b16] to-[#02060f]">
      <UnifiedHeader 
        user={user} 
        onLogout={onLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="glass-panel rounded-3xl border border-white/10 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.55)] animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                {t('profile.header.title', 'Configurações do Perfil')}
              </h1>
              <p className="text-gray-300 text-lg">
                {t('profile.header.subtitle', 'Gerencie suas informações pessoais e preferências da conta')}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {user?.role === 'admin' ? t('profile.role.admin', 'Administrador') : t('profile.role.student', 'Estudante')}
                </Badge>
                {effectiveSubscriptionStatus && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {getSubscriptionStatusLabel(effectiveSubscriptionStatus)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`glass-panel rounded-2xl border p-6 flex items-center gap-4 animate-fade-in ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-400" />
            )}
            <span className={message.type === 'success' ? 'text-emerald-200' : 'text-red-200'}>
              {message.text}
            </span>
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="glass-panel rounded-2xl border border-white/10 p-2 bg-black/40 backdrop-blur-xl grid w-full grid-cols-5">
            <TabsTrigger 
              value="profile" 
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-400/30 rounded-xl transition-all duration-300"
            >
              <User className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('profile.tabs.profile', 'Perfil')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-400/30 rounded-xl transition-all duration-300"
            >
              <Lock className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('profile.tabs.security', 'Segurança')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="subscription" 
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-400/30 rounded-xl transition-all duration-300"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('profile.tabs.subscription', 'Assinaturas')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="preferences" 
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-400/30 rounded-xl transition-all duration-300"
            >
              <Bell className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('profile.tabs.preferences', 'Preferências')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-200 data-[state=active]:border-red-400/30 rounded-xl transition-all duration-300"
            >
              <Shield className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('profile.tabs.account', 'Conta')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Profile Information */}
          <TabsContent value="profile" className="animate-fade-in">
            <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
              <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <User className="w-6 h-6 text-emerald-400" />
                  {t('profile.personal.title', 'Informações Pessoais')}
                </h2>
                <p className="text-gray-300 mt-2">
                  {t('profile.personal.subtitle', 'Atualize suas informações básicas e preferências de idioma')}
                </p>
              </div>
              <div className="p-8">
                <form onSubmit={handleProfileUpdate} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-white font-medium">{t('profile.fields.name', 'Nome Completo')}</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                        className="bg-white/5 border-white/10 text-white rounded-xl p-4 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300"
                        placeholder={t('profile.fields.namePlaceholder', 'Seu nome completo')}
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-white font-medium">{t('profile.fields.email', 'Email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        className="bg-white/5 border-white/10 text-white rounded-xl p-4 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300"
                        placeholder={t('profile.fields.emailPlaceholder', 'seu@email.com')}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="language" className="text-white font-medium flex items-center gap-2">
                      <Globe className="w-5 h-5 text-emerald-400" />
                      {t('profile.preferredLanguage', 'Idioma Preferido')}
                    </Label>
                    <select
                      id="language"
                      value={profileData.preferred_language}
                      onChange={(e) => {
                        setProfileData({...profileData, preferred_language: e.target.value});
                        changeLanguage(e.target.value);
                      }}
                      className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-xl focus:outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 hover:border-emerald-400/30 transition-all duration-300"
                    >
                      <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                      <option value="en-US">🇺🇸 English (US)</option>
                      <option value="es-ES">🇪🇸 Español (España)</option>
                    </select>
                    <p className="text-sm text-gray-400">
                      {t('profile.languageDescription', 'Selecione o idioma da interface do sistema')}
                    </p>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {loading ? t('profile.actions.saveLoading', 'Salvando...') : t('profile.actions.save', 'Salvar Alterações')}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Security */}
          <TabsContent value="security" className="animate-fade-in">
            <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
              <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-400" />
                  {t('profile.security.title', 'Segurança da Conta')}
                </h2>
                <p className="text-gray-300 mt-2">
                  {t('profile.security.subtitle', 'Mantenha sua conta segura alterando sua senha regularmente')}
                </p>
              </div>
              <div className="p-8">
                <form onSubmit={handlePasswordChange} className="space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="current_password" className="text-white font-medium">{t('profile.security.currentPassword', 'Senha Atual')}</Label>
                      <div className="relative">
                        <Input
                          id="current_password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                          className="bg-white/5 border-white/10 text-white rounded-xl p-4 pr-12 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300"
                          placeholder={t('profile.security.currentPasswordPlaceholder', 'Digite sua senha atual')}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="new_password" className="text-white font-medium">{t('profile.security.newPassword', 'Nova Senha')}</Label>
                        <div className="relative">
                          <Input
                            id="new_password"
                            type={showNewPassword ? "text" : "password"}
                            value={passwordData.new_password}
                            onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                            className="bg-white/5 border-white/10 text-white rounded-xl p-4 pr-12 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300"
                            placeholder={t('profile.security.newPasswordPlaceholder', 'Digite a nova senha')}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-emerald-400 transition-colors"
                          >
                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="confirm_password" className="text-white font-medium">{t('profile.security.confirmPassword', 'Confirmar Nova Senha')}</Label>
                        <div className="relative">
                          <Input
                            id="confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={passwordData.confirm_password}
                            onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                            className="bg-white/5 border-white/10 text-white rounded-xl p-4 pr-12 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-300"
                            placeholder={t('profile.security.confirmPasswordPlaceholder', 'Confirme a nova senha')}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-emerald-400 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-300 font-medium mb-2">{t('profile.security.tipsTitle', 'Dicas para uma senha segura:')}</p>
                        <ul className="text-blue-200 space-y-1 text-sm">
                          <li>{t('profile.security.tip1', '• Use pelo menos 8 caracteres')}</li>
                          <li>{t('profile.security.tip2', '• Combine letras maiúsculas e minúsculas')}</li>
                          <li>{t('profile.security.tip3', '• Inclua números e símbolos especiais')}</li>
                          <li>{t('profile.security.tip4', '• Evite informações pessoais óbvias')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                  >
                    <Lock className="w-5 h-5 mr-2" />
                    {loading ? t('profile.security.actions.saveLoading', 'Alterando...') : t('profile.security.actions.save', 'Alterar Senha')}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Assinaturas */}
          <TabsContent value="subscription" className="animate-fade-in">
            <div className="space-y-8">
              {/* Status da Assinatura Atual */}
              <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
                <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-emerald-400" />
                    {t('profile.subscription.status.title', 'Status da Assinatura')}
                  </h2>
                  <p className="text-gray-300 mt-2">
                    {t('profile.subscription.status.subtitle', 'Informações sobre sua assinatura atual')}
                  </p>
                </div>
                <div className="p-8">
                  {subscriptionData ? (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-400/20 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
                              <CreditCard className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              {
                                /* Título: Assinatura ativa/cancelada ou Acesso vitalício */
                              }
                              <h3 className="text-xl font-bold text-white">
                                {subscriptionData.subscription_plan_id
                                  ? (subscriptionData.is_active
                                      ? t('profile.subscription.status.subscriptionActive', 'Assinatura Ativa')
                                      : t('profile.subscription.status.subscriptionCanceled', 'Assinatura cancelada ou expirada'))
                                  : (subscriptionData.has_full_access
                                      ? t('profile.subscription.status.lifetimeAccessActive', 'Acesso Vitalício Ativo')
                                      : t('profile.subscription.status.limitedAccess', 'Acesso Limitado'))}
                              </h3>
                              {subscriptionData.subscription_valid_until && (
                                <p className="text-emerald-300 text-sm">
                                  {subscriptionData.auto_renews
                                    ? `${t('profile.subscription.status.renewsAt', 'Renova em:')} ${new Date(subscriptionData.subscription_valid_until).toLocaleDateString('pt-BR')}`
                                    : `${t('profile.subscription.status.validUntil', 'Válida até:')} ${new Date(subscriptionData.subscription_valid_until).toLocaleDateString('pt-BR')}`}
                                </p>
                              )}
                              {planDisplayName && (
                                <p className="text-gray-300 text-sm">
                                  {t('profile.subscription.status.plan', 'Plano:')} {planDisplayName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={'px-4 py-2 rounded-full text-sm font-semibold ' + (
                            subscriptionData.subscription_plan_id
                              ? (subscriptionData.is_active
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/30')
                              : (subscriptionData.has_full_access
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30')
                          )}>
                            {subscriptionData.subscription_plan_id
                              ? (subscriptionData.is_active
                                  ? t('profile.subscription.status.activeBadge', 'Ativo')
                                  : t('profile.subscription.status.canceledBadge', 'Cancelado'))
                              : (subscriptionData.has_full_access
                                  ? t('profile.subscription.status.activeBadge', 'Ativo')
                                  : t('profile.subscription.status.limitedBadge', 'Limitado'))}
                          </div>
                        </div>
                      </div>
                      {/* Botão de reativação quando assinatura cancelada/expirada */}
                      {subscriptionData.subscription_plan_id && !subscriptionData.is_active && (
                        <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 flex items-center justify-between">
                          <p className="text-red-200 text-sm">
                            {t('profile.subscription.status.reactivateInfo', 'Sua assinatura está cancelada ou expirada. Reative para voltar a ter acesso.')}
                          </p>
                          <Button
                            onClick={() => navigate('/subscribe')}
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5"
                          >
                            {t('profile.subscription.status.reactivateCta', 'Reativar Assinatura')}
                          </Button>
                        </div>
                      )}
                      {subscriptionData.has_full_access && !subscriptionData.subscription_plan_id && (
                        <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4">
                          <p className="text-emerald-200">
                            {t('profile.subscription.status.lifetimeMessage', 'Parabéns! Você tem acesso vitalício à plataforma.')}
                          </p>
                        </div>
                      )}
                      {subscriptionData.auto_renews && (
                        <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4">
                          <p className="text-emerald-200">
                            {t('profile.subscription.status.autoRenewCongrats', 'Parabéns! Sua assinatura está ativa com renovação automática.')}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CreditCard className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-300 text-lg">{t('profile.subscription.status.loading', 'Carregando informações da assinatura...')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Planos Disponíveis */}
              {!(subscriptionData?.has_full_access) && !(subscriptionData?.is_active && subscriptionData?.auto_renews) && (
              <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
                <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Settings className="w-6 h-6 text-emerald-400" />
                    {t('profile.subscription.plans.title', 'Planos Disponíveis')}
                  </h2>
                  <p className="text-gray-300 mt-2">
                    {t('profile.subscription.plans.subtitle', 'Escolha o plano que melhor se adequa às suas necessidades')}
                  </p>
                </div>
                <div className="p-8">
                  {subscriptionPlans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subscriptionPlans.map((plan, index) => (
                        <div
                          key={plan.id}
                          className={`relative glass-panel rounded-2xl border p-6 transition-all duration-300 hover:border-emerald-400/50 hover:-translate-y-1 ${
                            index === 1 ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-white/10'
                          }`}
                        >
                          {index === 1 && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                                {t('profile.subscription.plans.recommended', 'RECOMENDADO')}
                              </span>
                            </div>
                          )}
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto">
                              <Settings className="w-8 h-8 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                              <p className="text-gray-300 text-sm">{plan.description}</p>
                            </div>
                            <div className="py-4">
                              <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                R$ {Number(plan.price_brl).toFixed(2)}
                              </span>
                              <p className="text-gray-300 text-sm mt-1">
                                {t('profile.subscription.plans.accessForDays', 'Acesso por {{days}} dias', { days: plan.duration_days })}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleSubscribe(plan.id)}
                              disabled={loadingSubscription}
                              className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                                index === 1
                                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white hover:shadow-emerald-500/25'
                                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                              }`}
                            >
                              {loadingSubscription ? t('profile.subscription.plans.subscribeLoading', 'Processando...') : t('profile.subscription.plans.subscribeCta', 'Assinar Agora')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Settings className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-300 text-lg">{t('profile.subscription.plans.noneAvailable', 'Nenhum plano disponível no momento')}</p>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Preferências */}
          <TabsContent value="preferences" className="animate-fade-in">
            <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
              <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Bell className="w-6 h-6 text-emerald-400" />
                  {t('profile.preferences.title', 'Notificações e Preferências')}
                </h2>
                <p className="text-gray-300 mt-2">
                  {t('profile.preferences.subtitle', 'Configure como e quando você deseja receber notificações')}
                </p>
              </div>
              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <div className="glass-panel rounded-xl border border-white/10 p-6 hover:border-emerald-400/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <Mail className="w-5 h-5 text-emerald-400" />
                          {t('profile.preferences.email.title', 'Notificações por Email')}
                        </h4>
                        <p className="text-gray-300 text-sm">{t('profile.preferences.email.description', 'Receba atualizações importantes por email')}</p>
                      </div>
                      <Switch
                        checked={preferences.email_notifications}
                        onCheckedChange={(checked) => setPreferences({...preferences, email_notifications: checked})}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl border border-white/10 p-6 hover:border-emerald-400/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <Bell className="w-5 h-5 text-emerald-400" />
                          {t('profile.preferences.course.title', 'Lembretes de Curso')}
                        </h4>
                        <p className="text-gray-300 text-sm">{t('profile.preferences.course.description', 'Receba lembretes sobre cursos em andamento')}</p>
                      </div>
                      <Switch
                        checked={preferences.course_reminders}
                        onCheckedChange={(checked) => setPreferences({...preferences, course_reminders: checked})}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl border border-white/10 p-6 hover:border-emerald-400/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <User className="w-5 h-5 text-emerald-400" />
                          {t('profile.notifications.social.title')}
                        </h4>
                        <p className="text-gray-300 text-sm">{t('profile.notifications.social.description')}</p>
                      </div>
                      <Switch
                        checked={preferences.social_notifications}
                        onCheckedChange={(checked) => setPreferences({...preferences, social_notifications: checked})}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl border border-white/10 p-6 hover:border-emerald-400/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <Settings className="w-5 h-5 text-emerald-400" />
                          {t('profile.preferences.marketing.title', 'Emails de Marketing')}
                        </h4>
                        <p className="text-gray-300 text-sm">{t('profile.preferences.marketing.description', 'Receba novidades e promoções especiais')}</p>
                      </div>
                      <Switch
                        checked={preferences.marketing_emails}
                        onCheckedChange={(checked) => setPreferences({...preferences, marketing_emails: checked})}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                <Button 
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {loading ? t('profile.preferences.actions.saveLoading', 'Salvando...') : t('profile.preferences.actions.save', 'Salvar Preferências')}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Conta */}
          <TabsContent value="account" className="animate-fade-in">
            <div className="glass-panel rounded-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
              <div className="bg-gradient-to-r from-white/5 to-white/10 p-6 border-b border-white/10 rounded-t-3xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-400" />
                  {t('profile.account.title', 'Configurações da Conta')}
                </h2>
                <p className="text-gray-300 mt-2">
                  {t('profile.account.subtitle', 'Gerencie configurações avançadas da sua conta')}
                </p>
              </div>
              <div className="p-8 space-y-8">
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/30 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-yellow-300 font-bold text-lg mb-2">{t('profile.account.dangerZone.title', 'Zona de Perigo')}</h4>
                      <p className="text-yellow-200 text-sm mb-6">
                        {t('profile.account.dangerZone.description', 'As ações abaixo são irreversíveis. Proceda com cuidado.')}
                      </p>
                      
                      <Button
                        onClick={handleDeleteAccount}
                        disabled={loading}
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5"
                      >
                        <Trash2 className="w-5 h-5 mr-2" />
                        {loading ? t('profile.account.dangerZone.deleteLoading', 'Excluindo...') : t('profile.account.dangerZone.deleteCta', 'Excluir Conta Permanentemente')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/30 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-blue-300 font-bold text-lg mb-4">{t('profile.account.info.title', 'Informações da Conta')}</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-gray-300 font-medium">{t('profile.account.info.memberSince', 'Membro desde:')}</span>
                          <span className="text-white font-semibold">
                            {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-gray-300 font-medium">{t('profile.account.info.lastLogin', 'Último login:')}</span>
                          <span className="text-white font-semibold">
                            {user?.last_login ? new Date(user.last_login).toLocaleDateString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-300 font-medium">{t('profile.account.info.accountId', 'ID da conta:')}</span>
                          <span className="text-white font-mono text-sm bg-white/10 px-3 py-1 rounded-lg">{user?.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
