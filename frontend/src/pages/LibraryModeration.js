import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  BadgeCheck,
  Bookmark,
  CheckCircle,
  Clock,
  Eye,
  Filter,
  Flame,
  FolderTree,
  Loader,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  XCircle,
} from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_COLORS = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  under_review: 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40',
  approved: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
  published: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/40',
  archived: 'bg-gray-500/15 text-gray-300 border border-gray-500/40',
};

const markdownToHtml = (value) => {
  if (!value) return '';
  return value
    .replace(/```([^`]+)```/g, '<pre class="rounded-xl bg-black/70 border border-white/10 p-4 overflow-auto text-xs">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-emerald-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl border border-white/10 w-full my-4" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-300 underline">$1</a>')
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/g, '<ul class="list-disc list-inside space-y-1">$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />')
    .replace(/^(.+)$/m, '<p>$1</p>');
};

export default function LibraryModeration({ user, onLogout }) {
  const { t } = useTranslation();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'pending',
    search: '',
    category: 'all',
    type: 'all',
  });
  const [selectedResource, setSelectedResource] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminFile, setAdminFile] = useState(null);
  const [adminCover, setAdminCover] = useState(null);
  const adminFileInputRef = useRef(null);
  const adminCoverInputRef = useRef(null);
  const [adminForm, setAdminForm] = useState({
    title: '',
    description: '',
    category: '',
    type: '',
    tags: '',
    demoUrl: '',
    status: 'published',
    allowDownload: true,
  });
  const STATUS_LABELS = useMemo(
    () => ({
      pending: t('libraryModeration.status.pending'),
      under_review: t('libraryModeration.status.underReview'),
      approved: t('libraryModeration.status.approved'),
      published: t('libraryModeration.status.published'),
      rejected: t('libraryModeration.status.rejected'),
      archived: t('libraryModeration.status.archived'),
    }),
    [t]
  );
  const moderationFilters = useMemo(
    () => [
      { id: 'all', label: t('libraryModeration.filters.status.all') },
      { id: 'pending', label: t('libraryModeration.filters.status.pending') },
      { id: 'under_review', label: t('libraryModeration.filters.status.underReview') },
      { id: 'approved', label: t('libraryModeration.filters.status.approved') },
      { id: 'published', label: t('libraryModeration.filters.status.published') },
      { id: 'rejected', label: t('libraryModeration.filters.status.rejected') },
    ],
    [t]
  );
  const adminStatusOptions = useMemo(
    () => [
      { value: 'pending', label: t('libraryModeration.create.fields.statusOptions.pending') },
      { value: 'approved', label: t('libraryModeration.create.fields.statusOptions.approved') },
      { value: 'published', label: t('libraryModeration.create.fields.statusOptions.published') },
    ],
    [t]
  );
  const formatResourceType = useCallback(
    (type) => {
      if (!type) {
        return t('library.types.other');
      }
      const key = `library.types.${type}`;
      const translated = t(key);
      return translated === key ? type : translated;
    },
    [t]
  );

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/admin/library/resources`, { headers });
      const payload = Array.isArray(response.data) ? response.data : [];
      setResources(payload);
      setSelectedResource((prev) => {
        if (!prev) return prev;
        const updated = payload.find((item) => item.id === prev.id);
        return updated || prev;
      });
    } catch (error) {
      console.error('Erro ao carregar recursos da biblioteca:', error);
      setResources([]);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    return () => {
      if (adminCover?.previewUrl) {
        URL.revokeObjectURL(adminCover.previewUrl);
      }
    };
  }, [adminCover]);

  const filteredResources = useMemo(() => {
    let list = [...resources];
    if (filters.status !== 'all') {
      list = list.filter((item) => item.status === filters.status);
    }
    if (filters.category !== 'all') {
      list = list.filter((item) => item.category === filters.category);
    }
    if (filters.type !== 'all') {
      list = list.filter((item) => item.type === filters.type);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          (item.contributor?.name || '').toLowerCase().includes(term) ||
          (item.tags || []).some((tag) => tag.toLowerCase().includes(term))
      );
    }
    list.sort((a, b) => new Date(b.submitted_at || b.updated_at || 0) - new Date(a.submitted_at || a.updated_at || 0));
    return list;
  }, [filters, resources]);

  const categories = useMemo(() => {
    const catalog = new Map();
    resources.forEach((resource) => {
      if (resource.category && !catalog.has(resource.category)) {
        catalog.set(resource.category, resource.category);
      }
    });
    return Array.from(catalog.values());
  }, [resources]);

  const resourceTypes = useMemo(() => {
    const items = new Map();
    resources.forEach((resource) => {
      if (resource.type && !items.has(resource.type)) {
        items.set(resource.type, resource.type);
      }
    });
    return Array.from(items.values());
  }, [resources]);

  const typeOptions = resourceTypes.length
    ? resourceTypes
    : ['project', 'template', 'snippet', 'documentation', 'other'];

  const stats = useMemo(() => {
    const pending = resources.filter((item) => item.status === 'pending').length;
    const published = resources.filter((item) => item.status === 'published').length;
    const community = resources.filter((item) => item.is_community).length;
    const featured = resources.filter((item) => item.featured).length;
    return { pending, published, community, featured };
  }, [resources]);

  const resetAdminForm = useCallback(() => {
    setAdminForm({
      title: '',
      description: '',
      category: '',
      type: '',
      tags: '',
      demoUrl: '',
      status: 'published',
      allowDownload: true,
    });
    setAdminFile(null);
    if (adminCover?.previewUrl) {
      URL.revokeObjectURL(adminCover.previewUrl);
    }
    setAdminCover(null);
    if (adminFileInputRef.current) adminFileInputRef.current.value = '';
    if (adminCoverInputRef.current) adminCoverInputRef.current.value = '';
  }, [adminCover]);

  const handleAdminFileSelect = (event) => {
    const [file] = event.target.files;
    if (!file) return;
    setAdminFile(file);
  };

  const handleAdminCoverSelect = (event) => {
    const [file] = event.target.files;
    if (!file) return;
    if (adminCover?.previewUrl) {
      URL.revokeObjectURL(adminCover.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setAdminCover({ file, previewUrl });
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    if (!adminFile) {
      alert(t('libraryModeration.alerts.missingPrimaryFile'));
      return;
    }

    const formData = new FormData();
    formData.append('file', adminFile);
    if (adminCover?.file) {
      formData.append('cover', adminCover.file);
    }
    formData.append('title', adminForm.title);
    formData.append('description', adminForm.description);
    formData.append('category', adminForm.category);
    formData.append('type', adminForm.type || 'project');
    formData.append('tags', adminForm.tags);
    formData.append('demoUrl', adminForm.demoUrl);
    formData.append('status', adminForm.status);
    formData.append('allowCommunityDownload', adminForm.allowDownload ? 'true' : 'false');

    setAdminUploading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'multipart/form-data',
      };
      await axios.post(`${API}/admin/library/resources`, formData, { headers });
      await fetchResources();
      resetAdminForm();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Erro ao criar recurso:', error);
      alert(t('libraryModeration.alerts.createError'));
    } finally {
      setAdminUploading(false);
    }
  };

  const updateResource = (resourceId, data) => {
    setResources((prev) =>
      prev.map((item) => (item.id === resourceId ? { ...item, ...data, updated_at: new Date().toISOString() } : item))
    );
  };

  const handleStatusChange = async (resource, status) => {
    updateResource(resource.id, { status });
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(
        `${API}/admin/library/resources/${resource.id}`,
        { status },
        { headers }
      );
      await fetchResources();
    } catch (error) {
      console.error('Erro ao atualizar status do recurso:', error);
      updateResource(resource.id, { status: resource.status });
    }
  };

  const handleFeatureToggle = async (resource) => {
    const nextState = !resource.featured;
    updateResource(resource.id, { featured: nextState });
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/admin/library/resources/${resource.id}/feature`,
        { featured: nextState },
        { headers }
      );
      await fetchResources();
    } catch (error) {
      console.error('Erro ao atualizar destaque:', error);
      updateResource(resource.id, { featured: resource.featured });
    }
  };

  const handleRemoval = async (resource) => {
    const confirmed = window.confirm(t('libraryModeration.alerts.confirmRemoval', { title: resource.title }));
    if (!confirmed) return;

    const previous = resources;
    setResources((prev) => prev.filter((item) => item.id !== resource.id));
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API}/admin/library/resources/${resource.id}`, { headers });
      await fetchResources();
    } catch (error) {
      console.error('Erro ao remover recurso:', error);
      setResources(previous);
      alert(t('libraryModeration.alerts.removeError'));
    }
  };

  const handleNoteSave = async () => {
    if (!selectedResource) return;
    setSavingNote(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/admin/library/resources/${selectedResource.id}/notes`,
        { note: internalNote },
        { headers }
      );
      updateResource(selectedResource.id, {
        last_moderation_note: internalNote,
      });
      await fetchResources();
      setInternalNote('');
      alert(t('libraryModeration.alerts.noteSuccess'));
    } catch (error) {
      console.error('Erro ao salvar nota de moderação:', error);
      alert(t('libraryModeration.alerts.noteError'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchResources();
    setRefreshing(false);
  };

  const renderStatusBadge = (status) => {
    const label = STATUS_LABELS[status] || status;
    const styles = STATUS_COLORS[status] || 'bg-white/5 text-gray-200 border border-white/10';
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles}`}>{label}</span>;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-3">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200 uppercase tracking-[0.35em] text-[11px] px-3 py-1">
            {t('libraryModeration.header.badge')}
          </Badge>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold bg-gradient-to-br from-emerald-200 via-cyan-200 to-purple-200 text-transparent bg-clip-text">
                {t('libraryModeration.header.title')}
              </h1>
              <p className="text-sm text-gray-400 max-w-2xl">
                {t('libraryModeration.header.description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('libraryModeration.header.actions.add')}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-white/10 text-sm text-gray-300 hover:text-white"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {t('libraryModeration.header.actions.refresh')}
              </Button>
              <Button
                className="rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400"
                onClick={() => window.open('/library', '_blank', 'noopener')}
              >
                <Eye className="mr-2 h-4 w-4" />
                {t('libraryModeration.header.actions.viewPublic')}
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-amber-200">
                {t('libraryModeration.stats.pending.title')}
              </span>
              <Clock className="w-5 h-5 text-amber-300" />
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.pending}</p>
            <p className="text-xs text-gray-400 mt-2">
              {t('libraryModeration.stats.pending.caption')}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                {t('libraryModeration.stats.published.title')}
              </span>
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.published}</p>
            <p className="text-xs text-gray-400 mt-2">
              {t('libraryModeration.stats.published.caption')}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                {t('libraryModeration.stats.community.title')}
              </span>
              <Users className="w-5 h-5 text-cyan-300" />
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.community}</p>
            <p className="text-xs text-gray-400 mt-2">
              {t('libraryModeration.stats.community.caption')}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-purple-200">
                {t('libraryModeration.stats.featured.title')}
              </span>
              <Flame className="w-5 h-5 text-purple-300" />
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.featured}</p>
            <p className="text-xs text-gray-400 mt-2">
              {t('libraryModeration.stats.featured.caption')}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-300" />
                {t('libraryModeration.filters.title')}
              </h2>
              <p className="text-sm text-gray-400">{t('libraryModeration.filters.description')}</p>
            </div>
            <div className="flex gap-3">
              {moderationFilters.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilters((prev) => ({ ...prev, status: item.id }))}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    filters.status === item.id
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr,1fr,1fr]">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder={t('libraryModeration.filters.searchPlaceholder')}
                className="border-0 bg-transparent focus-visible:ring-0 text-sm text-gray-200 placeholder:text-gray-500"
              />
            </div>
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm text-gray-200">
                <SelectValue placeholder={t('libraryModeration.filters.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0f0f] border border-white/10 text-sm text-gray-200">
                <SelectItem value="all">{t('libraryModeration.filters.categoryAll')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
            >
              <SelectTrigger className="rounded-2xl border-white/10 bg-black/40 text-sm text-gray-200">
                <SelectValue placeholder={t('libraryModeration.filters.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0f0f] border border-white/10 text-sm text-gray-200">
                <SelectItem value="all">{t('libraryModeration.filters.typeAll')}</SelectItem>
                {resourceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatResourceType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-300" />
              {t('libraryModeration.resources.title')}
            </h2>
            <p className="text-xs text-gray-500">
              {t('libraryModeration.resources.total', { count: filteredResources.length })}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm text-gray-400">{t('libraryModeration.resources.loading')}</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-10 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 mx-auto text-red-300" />
              <h3 className="text-lg font-semibold text-white">{t('libraryModeration.resources.errorTitle')}</h3>
              <p className="text-sm text-red-200/80 max-w-xl mx-auto">
                {t('libraryModeration.resources.errorDescription')}
              </p>
              <Button
                onClick={fetchResources}
                className="rounded-xl bg-red-500/80 text-black hover:bg-red-400 inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('libraryModeration.actions.retry')}
              </Button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
              <BadgeCheck className="w-10 h-10 mx-auto text-emerald-300" />
              <h3 className="text-lg font-semibold text-white">{t('libraryModeration.resources.emptyTitle')}</h3>
              <p className="text-sm text-gray-400">
                {t('libraryModeration.resources.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResources.map((resource) => (
                <article
                  key={resource.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:border-emerald-400/40"
                >
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {renderStatusBadge(resource.status)}
                        {resource.featured && (
                          <Badge variant="outline" className="border-amber-400/50 text-amber-200 bg-amber-500/10">
                            {t('libraryModeration.badges.featured')}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-gray-400" />
                          {resource.submitted_at
                            ? new Date(resource.submitted_at).toLocaleString()
                            : t('libraryModeration.resources.dateUnknown')}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-semibold text-white">{resource.title}</h3>
                          <p className="text-sm text-gray-400">
                            {resource.contributor?.name || t('libraryModeration.resources.unknownAuthor')} •{' '}
                            {resource.contributor?.email || t('libraryModeration.resources.noEmail')}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                          {resource.category && (
                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-1">
                              <FolderTree className="w-3 h-3 text-emerald-300" />
                              {resource.category}
                            </span>
                          )}
                          {resource.type && (
                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-1">
                              <Bookmark className="w-3 h-3 text-cyan-300" />
                              {formatResourceType(resource.type)}
                            </span>
                          )}
                          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-purple-300" />
                            {t('libraryModeration.resources.feedbackCount', {
                              count: resource.comment_count || 0,
                            })}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-300 line-clamp-3">{resource.description}</p>

                      <div className="flex flex-wrap gap-2">
                        {(resource.tags || []).map((tag) => (
                          <Badge key={`${resource.id}-${tag}`} variant="outline" className="border-white/10 text-gray-300">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full sm:w-auto">
                      <Button
                        variant="secondary"
                        className="rounded-xl border-white/10 bg-white/10 text-gray-200 hover:text-white hover:border-white/30"
                        onClick={() => {
                          setSelectedResource(resource);
                          setInternalNote(resource.last_moderation_note || '');
                          setShowDetail(true);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.viewDetails')}
                      </Button>
                      <Button
                        className="rounded-xl bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/40"
                        onClick={() => handleStatusChange(resource, 'approved')}
                        disabled={resource.status === 'approved' || resource.status === 'published'}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.approve')}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl border-white/10 text-gray-200 hover:text-white"
                        onClick={() => handleStatusChange(resource, 'published')}
                        disabled={resource.status === 'published'}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.publish')}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl border-amber-500/40 text-amber-200 hover:border-amber-400"
                        onClick={() => handleFeatureToggle(resource)}
                      >
                        <Flame className="mr-2 h-4 w-4" />
                        {resource.featured
                          ? t('libraryModeration.actions.removeFeatured')
                          : t('libraryModeration.actions.markFeatured')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:text-red-200"
                        onClick={() => handleStatusChange(resource, 'rejected')}
                        disabled={resource.status === 'rejected'}
                      >
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.reject')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl border border-white/10 text-gray-400 hover:text-white"
                        onClick={() => handleStatusChange(resource, 'archived')}
                        disabled={resource.status === 'archived'}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.archive')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => handleRemoval(resource)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('libraryModeration.actions.remove')}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            resetAdminForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl bg-black/95 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-300" />
              {t('libraryModeration.create.title')}
            </DialogTitle>
            <p className="text-sm text-gray-400">
              {t('libraryModeration.create.description')}
            </p>
          </DialogHeader>

          <form onSubmit={handleAdminSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.title.label')}</label>
                <Input
                  required
                  value={adminForm.title}
                  onChange={(event) =>
                    setAdminForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder={t('libraryModeration.create.fields.title.placeholder')}
                  className="bg-black/40 border-white/10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.category.label')}</label>
                <Input
                  value={adminForm.category}
                  onChange={(event) =>
                    setAdminForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder={t('libraryModeration.create.fields.category.placeholder')}
                  className="bg-black/40 border-white/10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.description.label')}</label>
              <Textarea
                required
                rows={6}
                value={adminForm.description}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder={t('libraryModeration.create.fields.description.placeholder')}
                className="bg-black/40 border-white/10 rounded-xl resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.type.label')}</label>
                <Select
                  value={adminForm.type}
                  onValueChange={(value) =>
                    setAdminForm((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger className="bg-black/40 border-white/10 rounded-xl text-gray-200">
                    <SelectValue placeholder={t('libraryModeration.create.fields.type.placeholder')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0f0f] border border-white/10 text-gray-200">
                    {typeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatResourceType(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.status.label')}</label>
                <Select
                  value={adminForm.status}
                  onValueChange={(value) =>
                    setAdminForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="bg-black/40 border-white/10 rounded-xl text-gray-200">
                    <SelectValue placeholder={t('libraryModeration.create.fields.status.placeholder')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0f0f] border border-white/10 text-gray-200">
                    {adminStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.tags.label')}</label>
                <Input
                  value={adminForm.tags}
                  onChange={(event) =>
                    setAdminForm((prev) => ({ ...prev, tags: event.target.value }))
                  }
                  placeholder={t('libraryModeration.create.fields.tags.placeholder')}
                  className="bg-black/40 border-white/10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.file.label')}</label>
                <div className="rounded-xl border border-dashed border-emerald-500/40 bg-black/40 p-4">
                  <p className="text-sm text-gray-300">
                    {adminFile
                      ? adminFile.name
                      : t('libraryModeration.create.fields.file.placeholder')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('libraryModeration.create.fields.file.hint')}
                  </p>
                  <input
                    ref={adminFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAdminFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 rounded-xl border-white/10"
                    onClick={() => adminFileInputRef.current?.click()}
                  >
                    {t('libraryModeration.create.actions.chooseFile')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.cover.label')}</label>
                <div className="rounded-xl border border-dashed border-white/20 bg-black/40 p-4">
                  {adminCover ? (
                    adminCover.file.type.startsWith('video/') ? (
                      <video
                        src={adminCover.previewUrl}
                        controls
                        className="w-full rounded-lg border border-white/10"
                      >
                        <track kind="captions" src="data:text/vtt,WEBVTT" label="Auto captions" default />
                      </video>
                    ) : (
                      <img
                        src={adminCover.previewUrl}
                        alt="Preview"
                        className="w-full rounded-lg border border-white/10 object-cover"
                      />
                    )
                  ) : (
                    <p className="text-sm text-gray-500">
                      {t('libraryModeration.create.fields.cover.placeholder')}
                    </p>
                  )}
                  <input
                    ref={adminCoverInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleAdminCoverSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 rounded-xl border border-white/10 text-gray-300"
                    onClick={() => adminCoverInputRef.current?.click()}
                  >
                    {t('libraryModeration.create.actions.chooseCover')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">{t('libraryModeration.create.fields.demoUrl.label')}</label>
              <Input
                value={adminForm.demoUrl}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, demoUrl: event.target.value }))
                }
                placeholder={t('libraryModeration.create.fields.demoUrl.placeholder')}
                className="bg-black/40 border-white/10 rounded-xl"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={adminForm.allowDownload}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, allowDownload: event.target.checked }))
                }
                className="h-4 w-4 accent-emerald-500 rounded"
              />
              {t('libraryModeration.create.fields.allowDownload')}
            </label>

            <div className="flex items-center gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl border border-white/10 text-gray-300 hover:text-white"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetAdminForm();
                }}
              >
                {t('libraryModeration.create.actions.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={adminUploading}
                className="rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400"
              >
                {adminUploading
                  ? t('libraryModeration.create.actions.submitting')
                  : t('libraryModeration.create.actions.submit')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-5xl bg-black/95 border border-white/10 text-white p-0 overflow-hidden">
          {selectedResource && (
            <>
              <DialogHeader className="p-6 border-b border-white/10">
                <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
                  <Archive className="w-5 h-5 text-emerald-300" />
                  {selectedResource.title}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {renderStatusBadge(selectedResource.status)}
                  {selectedResource.featured && (
                    <Badge variant="outline" className="border-amber-400/50 text-amber-200 bg-amber-500/10">
                      {t('libraryModeration.badges.featured')}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <UploadCloud className="w-3 h-3" />
                    {t('libraryModeration.details.sentOn')}{' '}
                    {selectedResource.submitted_at
                      ? new Date(selectedResource.submitted_at).toLocaleString()
                      : t('libraryModeration.resources.dateUnknown')}
                  </span>
                </div>
              </DialogHeader>

              <div className="grid lg:grid-cols-[2fr,1fr]">
                <ScrollArea className="h-[75vh]">
                  <div className="p-6 space-y-6">
                    {selectedResource.cover_url && (
                      <img
                        src={selectedResource.cover_url}
                        alt={selectedResource.title}
                        className="w-full rounded-2xl border border-white/10"
                      />
                    )}

                    <div
                      className="prose prose-invert max-w-none text-gray-200 prose-p:leading-relaxed prose-strong:text-emerald-200 prose-a:text-emerald-300"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedResource.description) }}
                    />

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-300" />
                        {t('libraryModeration.details.contributor.title')}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {selectedResource.contributor?.name || t('libraryModeration.resources.unknownAuthor')}
                      </p>
                      {selectedResource.contributor?.email && (
                        <p className="text-xs text-gray-500">{selectedResource.contributor.email}</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-cyan-300" />
                        {t('libraryModeration.details.files.title')}
                      </h3>
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
                            <Button
                              variant="secondary"
                              className="rounded-xl border-white/10 bg-white/10 text-gray-200 hover:text-white"
                              onClick={() => window.open(file.url, '_blank', 'noopener')}
                            >
                              {t('libraryModeration.details.files.download')}
                            </Button>
                          </div>
                        ))}
                        {!(selectedResource.files || []).length && (
                          <p className="text-xs text-gray-500">
                            {t('libraryModeration.details.files.empty')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-300" />
                        {t('libraryModeration.details.feedback.title')}
                      </h3>
                      <div className="space-y-3">
                        {(selectedResource.comments || []).map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                              <span>{comment.author || t('libraryModeration.details.feedback.anonymous')}</span>
                              <span>
                                {comment.created_at
                                  ? new Date(comment.created_at).toLocaleString()
                                  : t('libraryModeration.resources.dateUnknown')}
                              </span>
                            </div>
                            <p className="text-gray-300">{comment.message}</p>
                          </div>
                        ))}
                        {!(selectedResource.comments || []).length && (
                          <p className="text-xs text-gray-500">
                            {t('libraryModeration.details.feedback.empty')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="border-l border-white/10 bg-black/60 p-6 space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-white uppercase tracking-[0.3em]">
                      {t('libraryModeration.details.nextActions.title')}
                    </h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <button
                        className="w-full text-left px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/50 transition-all"
                        onClick={() => handleStatusChange(selectedResource, 'approved')}
                        disabled={selectedResource.status === 'approved'}
                      >
                        {t('libraryModeration.details.nextActions.approve')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/50 transition-all"
                        onClick={() => handleStatusChange(selectedResource, 'published')}
                        disabled={selectedResource.status === 'published'}
                      >
                        {t('libraryModeration.details.nextActions.publish')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-500/50 transition-all"
                        onClick={() => handleFeatureToggle(selectedResource)}
                      >
                        {selectedResource.featured
                          ? t('libraryModeration.actions.removeFeatured')
                          : t('libraryModeration.actions.markFeatured')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-500/50 transition-all"
                        onClick={() => handleStatusChange(selectedResource, 'rejected')}
                        disabled={selectedResource.status === 'rejected'}
                      >
                        {t('libraryModeration.details.nextActions.reject')}
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:border-white/30 transition-all"
                        onClick={() => handleStatusChange(selectedResource, 'archived')}
                        disabled={selectedResource.status === 'archived'}
                      >
                        {t('libraryModeration.details.nextActions.archive')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white uppercase tracking-[0.3em]">
                      {t('libraryModeration.details.notes.title')}
                    </h4>
                    <Textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      rows={6}
                      placeholder={t('libraryModeration.details.notes.placeholder')}
                      className="rounded-2xl border-white/10 bg-black/40 text-sm text-gray-200 resize-none"
                    />
                    <Button
                      className="w-full rounded-xl bg-emerald-500/90 text-black hover:bg-emerald-400"
                      onClick={handleNoteSave}
                      disabled={!internalNote.trim() || savingNote}
                    >
                      {savingNote
                        ? t('libraryModeration.details.notes.saving')
                        : t('libraryModeration.details.notes.save')}
                    </Button>
                  </div>

                  {selectedResource.last_moderation_note && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
                      <p className="font-semibold text-white mb-1">
                        {t('libraryModeration.details.notes.lastNote')}
                      </p>
                      <p>{selectedResource.last_moderation_note}</p>
                    </div>
                  )}

                  <button
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mt-4"
                    onClick={() => setShowDetail(false)}
                  >
                    <XCircle className="w-4 h-4" />
                    {t('libraryModeration.details.closePanel')}
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
