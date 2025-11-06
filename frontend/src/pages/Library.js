import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  BadgeCheck,
  Bookmark,
  ChevronRight,
  CloudDownload,
  FileText,
  FolderTree,
  Image,
  Layers,
  Link as LinkIcon,
  Loader,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  Star,
  RefreshCw,
  UploadCloud,
  Video,
  XCircle,
} from 'lucide-react';
import UnifiedHeader from '../components/UnifiedHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { cn } from '../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEFAULT_UPLOAD_FORM = {
  title: '',
  description: '',
  category: '',
  type: 'project',
  tags: '',
  demoUrl: '',
  allowCommunityDownload: true,
};

const resourceTypes = ['project', 'template', 'snippet', 'documentation', 'other'];

const markdownToHtml = (text) => {
  if (!text) return '';

  return text
    .replace(/```([^`]+)```/g, '<pre class="rounded-xl bg-black/60 border border-white/10 p-4 text-sm overflow-auto">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-emerald-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl border border-white/10 w-full my-4" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-300 hover:text-emerald-200 underline">$1</a>')
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/g, '<ul class="list-disc list-inside space-y-1">$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />')
    .replace(/^(.+)$/m, '<p>$1</p>');
};

const formatResourceType = (type, t) => {
  const map = {
    project: t('library.types.project'),
    template: t('library.types.template'),
    snippet: t('library.types.snippet'),
    documentation: t('library.types.documentation'),
    other: t('library.types.other'),
  };
  return map[type] || type;
};

export default function Library({ user, onLogout }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [selectedResource, setSelectedResource] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    type: 'all',
    sort: 'recent',
    rating: 'all',
  });
  const [categories, setCategories] = useState([]);
  const [uploadForm, setUploadForm] = useState(DEFAULT_UPLOAD_FORM);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [communityComments, setCommunityComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [activeRating, setActiveRating] = useState({});
  const [highlightFeatured, setHighlightFeatured] = useState(true);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [pendingResourceId, setPendingResourceId] = useState(null);

  const getAvatarDetails = useCallback(
    (name, ...sources) => {
      const fallbackName = (typeof name === 'string' && name.trim()) || t('library.anonymousUser', 'Criador anônimo');
      const rawSource = sources.find(
        (src) => typeof src === 'string' && src && src.trim && src.trim().length > 0
      );
      const imageSource = typeof rawSource === 'string' ? rawSource.trim() : '';
      const initials =
        fallbackName
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase())
          .filter(Boolean)
          .slice(0, 2)
          .join('') || fallbackName[0]?.toUpperCase() || 'U';

      return { name: fallbackName, image: imageSource, initials };
    },
    [t]
  );

  const normalizeResources = useCallback((items) => {
    return (items || [])
      .filter((item) => {
        if (!item) return false;
        if (!item.status) return true;
        return ['approved', 'published'].includes(String(item.status).toLowerCase());
      })
      .map((item) => ({
        ...item,
        average_rating: Number(item.average_rating ?? 0),
        downloads: Number(item.downloads ?? 0),
        tags: Array.isArray(item.tags)
          ? item.tags
          : typeof item.tags === 'string'
            ? item.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
        contributor: item.contributor
          ? {
              ...item.contributor,
              avatar: item.contributor.avatar || item.contributor.avatar_url || '',
              avatar_url: item.contributor.avatar_url || item.contributor.avatar || '',
              name: item.contributor.name || t('library.anonymousUser'),
            }
          : null,
      }));
  }, [t]);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    setFetchError(false);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [resourcesResponse, categoriesResponse] = await Promise.all([
        axios.get(`${API}/library/resources`, { headers }),
        axios.get(`${API}/library/categories`, { headers }),
      ]);

      const payload = Array.isArray(resourcesResponse.data) ? resourcesResponse.data : [];
      const normalized = normalizeResources(payload);
      setResources(normalized);
      setSelectedResource((prev) => {
        if (!prev) return prev;
        const updated = normalized.find((item) => item.id === prev.id);
        return updated || prev;
      });

      const loadedCategories = Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [];
      if (loadedCategories.length) {
        setCategories(
          loadedCategories.map((category) =>
            typeof category === 'string'
              ? { id: category, name: category }
              : category
          )
        );
      } else {
        const derived = new Map();
        normalized.forEach((resource) => {
          if (resource.category && !derived.has(resource.category)) {
            derived.set(resource.category, { id: resource.category, name: resource.category });
          }
        });
        setCategories(Array.from(derived.values()));
      }
    } catch (error) {
      console.error('Error fetching library data:', error);
      setResources([]);
      setCategories([]);
      setFetchError(true);
    } finally {
      setLoadingResources(false);
    }
  }, [normalizeResources]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const selectedContributor = useMemo(() => {
    if (!selectedResource) return null;
    const contributor = selectedResource.contributor || {};
    return getAvatarDetails(
      contributor.name,
      contributor.avatar,
      contributor.avatar_url,
      selectedResource.author_avatar,
      selectedResource.author_avatar_url
    );
  }, [selectedResource, getAvatarDetails]);
  const selectedPublishedAt = useMemo(() => {
    if (!selectedResource?.submitted_at) return null;
    const parsed = new Date(selectedResource.submitted_at);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString();
  }, [selectedResource]);

  useEffect(() => {
    return () => {
      if (uploadPreview?.previewUrl) {
        URL.revokeObjectURL(uploadPreview.previewUrl);
      }
    };
  }, [uploadPreview]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('resourceId');
    setPendingResourceId(targetId);
  }, [location.search]);

  useEffect(() => {
    if (!pendingResourceId) return;
    if (!resources.length) return;
    const match = resources.find((item) => item.id === pendingResourceId);
    if (!match) return;
    setSelectedResource((prev) => (prev && prev.id === match.id ? prev : match));
    setShowDetailDialog(true);
  }, [pendingResourceId, resources]);

  const canInteract = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.has_full_access) return true;
    const status =
      user.subscription_status ||
      user.subscriptionStatus ||
      (user.subscription && user.subscription.status);
    const activeStatuses = [
      'ativa',
      'ativa_ate_final_do_periodo',
      'ativa_com_renovacao_automatica',
      'active',
      'active_until_period_end',
      'active_with_auto_renew'
    ];
    return status ? activeStatuses.includes(status) : false;
  }, [user]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const availableCategories = useMemo(() => {
    if (categories.length) return categories;
    const unique = new Map();
    resources.forEach((resource) => {
      if (resource.category && !unique.has(resource.category)) {
        unique.set(resource.category, { id: resource.category, name: resource.category });
      }
    });
    return Array.from(unique.values());
  }, [categories, resources]);

  const filteredResources = useMemo(() => {
    let list = [...resources];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          (item.tags || []).some((tag) => tag.toLowerCase().includes(term))
      );
    }

    if (filters.category !== 'all') {
      list = list.filter((item) => item.category === filters.category);
    }

    if (filters.type !== 'all') {
      list = list.filter((item) => item.type === filters.type);
    }

    if (filters.rating !== 'all') {
      list = list.filter((item) => Math.round(item.average_rating || 0) >= Number(filters.rating));
    }

    switch (filters.sort) {
      case 'popular':
        list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'recent':
      default:
        list.sort(
          (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
        );
        break;
    }

    if (highlightFeatured) {
      list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    }

    return list;
  }, [filters, resources, highlightFeatured]);

  const libraryStats = useMemo(() => {
    const totalDownloads = resources.reduce((sum, item) => sum + (item.downloads || 0), 0);
    const totalContributors = new Set(
      resources.map((item) => item.contributor?.name).filter(Boolean)
    ).size;
    const totalCommunityItems = resources.filter((item) => item.is_community || item.contributor)
      .length;
    return {
      totalDownloads,
      totalContributors,
      totalCommunityItems,
    };
  }, [resources]);

  const handleSelectResource = (resource) => {
    setSelectedResource(resource);
    if (resource?.comments?.length) {
      setCommunityComments((prev) => ({
        ...prev,
        [resource.id]: resource.comments,
      }));
    }
    setShowDetailDialog(true);
  };

  const handleDownloadFile = async (resourceId, file) => {
    if (!canInteract) {
      alert(t('library.restricted.onlySubscribers'));
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/library/resources/${resourceId}/files/${file.id}/download`,
        {},
        { headers }
      );
      const payload = response.data || {};
      const targetUrl = payload.url || file.url;

      setResources((prev) =>
        prev.map((item) => {
          if (item.id !== resourceId) return item;
          const nextDownloads =
            typeof payload.downloads === 'number'
              ? payload.downloads
              : (item.downloads || 0) + 1;
          const nextFiles = (item.files || []).map((f) => {
            if (f.id !== file.id) return f;
            const fileDownloads =
              typeof payload.fileDownloads === 'number'
                ? payload.fileDownloads
                : (f.downloads || 0) + 1;
            return { ...f, downloads: fileDownloads };
          });
          return { ...item, downloads: nextDownloads, files: nextFiles };
        })
      );

      setSelectedResource((prev) => {
        if (!prev || prev.id !== resourceId) return prev;
        const nextDownloads =
          typeof payload.downloads === 'number'
            ? payload.downloads
            : (prev.downloads || 0) + 1;
        const nextFiles = (prev.files || []).map((f) => {
          if (f.id !== file.id) return f;
          const fileDownloads =
            typeof payload.fileDownloads === 'number'
              ? payload.fileDownloads
              : (f.downloads || 0) + 1;
          return { ...f, downloads: fileDownloads };
        });
        return { ...prev, downloads: nextDownloads, files: nextFiles };
      });

      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener');
      }
    } catch (error) {
      console.error('Error tracking download:', error);
      if (canInteract) {
        window.open(file.url, '_blank', 'noopener');
      }
    }
  };

  const handleRating = async (resource, ratingValue) => {
    if (!canInteract) {
      alert(t('library.restricted.onlySubscribers'));
      return;
    }
    try {
      setActiveRating((prev) => ({ ...prev, [resource.id]: ratingValue }));
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/library/resources/${resource.id}/ratings`,
        { rating: ratingValue },
        { headers }
      );
      setResources((prev) =>
        prev.map((item) =>
          item.id === resource.id
            ? {
                ...item,
                average_rating:
                  (item.average_rating || 0) * 0.8 + ratingValue * 0.2,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  const handleCommentSubmit = async (resourceId) => {
    if (!canInteract) {
      alert(t('library.restricted.onlySubscribers'));
      return;
    }
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/library/resources/${resourceId}/comments`,
        { message: newComment },
        { headers }
      );
      const comment = {
        id: `local-${Date.now()}`,
        author: user?.name || t('library.anonymousUser'),
        message: newComment,
        rating: activeRating[resourceId] || null,
        created_at: new Date().toISOString(),
      };

      setCommunityComments((prev) => ({
        ...prev,
        [resourceId]: [comment, ...(prev[resourceId] || [])],
      }));
      setNewComment('');
      setResources((prev) =>
        prev.map((item) =>
          item.id === resourceId
            ? { ...item, comment_count: (item.comment_count || 0) + 1 }
            : item
        )
      );
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleUploadFile = (event) => {
    const [file] = event.target.files;
    if (!file) return;

    setUploadFile(file);
  };

  const handlePreviewAsset = (event) => {
    const [file] = event.target.files;
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setUploadPreview({ file, previewUrl });
  };

  const resetUploadFormState = useCallback(() => {
    setUploadForm(DEFAULT_UPLOAD_FORM);
    setUploadFile(null);
    if (uploadPreview?.previewUrl) {
      URL.revokeObjectURL(uploadPreview.previewUrl);
    }
    setUploadPreview(null);
  }, [uploadPreview]);

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadPreview?.file) {
      formData.append('cover', uploadPreview.file);
    }
    Object.entries(uploadForm).forEach(([key, value]) => {
      formData.append(key, value);
    });

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'multipart/form-data',
      };

      await axios.post(`${API}/library/resources`, formData, { headers });
      await fetchResources();
      resetUploadFormState();
      setShowUploadSection(false);
      alert(t('library.upload.successPending'));
    } catch (error) {
      console.error('Error uploading resource:', error);
      alert(t('library.upload.actions.errorMessage'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <UnifiedHeader user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-12">
        <section className="grid gap-8 lg:grid-cols-[3fr,2fr] items-start">
          <div className="space-y-6">
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200 uppercase tracking-[0.35em] text-[11px] px-3 py-1">
              {t('library.hero.badge')}
            </Badge>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight bg-gradient-to-br from-emerald-200 via-cyan-200 to-purple-200 text-transparent bg-clip-text">
              {t('library.hero.title')}
            </h2>
            <p className="text-base sm:text-lg text-gray-300 max-w-2xl">
              {t('library.hero.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-2xl bg-emerald-500/90 hover:bg-emerald-400 text-black font-semibold"
                onClick={() => {
                  setShowUploadSection(true);
                  requestAnimationFrame(() => {
                    const uploadSection = document.getElementById('library-upload');
                    if (uploadSection) {
                      uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  });
                }}
              >
                <UploadCloud className="mr-2 h-5 w-5" />
                {t('library.hero.uploadCta')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-2xl border-white/20 hover:border-emerald-500/40 hover:text-emerald-200"
                onClick={() => updateFilter('sort', 'popular')}
              >
                <Star className="mr-2 h-5 w-5 text-amber-300" />
                {t('library.hero.exploreCta')}
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Archive className="w-6 h-6 text-black" />
              </div>
              <div>
                <p className="text-sm text-emerald-200 uppercase tracking-[0.35em]">
                  {t('library.hero.storage')}
                </p>
                <p className="text-lg text-gray-300">
                  {t('library.hero.storageHint')}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {t('library.hero.bunnyDescription')}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                  {t('library.stats.totalDownloads')}
                </p>
                <p className="text-2xl font-semibold text-emerald-200">
                  {libraryStats.totalDownloads.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                  {t('library.stats.contributors')}
                </p>
                <p className="text-2xl font-semibold text-emerald-200">
                  {libraryStats.totalContributors}
                </p>
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                  {t('library.stats.communityItems')}
                </p>
                <p className="text-2xl font-semibold text-emerald-200">
                  {libraryStats.totalCommunityItems}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full border border-white/10 bg-black/40 rounded-2xl hover:border-emerald-400/40 text-gray-300 hover:text-emerald-200"
              onClick={() => navigate('/social')}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              {t('library.hero.communityCta')}
              <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
                {t('library.filters.title')}
              </p>
              <h3 className="text-2xl font-semibold text-white">{t('library.filters.subtitle')}</h3>
            </div>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={highlightFeatured}
                  onChange={(event) => setHighlightFeatured(event.target.checked)}
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
                {t('library.filters.highlightFeatured')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl border border-white/10 text-xs uppercase tracking-[0.35em] text-gray-400 hover:text-emerald-200"
                onClick={() =>
                  setFilters({
                    search: '',
                    category: 'all',
                    type: 'all',
                    sort: 'recent',
                    rating: 'all',
                  })
                }
              >
                {t('library.filters.clear')}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[2fr,1fr,1fr,1fr]">
            <div className="flex items-center rounded-2xl border border-white/10 bg-black/40 px-4">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder={t('library.filters.searchPlaceholder')}
                className="border-none bg-transparent focus-visible:ring-0 text-sm text-gray-200 placeholder:text-gray-500"
              />
            </div>
            <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
              <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm">
                <SelectValue placeholder={t('library.filters.category')} />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border border-white/10 text-sm">
                <SelectItem value="all">{t('library.filters.categoryAll')}</SelectItem>
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(value) => updateFilter('type', value)}>
              <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm">
                <SelectValue placeholder={t('library.filters.type')} />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border border-white/10 text-sm">
                <SelectItem value="all">{t('library.filters.typeAll')}</SelectItem>
                {resourceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatResourceType(type, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.sort} onValueChange={(value) => updateFilter('sort', value)}>
              <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm">
                <SelectValue placeholder={t('library.filters.sort')} />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border border-white/10 text-sm">
                <SelectItem value="recent">{t('library.filters.sortRecent')}</SelectItem>
                <SelectItem value="popular">{t('library.filters.sortPopular')}</SelectItem>
                <SelectItem value="rating">{t('library.filters.sortRating')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold text-white">
              {t('library.featured.title')}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Layers className="w-4 h-4" />
              {filteredResources.length} {t('library.featured.results')}
            </div>
          </div>

          {loadingResources ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm text-gray-400">{t('library.loading')}</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-10 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 mx-auto text-red-300" />
              <h4 className="text-xl font-semibold text-white">
                {t('library.error.loadFailed')}
              </h4>
              <p className="text-sm text-red-200/80 max-w-xl mx-auto">
                {t('library.error.loadFailedHint')}
              </p>
              <Button
                onClick={fetchResources}
                className="rounded-xl bg-red-500/80 text-black hover:bg-red-400 inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('library.error.retry')}
              </Button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center space-y-4">
              <BadgeCheck className="w-10 h-10 mx-auto text-emerald-300" />
              <h4 className="text-xl font-semibold text-white">
                {t('library.empty.title')}
              </h4>
              <p className="text-sm text-gray-400 max-w-xl mx-auto">
                {t('library.empty.description')}
              </p>
              <Button
                onClick={() => updateFilter('sort', 'recent')}
                className="rounded-2xl bg-emerald-500/90 text-black hover:bg-emerald-400"
              >
                {t('library.empty.reset')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => {
                const contributorDetails = getAvatarDetails(
                  resource.contributor?.name,
                  resource.contributor?.avatar,
                  resource.contributor?.avatar_url,
                  resource.author_avatar,
                  resource.author_avatar_url
                );
                const submittedAtDate = resource.submitted_at ? new Date(resource.submitted_at) : null;
                const submittedAtLabel =
                  submittedAtDate && !Number.isNaN(submittedAtDate.getTime())
                    ? submittedAtDate.toLocaleDateString()
                    : null;
                return (
                  <article
                  key={resource.id}
                  className={cn(
                    'rounded-3xl border border-white/10 bg-white/5 overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40',
                    resource.featured && 'ring-1 ring-emerald-500/40'
                  )}
                >
                  <div className="relative">
                    {resource.cover_url ? (
                      <img
                        src={resource.cover_url}
                        alt={resource.title}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="h-48 w-full bg-gradient-to-br from-emerald-600/40 to-cyan-600/40 flex items-center justify-center">
                        <Archive className="w-12 h-12 text-emerald-200/80" />
                      </div>
                    )}
                    {resource.featured && (
                      <Badge className="absolute top-4 left-4 bg-black/80 border border-emerald-400/50 text-emerald-200 uppercase tracking-[0.3em]">
                        {t('library.featured.badge')}
                      </Badge>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-emerald-200 uppercase tracking-[0.3em]">
                        <FolderTree className="w-4 h-4" />
                        {resource.category || t('library.fallbackCategory')}
                      </div>
                      <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">
                        {formatResourceType(resource.type, t)}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xl font-semibold text-white line-clamp-2">
                        {resource.title}
                      </h4>
                      <p className="text-sm text-gray-400 line-clamp-3">
                        {resource.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-300" />
                        {(resource.average_rating || 0).toFixed(1)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CloudDownload className="w-4 h-4 text-emerald-300" />
                        {resource.downloads?.toLocaleString() || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4 text-cyan-300" />
                        {resource.comment_count || 0}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(resource.tags || []).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="border-white/10 text-gray-300">
                          #{tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <Avatar className="h-9 w-9 ring-2 ring-emerald-500/20 shadow-md bg-gradient-to-br from-emerald-500 to-cyan-500">
                          <AvatarImage
                            src={contributorDetails.image}
                            alt={contributorDetails.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-semibold">
                            {contributorDetails.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-gray-200 font-medium leading-tight">{contributorDetails.name}</p>
                          {submittedAtLabel && (
                            <p className="text-xs text-gray-500">
                              {submittedAtLabel}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:border-emerald-400/40"
                        onClick={() => handleSelectResource(resource)}
                      >
                        {t('library.featured.viewDetails')}
                      </Button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        {showUploadSection && (
        <section
          id="library-upload"
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/70 via-emerald-950/40 to-black/80 p-8 space-y-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
                {t('library.upload.title')}
              </p>
              <h3 className="text-3xl font-semibold">{t('library.upload.subtitle')}</h3>
              <p className="text-sm text-gray-400 max-w-xl">
                {t('library.upload.description')}
              </p>
            </div>
            <Badge className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-2xl px-4 py-2">
              <Plus className="w-4 h-4 mr-1" />
              {t('library.upload.fastTrack')}
            </Badge>
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white"
              onClick={() => {
                resetUploadFormState();
                setShowUploadSection(false);
              }}
            >
              {t('library.upload.actions.close') || 'Cancelar envio'}
            </Button>
          </div>

          <form onSubmit={handleUploadSubmit} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  {t('library.upload.fields.title')}
                </label>
                <Input
                  required
                  value={uploadForm.title}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder={t('library.upload.placeholders.title')}
                  className="rounded-2xl border-white/10 bg-black/40 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  {t('library.upload.fields.description')}
                </label>
                <Textarea
                  required
                  value={uploadForm.description}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={6}
                  placeholder={t('library.upload.placeholders.description')}
                  className="rounded-2xl border-white/10 bg-black/40 text-sm resize-none"
                />
                <p className="text-xs text-gray-500">
                  {t('library.upload.descriptionHint')}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    {t('library.upload.fields.category')}
                  </label>
                  <Input
                    value={uploadForm.category}
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, category: event.target.value }))
                    }
                    placeholder={t('library.upload.placeholders.category')}
                    className="rounded-2xl border-white/10 bg-black/40 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    {t('library.upload.fields.type')}
                  </label>
                  <Select
                    value={uploadForm.type}
                    onValueChange={(value) => setUploadForm((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm">
                      <SelectValue placeholder={t('library.upload.placeholders.type')} />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border border-white/10 text-sm">
                      {resourceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatResourceType(type, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    {t('library.upload.fields.tags')}
                  </label>
                  <Input
                    value={uploadForm.tags}
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, tags: event.target.value }))
                    }
                    placeholder={t('library.upload.placeholders.tags')}
                    className="rounded-2xl border-white/10 bg-black/40 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-200">
                    {t('library.upload.fields.demoUrl')}
                  </label>
                  <Input
                    value={uploadForm.demoUrl}
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, demoUrl: event.target.value }))
                    }
                    placeholder="https://"
                    className="rounded-2xl border-white/10 bg-black/40 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={uploadForm.allowCommunityDownload}
                  onChange={(event) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      allowCommunityDownload: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
                {t('library.upload.fields.allowDownload')}
              </label>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  {t('library.upload.fields.projectFile')}
                </label>
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-emerald-500/40 bg-black/40 px-4 py-6">
                  <UploadCloud className="w-8 h-8 text-emerald-300" />
                  <div>
                    <p className="text-sm text-gray-300">
                      {uploadFile ? uploadFile.name : t('library.upload.placeholders.projectFile')}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {t('library.upload.fileHint')}
                    </p>
                  </div>
                  <Input
                    required
                    type="file"
                    onChange={handleUploadFile}
                    className="hidden"
                    id="library-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto rounded-xl border-white/10"
                    onClick={() => document.getElementById('library-file-input')?.click()}
                  >
                    {t('library.upload.actions.selectFile')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">
                  {t('library.upload.fields.cover')}
                </label>
                <div className="relative rounded-2xl border border-dashed border-white/10 bg-black/40 p-4 flex flex-col items-center justify-center text-center min-h-[220px]">
                  {uploadPreview ? (
                    uploadPreview.file.type.startsWith('video/') ? (
                      <video
                        src={uploadPreview.previewUrl}
                        className="w-full h-52 rounded-xl border border-white/10 object-cover"
                        controls
                        loop
                      >
                        <track
                          kind="captions"
                          src="data:text/vtt,WEBVTT"
                          label="Auto captions"
                          default
                        />
                      </video>
                    ) : (
                      <img
                        src={uploadPreview.previewUrl}
                        alt="Preview"
                        className="w-full h-52 rounded-xl border border-white/10 object-cover"
                      />
                    )
                  ) : (
                    <div className="space-y-3 text-sm text-gray-400">
                      <Image className="w-10 h-10 text-emerald-300 mx-auto" />
                      <p>{t('library.upload.placeholders.cover')}</p>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handlePreviewAsset}
                    className="hidden"
                    id="library-cover-input"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4 rounded-xl bg-white/5 border border-white/10"
                    onClick={() => document.getElementById('library-cover-input')?.click()}
                  >
                    {t('library.upload.actions.selectCover')}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Video className="w-4 h-4 text-emerald-300" />
                  {t('library.upload.preview.title')}
                </h4>
                <p className="text-xs text-gray-500">
                  {t('library.upload.preview.description')}
                </p>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-gray-400 space-y-2">
                  <p>{t('library.upload.preview.markdownTitle')}</p>
                  <p>{t('library.upload.preview.markdownHint')}</p>
                  <pre className="rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-gray-400">
{`**${t('library.upload.preview.example.title')}**
${t('library.upload.preview.example.list')}`}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1 rounded-2xl bg-emerald-500/90 text-black hover:bg-emerald-400"
                  disabled={uploading}
                >
                  {uploading ? t('library.upload.actions.submitting') : t('library.upload.actions.submit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 rounded-2xl border border-white/10"
                  onClick={resetUploadFormState}
                >
                  {t('library.upload.actions.reset')}
                </Button>
              </div>
            </div>
          </form>
        </section>
        )}
      </main>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[92vh] bg-black/90 border border-white/10 text-white p-0 overflow-hidden flex flex-col">
          {selectedResource && (
            <>
              <DialogHeader className="p-6 border-b border-white/10">
                <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-emerald-300" />
                  {selectedResource.title}
                </DialogTitle>
                <p className="text-sm text-gray-400">
                  {selectedResource.category} • {formatResourceType(selectedResource.type, t)}
                </p>
                {selectedContributor && (
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-emerald-500/20 shadow-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
                      <AvatarImage
                        src={selectedContributor.image}
                        alt={selectedContributor.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-semibold">
                        {selectedContributor.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <p className="text-white font-semibold">{selectedContributor.name}</p>
                      {selectedPublishedAt && (
                        <p className="text-gray-400">
                          {t('library.detail.publishedAt', {
                            date: selectedPublishedAt,
                            defaultValue: `Publicado em ${selectedPublishedAt}`,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </DialogHeader>
              <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
                <ScrollArea className="flex-1 h-full max-h-full">
                  <div className="p-6 space-y-6 pb-10">
                    {selectedResource.preview_url && (
                      <div className="rounded-2xl border border-white/10 overflow-hidden">
                        {selectedResource.preview_url.includes('vimeo') ||
                        selectedResource.preview_url.includes('youtube') ? (
                          <iframe
                            src={selectedResource.preview_url}
                            title={selectedResource.title}
                            className="w-full aspect-video"
                            allow="autoplay; fullscreen; picture-in-picture"
                          />
                        ) : (
                          <video
                            src={selectedResource.preview_url}
                            controls
                            className="w-full"
                          >
                            <track
                              kind="captions"
                              src={selectedResource.captions_url || 'data:text/vtt,WEBVTT'}
                              label="Auto captions"
                              default
                            />
                          </video>
                        )}
                      </div>
                    )}

                    <div
                      className="prose prose-invert max-w-none text-gray-200 prose-p:leading-relaxed prose-strong:text-emerald-200 prose-a:text-emerald-300 prose-li:marker:text-emerald-300"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedResource.description) }}
                    />

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                      <h4 className="text-lg font-semibold flex items-center gap-2 text-white">
                        <FileText className="w-4 h-4 text-emerald-300" />
                        {t('library.detail.files')}
                      </h4>
                      <div className="space-y-3">
                        {(selectedResource.files || []).map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 text-sm"
                          >
                            <div>
                              <p className="text-gray-200 font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">{file.size}</p>
                            </div>
                            {canInteract ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl border-emerald-400/40 text-emerald-200"
                                onClick={() => handleDownloadFile(selectedResource.id, file)}
                              >
                                <CloudDownload className="w-4 h-4 mr-2" />
                                {t('library.detail.download')}
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {t('library.restricted.onlySubscribers')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                      <h4 className="text-lg font-semibold flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-emerald-300" />
                        {t('library.detail.share')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/library/${selectedResource.id}`
                            )
                          }
                        >
                          {t('library.detail.copyLink')}
                        </Button>
                        {selectedResource.preview_url && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-xl border-white/10 bg-white/5"
                            onClick={() => window.open(selectedResource.preview_url, '_blank', 'noopener')}
                          >
                            <LinkIcon className="w-4 h-4 mr-2" />
                            {t('library.detail.openPreview')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <div className="lg:w-[26rem] border-t lg:border-t-0 lg:border-l border-white/10 bg-black/60 p-6 space-y-6 overflow-y-auto max-h-full">
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-300" />
                      {t('library.detail.rate')}
                    </h4>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => canInteract && handleRating(selectedResource, value)}
                          disabled={!canInteract}
                          className={cn(
                            'transition-transform',
                            canInteract ? 'hover:scale-110' : 'opacity-40 cursor-not-allowed'
                          )}
                          aria-label={t('library.detail.rateValue', { value })}
                        >
                          <Star
                            className={cn(
                              'w-6 h-6',
                              (activeRating[selectedResource.id] || selectedResource.average_rating) >= value
                                ? 'text-amber-300 fill-amber-300'
                                : 'text-gray-500'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {canInteract ? t('library.detail.ratingHint') : t('library.restricted.onlySubscribers')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-cyan-300" />
                      {t('library.detail.comments')}
                    </h4>
                    <Textarea
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder={
                        canInteract
                          ? t('library.detail.commentPlaceholder')
                          : t('library.restricted.onlySubscribers')
                      }
                      rows={4}
                      disabled={!canInteract}
                      className={cn(
                        'rounded-2xl border-white/10 bg-black/40 text-sm resize-none',
                        !canInteract && 'opacity-40 cursor-not-allowed'
                      )}
                    />
                    <Button
                      onClick={() => handleCommentSubmit(selectedResource.id)}
                      disabled={commentSubmitting || !canInteract}
                      className={cn(
                        'w-full rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400',
                        !canInteract && 'opacity-40 cursor-not-allowed hover:bg-emerald-500/90'
                      )}
                    >
                      {commentSubmitting ? t('library.detail.commentSubmitting') : t('library.detail.commentAction')}
                    </Button>
                  </div>

                  <ScrollArea className="h-64 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <div className="space-y-4">
                      {(communityComments[selectedResource.id] || selectedResource.comments || []).map(
                        (comment) => (
                          <div
                            key={comment.id}
                            className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 text-sm"
                          >
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span>{comment.author}</span>
                              {comment.rating && (
                                <span className="flex items-center gap-1 text-amber-300">
                                  <Star className="w-3 h-3" />
                                  {comment.rating}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300">{comment.message}</p>
                          </div>
                        )
                      )}
                      {!(communityComments[selectedResource.id] || selectedResource.comments || []).length && (
                        <p className="text-xs text-gray-500 text-center">
                          {t('library.detail.noComments')}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  <button
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                    onClick={() => setShowDetailDialog(false)}
                  >
                    <XCircle className="w-4 h-4" />
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
