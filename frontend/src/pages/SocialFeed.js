import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  MessageCircle, 
  Heart, 
  Share2, 
  BookOpen, 
  LogOut, 
  Search, 
  Filter, 
  TrendingUp, 
  Clock, 
  Users, 
  Plus,
  ChevronDown,
  Sparkles,
  Send,
  MoreHorizontal,
  ThumbsUp,
  Eye,
  Calendar,
  Tag,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Bookmark,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Reply
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import UnifiedHeader from '../components/UnifiedHeader';
import '../styles/social-animations.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SocialFeed({ user, onLogout }) {
  const { t } = useTranslation();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // recent, popular, oldest
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 5;
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [postReplies, setPostReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [showPostDetail, setShowPostDetail] = useState(false);
  const navigate = useNavigate();

  // Helper functions to extract lesson information from post content
  const extractLessonTitle = (content) => {
    const titleMatch = content.match(/\*\*(.*?)\*\*/);
    return titleMatch ? titleMatch[1] : t('social.lessonPost.defaultTitle');
  };

  const extractLessonDescription = (content) => {
    const lines = content.split('\n');
    const descriptionLines = [];
    let foundTitle = false;
    
    for (const line of lines) {
      if (line.includes('📚') || line.includes('Título:')) {
        foundTitle = true;
        continue;
      }
      if (foundTitle && !line.includes('🏷️') && !line.includes('📂') && line.trim()) {
        descriptionLines.push(line.trim());
      }
      if (line.includes('🏷️')) break;
    }
    
    return descriptionLines.join(' ') || t('social.lessonPost.defaultDescription');
  };

  // Helper function to get interaction type and styling
  const getInteractionType = (post) => {
    // Nova aula publicada (post automático do sistema - identifica pelo conteúdo)
    if (post.lesson_id && !post.parent_id && post.content && post.content.includes('🎓 Nova aula disponível!')) {
      return {
        type: 'new_lesson',
        label: t('social.interactionTypes.newLesson'),
        icon: BookOpen,
        bgColor: 'from-purple-500/20 to-blue-500/20',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-400',
        iconBg: 'from-purple-500 to-blue-500',
        hoverColor: 'hover:border-purple-500/50'
      };
    }
    // Comentário em aula específica (usuário comentando em uma aula)
    else if (post.lesson_id && !post.parent_id) {
      return {
        type: 'lesson_comment',
        label: t('social.interactionTypes.lessonComment'),
        icon: MessageSquare,
        bgColor: 'from-orange-500/20 to-yellow-500/20',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-400',
        iconBg: 'from-orange-500 to-yellow-500',
        hoverColor: 'hover:border-orange-500/50'
      };
    }
    // Discussão geral no feed social
    else if (!post.lesson_id && !post.parent_id) {
      return {
        type: 'discussion',
        label: t('social.interactionTypes.discussion'),
        icon: MessageCircle,
        bgColor: 'from-emerald-500/20 to-cyan-500/20',
        borderColor: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
        iconBg: 'from-emerald-500 to-cyan-500',
        hoverColor: 'hover:border-emerald-500/50'
      };
    } 
    // Resposta a uma discussão geral (não deveria aparecer no feed principal, mas caso apareça)
    else {
      return {
        type: 'reply',
        label: t('social.interactionTypes.reply'),
        icon: Reply,
        bgColor: 'from-cyan-500/20 to-teal-500/20',
        borderColor: 'border-cyan-500/30',
        textColor: 'text-cyan-400',
        iconBg: 'from-cyan-500 to-teal-500',
        hoverColor: 'hover:border-cyan-500/50'
      };
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [filter]);

  const fetchFeed = async () => {
    try {
      const token = localStorage.getItem('token');
      const filterParam = filter !== 'all' ? `?filter=${filter}` : '';
      const response = await axios.get(`${API}/social/feed${filterParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeed(response.data);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLesson = async (lessonId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.get(`${API}/student/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/lesson/${lessonId}`);
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Você precisa estar matriculado neste curso para acessar esta aula');
      } else if (error.response?.status === 404) {
        alert('Aula não encontrada');
      } else {
        console.error('Error accessing lesson:', error);
        alert('Erro ao acessar a aula. Tente novamente.');
      }
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/comments`,
        {
          content: newPostContent,
          lesson_id: null,
          parent_id: null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPostContent('');
      setShowCreatePost(false);
      fetchFeed();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/comments/${commentId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFeed();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const fetchPostDetail = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/social/post/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedPost(response.data.post);
      setPostReplies(response.data.replies);
      setShowPostDetail(true);
    } catch (error) {
      console.error('Error fetching post detail:', error);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedPost) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/comments`,
        {
          content: replyContent,
          lesson_id: selectedPost.lesson_id,
          parent_id: selectedPost.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyContent('');
      fetchPostDetail(selectedPost.id);
      fetchFeed();
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return t('social.timeAgo.now');
    if (diff < 3600) return t('social.timeAgo.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('social.timeAgo.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('social.timeAgo.daysAgo', { count: Math.floor(diff / 86400) });
  };

  // Filter and sort feed based on search, active filter, and sort option
  const allFilteredFeed = feed
    .filter(post => {
      const matchesSearch = post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           post.user_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === 'all') return matchesSearch;
      if (filter === 'discussions') return matchesSearch && !post.lesson_id;
      if (filter === 'lessons') return matchesSearch && post.lesson_id;
      
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.likes + b.replies_count) - (a.likes + a.replies_count);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'recent':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  // Pagination
  const totalPages = Math.ceil(allFilteredFeed.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const filteredFeed = allFilteredFeed.slice(startIndex, startIndex + postsPerPage);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-blue-500/15 blur-[130px] pointer-events-none" />

      <UnifiedHeader
        user={user}
        onLogout={onLogout}
      />

      {/* Main Content with Enhanced Layout */}
      <main 
        className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8"
        role="main"
        aria-label={t('social.aria.mainContent')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Enhanced Sidebar */}
          <aside 
            className="lg:col-span-1 space-y-6 animate-slide-in-left"
            role="complementary"
            aria-label={t('social.aria.sidebar')}
          >
            {/* Create Post Card */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 shadow-xl smooth-hover glow-on-hover">
              <CardContent className="p-6">
                <Button
                  onClick={() => setShowCreatePost(true)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 button-press ripple animate-pulse-hover"
                  aria-label={t('social.aria.createDiscussion')}
                >
                  <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
                  {t('social.newDiscussion')}
                </Button>
              </CardContent>
            </Card>

            {/* Enhanced Search Card */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 shadow-xl smooth-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-400 float-animation" aria-hidden="true" />
                  <h3 className="font-semibold text-white">{t('social.searchDiscussions')}</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={t('social.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-[#0f0f0f] border-[#252525] text-white placeholder-gray-500 rounded-xl transition-all duration-300 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 pr-10"
                    aria-label={t('social.aria.searchField')}
                    role="searchbox"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 h-auto"
                      aria-label={t('social.clearSearch')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {searchTerm && (
                    <div className="mt-3 text-sm text-gray-400">
                      {allFilteredFeed.length === 0 
                        ? t('social.noResults', { searchTerm })
                        : t('social.resultsFound', { count: allFilteredFeed.length })
                      }
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Enhanced Filters Card */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 shadow-xl smooth-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  <h3 className="font-semibold text-white">{t('social.filters')}</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <fieldset>
                  <legend className="sr-only">{t('social.aria.filterDiscussions')}</legend>
                  <div className="space-y-2">
                    {[
                      { key: 'all', label: t('social.filterAll'), icon: TrendingUp },
                      { key: 'discussions', label: t('social.filterDiscussions'), icon: MessageCircle },
                      { key: 'lessons', label: t('social.filterLessons'), icon: BookOpen }
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant={filter === key ? "default" : "ghost"}
                        onClick={() => setFilter(key)}
                        className={`w-full justify-start rounded-xl transition-all duration-300 button-press ripple ${
                          filter === key
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 glow-on-hover'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                        aria-pressed={filter === key}
                        aria-label={`Filtrar por ${label.toLowerCase()}`}
                      >
                        <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                
                {/* Sort Options */}
                <div className="border-t border-[#252525]/50 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                    <h4 className="font-medium text-white text-sm">{t('social.sortBy')}</h4>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: 'recent', label: t('social.sortRecent'), icon: Clock },
                      { key: 'popular', label: t('social.sortPopular'), icon: Heart },
                      { key: 'oldest', label: t('social.sortOldest'), icon: Clock }
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant={sortBy === key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSortBy(key)}
                        className={`w-full justify-start rounded-lg transition-all duration-300 button-press ${
                          sortBy === key 
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                            : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10'
                        }`}
                        aria-pressed={sortBy === key}
                        aria-label={t('social.aria.sortBy', { type: label.toLowerCase() })}
                      >
                        <Icon className="w-3 h-3 mr-2" aria-hidden="true" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/30 shadow-xl smooth-hover animated-gradient">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center animate-pulse-hover"
                    aria-hidden="true"
                  >
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{t('social.activeCommunity')}</h3>
                    <p className="text-xs text-gray-400">{t('social.ongoingDiscussions')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <p 
                      className="text-3xl font-bold text-emerald-400 count-up"
                      aria-label={t('social.aria.postsCount', { count: filteredFeed.length })}
                    >
                      {filteredFeed.length}
                    </p>
                    <p className="text-sm text-gray-400">{t('social.posts')}</p>
                  </div>
                  {allFilteredFeed.length !== feed.length && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{t('social.totalFiltered')}</span>
                      <span className="font-bold text-yellow-400 count-up">
                        {allFilteredFeed.length}
                      </span>
                    </div>
                  )}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{t('social.page')}</span>
                      <span className="font-bold text-blue-400">
                        {t('social.pageOf', { current: currentPage, total: totalPages })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Enhanced Feed */}
          <section 
            className="lg:col-span-3 space-y-6"
            aria-label={t('social.aria.communityFeed')}
          >


            {/* Feed Header */}
            <header className="text-center lg:text-left">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                {t('social.communityFeed')}
              </h2>
              <p className="text-gray-400 text-lg">
                {t('social.communityDescription')}
              </p>
            </header>

            {loading ? (
                <div className="space-y-6" aria-live="polite" aria-label={t('social.aria.loadingDiscussions')}>
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 shadow-xl shimmer-loading">
                      <CardContent className="p-6">
                        <div className="animate-pulse">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-700 rounded-full" aria-hidden="true"></div>
                            <div className="space-y-2">
                              <div className="h-4 bg-gray-700 rounded w-24" aria-hidden="true"></div>
                              <div className="h-3 bg-gray-700 rounded w-16" aria-hidden="true"></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-700 rounded" aria-hidden="true"></div>
                            <div className="h-4 bg-gray-700 rounded w-3/4" aria-hidden="true"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredFeed.length === 0 ? (
                <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 shadow-xl animate-fade-in-up">
                  <CardContent className="text-center py-20">
                    <div 
                      className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
                      aria-hidden="true"
                    >
                      <MessageCircle className="w-8 h-8 text-emerald-400 float-animation" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {t('social.noDiscussionsFound')}
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                      {searchTerm 
                        ? t('social.noSearchResults', { searchTerm })
                        : t('social.beFirstToStart')
                      }
                    </p>
                    <Button
                      onClick={() => setShowCreatePost(true)}
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 rounded-xl button-press ripple glow-on-hover"
                      aria-label={t('social.aria.createFirstDiscussion')}
                    >
                      <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                      {t('social.createFirstDiscussion')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-6">
                    {filteredFeed.map((post, index) => {
                      const interactionType = getInteractionType(post);
                      const IconComponent = interactionType.icon;
                      
                      return (
                        <Card
                        key={post.id}
                        data-testid={`feed-item-${post.id}`}
                        className={`bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 ${interactionType.hoverColor} transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl group smooth-hover animate-fade-in-up`}
                        style={{ animationDelay: `${index * 100}ms` }}
                        onClick={() => fetchPostDetail(post.id)}
                        role="article"
                        aria-labelledby={`post-title-${post.id}`}
                        tabIndex="0"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {/* Enhanced Avatar with interaction type indicator */}
                            <div className="relative">
                              <div 
                                className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ring-2 ring-emerald-500/20 flex-shrink-0 animate-pulse-hover"
                                role="img"
                                aria-label={`Avatar do usuário ${post.user_name}`}
                              >
                                {post.user_name[0].toUpperCase()}
                              </div>
                              {/* Interaction type indicator */}
                              <div className={`absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br ${interactionType.iconBg} rounded-full flex items-center justify-center border-2 border-[#1a1a1a]`}>
                                <IconComponent className="w-3 h-3 text-white" />
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="font-bold text-white text-lg">{post.user_name}</span>
                                  <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Clock className="w-4 h-4" aria-hidden="true" />
                                    <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                                  </div>
                                  {/* Enhanced Badge with specific styling */}
                                  <Badge 
                                    className={`bg-gradient-to-r ${interactionType.bgColor} ${interactionType.textColor} ${interactionType.borderColor} animate-scale-in font-medium`}
                                    aria-label={`Tipo de interação: ${interactionType.label}`}
                                  >
                                    <IconComponent className="w-3 h-3 mr-1" aria-hidden="true" />
                                    {interactionType.label}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full button-press"
                                  aria-label={t('social.aria.moreOptions')}
                                >
                                  <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                                </Button>
                              </div>

                          {/* Post Content - Enhanced for New Lesson Posts Only */}
                          {post.lesson_id && post.content.includes('🎓 Nova aula disponível!') ? (
                            <div className="mb-4">
                              {/* New Lesson Post Special Layout */}
                              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4 mb-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-white text-lg mb-2">
                                      {extractLessonTitle(post.content)}
                                    </h3>
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                      {extractLessonDescription(post.content)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-purple-500/20">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewLesson(post.lesson_id);
                                    }}
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-300 button-press ripple glow-on-hover"
                                    aria-label={t('social.aria.accessLesson')}
                                  >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    {t('social.accessLesson')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p 
                              id={`post-title-${post.id}`}
                              className="text-gray-200 mb-4 leading-relaxed text-base"
                            >
                              {post.content}
                            </p>
                          )}

                          <Separator className="my-4 bg-[#252525]" />

                          {/* Enhanced Actions */}
                          <div className="flex items-center justify-between" role="toolbar" aria-label={t('social.aria.discussionActions')}>
                            <div className="flex items-center gap-6">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLike(post.id);
                                }}
                                className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 rounded-xl group/like button-press ripple"
                                aria-label={t('social.aria.likePost', { count: post.likes })}
                              >
                                <Heart className="w-4 h-4 mr-2 group-hover/like:fill-current" aria-hidden="true" />
                                <span className="font-medium count-up">{post.likes}</span>
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-300 rounded-xl button-press ripple"
                                aria-label={t('social.aria.replyPost', { count: post.replies_count || 0 })}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                                <span className="font-medium count-up">{post.replies_count || 0}</span>
                              </Button>

                              {post.lesson_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewLesson(post.lesson_id);
                                  }}
                                  className="text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all duration-300 rounded-xl button-press ripple"
                                  aria-label={t('social.aria.viewRelatedLesson')}
                                >
                                  <BookOpen className="w-4 h-4 mr-2" aria-hidden="true" />
                                  {t('social.viewLesson')}
                                </Button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-300 rounded-full button-press"
                                aria-label={t('social.aria.shareDiscussion')}
                              >
                                <Share2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all duration-300 rounded-full button-press"
                                aria-label={t('social.aria.saveDiscussion')}
                              >
                                <Bookmark className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                      );
                    })}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="bg-[#1a1a1a] border-[#252525] text-white hover:bg-[#252525] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('social.aria.previousPage')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 p-0 ${
                            currentPage === pageNum
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-0"
                              : "bg-[#1a1a1a] border-[#252525] text-white hover:bg-[#252525]"
                          }`}
                          aria-label={t('social.aria.goToPage', { page: pageNum })}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="bg-[#1a1a1a] border-[#252525] text-white hover:bg-[#252525] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('social.aria.nextPage')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
                </>
              )}
          </section>
        </div>
      </main>

      {/* Enhanced Create Post Dialog */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent 
          className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 text-white max-w-2xl mx-4 sm:mx-auto shadow-2xl"
          role="dialog"
          aria-labelledby="create-post-title"
          aria-describedby="create-post-description"
        >
          <DialogHeader>
            <DialogTitle 
              id="create-post-title"
              className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
            >
              {t('social.newDiscussion')}
            </DialogTitle>
            <p id="create-post-description" className="sr-only">
              {t('social.createPostFormDescription')}
            </p>
          </DialogHeader>
          <form onSubmit={handleCreatePost} className="space-y-6">
            <div className="flex items-start gap-4">
              <div 
                className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0"
                role="img"
                aria-label={t('social.aria.userAvatar', { name: user.name })}
              >
                {user.name[0].toUpperCase()}
              </div>
              <Textarea
                id="post-content"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={t('social.shareIdeasPlaceholder')}
                rows={4}
                className="bg-[#111111] border-[#2a2a2a] text-white flex-1 min-h-[120px] rounded-xl resize-none focus:ring-2 focus:ring-emerald-500/50"
                required
                aria-label={t('social.aria.discussionContent')}
                aria-describedby="content-help"
              />
              <p id="content-help" className="sr-only">
                {t('social.writeContentHelp')}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePost(false)}
                className="border-[#2a2a2a] hover:bg-[#252525] rounded-xl"
                aria-label={t('social.aria.cancelCreation')}
              >
                {t('social.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 rounded-xl shadow-lg"
                disabled={!newPostContent.trim()}
                aria-label={t('social.aria.publishDiscussion')}
              >
                <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('social.publish')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enhanced Post Detail Dialog */}
      <Dialog open={showPostDetail} onOpenChange={setShowPostDetail}>
        <DialogContent className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#252525]/50 text-white max-w-4xl mx-4 sm:mx-auto max-h-[85vh] overflow-y-auto shadow-2xl">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {t('social.detailedDiscussion')}
                </DialogTitle>
              </DialogHeader>

              {/* Original Post */}
              <Card className="bg-[#111111] border-[#252525] shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                      {selectedPost.user_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-white text-lg">{selectedPost.user_name}</span>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(selectedPost.created_at)}</span>
                        </div>
                      </div>
                      <p className="text-gray-200 leading-relaxed">{selectedPost.content}</p>
                    </div>
                  </div>

                  <Separator className="my-4 bg-[#252525]" />

                  <div className="flex items-center gap-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(selectedPost.id)}
                      className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 rounded-xl"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      {selectedPost.likes}
                    </Button>
                    <div className="flex items-center gap-2 text-gray-400">
                      <MessageCircle className="w-4 h-4" />
                      <span>{t('social.repliesCount', { count: postReplies.length })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reply Form */}
              <Card className="bg-[#111111] border-[#252525]">
                <CardContent className="p-6">
                  <form onSubmit={handleReply} className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user.name[0].toUpperCase()}
                      </div>
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder={t('social.writeReplyPlaceholder')}
                        rows={3}
                        className="bg-[#0a0a0a] border-[#2a2a2a] text-white flex-1 rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 rounded-xl"
                        disabled={!replyContent.trim()}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {t('social.reply')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Replies */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  {t('social.replies')} ({postReplies.length})
                </h3>
                {postReplies.length === 0 ? (
                  <Card className="bg-[#111111] border-[#252525]">
                    <CardContent className="text-center py-12">
                      <MessageCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                      <p className="text-gray-400">{t('social.noRepliesYet')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  postReplies.map((reply) => (
                    <Card key={reply.id} className="bg-[#111111] border-[#252525]">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {reply.user_name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-white">{reply.user_name}</span>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(reply.created_at)}</span>
                              </div>
                            </div>
                            <p className="text-gray-300 text-sm mb-3">{reply.content}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLike(reply.id)}
                              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 rounded-lg"
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              {reply.likes}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}