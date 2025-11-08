import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useTranslation } from 'react-i18next';
import UnifiedHeader from '@/components/UnifiedHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, ShieldCheck, ExternalLink, Award, Loader2, FileDown, Linkedin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MyCertificates = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [certificates, setCertificates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [supportConfig, setSupportConfig] = useState(null);
  const [courses, setCourses] = useState([]);
  const [issuingCourseId, setIssuingCourseId] = useState(null);
  const previewRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 920, height: 650 });

  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    fetchSupportConfig();
    fetchCertificates();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        setCanvasSize({
          width: entry.contentRect.width || 920,
          height: entry.contentRect.height || 650
        });
      });
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const orderedCertificates = useMemo(() => {
    return [...certificates].sort(
      (a, b) => new Date(b.issued_at || 0) - new Date(a.issued_at || 0)
    );
  }, [certificates]);

  useEffect(() => {
    if (orderedCertificates.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !orderedCertificates.find((cert) => cert.id === selectedId)) {
      setSelectedId(orderedCertificates[0].id);
    }
  }, [orderedCertificates, selectedId]);

  const selectedCertificate = useMemo(
    () => orderedCertificates.find((cert) => cert.id === selectedId) || orderedCertificates[0] || null,
    [orderedCertificates, selectedId]
  );

  const template = selectedCertificate?.template || selectedCertificate?.template_snapshot;
  const textElements = template?.text_elements || [];
  const accentColor = template?.accent_color || '#10b981';
  const backgroundUrl = template?.background_url;
  const signatureImages = (template?.signature_images || []).filter(Boolean);
  const validationMessage =
    template?.validation_message ||
    t('certificatesPage.defaultValidation', 'Certificado emitido e validado com selo digital.');

  const locale = user?.preferred_locale || 'pt-BR';

  const formatDate = (value) => {
    if (!value) return '--';
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleDateString();
    }
  };

  const hoursValue = selectedCertificate?.workload_hours || template?.workload_hours || 0;

  const fetchSupportConfig = async () => {
    try {
      const response = await axios.get(`${API}/support/config`);
      setSupportConfig(response.data);
    } catch (error) {
      console.error('Error fetching support config:', error);
      setSupportConfig(null);
    }
  };

  const fetchCertificates = async (withLoader = true) => {
    try {
      if (withLoader) {
        setLoading(true);
      }
      const response = await axios.get(`${API}/certificates/me`, { headers });
      setCertificates(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar certificados', error);
    } finally {
      if (withLoader) {
        setLoading(false);
      }
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${API}/student/courses`, {
        headers,
        params: { include_all_languages: true }
      });
      setCourses(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar cursos para emissão de certificados', error);
    }
  };

  const handleDownload = async () => {
    if (!selectedCertificate) return;
    try {
      setExportingFormat('png');
      const dataUrl = await captureCertificateImage();
      const link = document.createElement('a');
      const courseName = selectedCertificate.course_title?.replace(/\s+/g, '-') || 'certificado';
      link.download = `${courseName}-${selectedCertificate.token}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Falha ao gerar imagem do certificado', error);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCertificate) return;
    try {
      setExportingFormat('pdf');
      const dataUrl = await captureCertificateImage();
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
      const courseName = selectedCertificate.course_title?.replace(/\s+/g, '-') || 'certificado';
      pdf.save(`${courseName}-${selectedCertificate.token}.pdf`);
    } catch (error) {
      console.error('Falha ao gerar PDF do certificado', error);
    } finally {
      setExportingFormat(null);
    }
  };

  const getCertificateOrigin = () =>
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://hiperautomacao.academy';

  const captureCertificateImage = async () => {
    if (!previewRef.current) {
      throw new Error('Preview não está disponível');
    }
    return toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
  };

  const createCertificateShare = async (imageData, token) => {
    const payload = {
      token,
      image_data: imageData
    };
    const response = await axios.post(`${API}/certificates/share`, payload, { headers });
    return response.data;
  };

  const handleShareLinkedIn = async () => {
    if (!selectedCertificate) return;
    try {
      setExportingFormat('share');
      const imageData = await captureCertificateImage();
      const { share_id } = await createCertificateShare(imageData, selectedCertificate.token);
      const sharePageUrl = `${getCertificateOrigin()}/certificates/share/${share_id}`;
      const validationUrl = `${getCertificateOrigin()}/certificates/validate?token=${selectedCertificate.token}`;
      const summary = t(
        'certificatesPage.linkedinSummary',
        'Concluí {{course}} na Hiperautomação Academy. Token {{token}}. Valide em {{validationUrl}}.',
        {
          course: selectedCertificate.course_title || template?.name || 'certificado',
          token: selectedCertificate.token,
          validationUrl
        }
      );
      const shareUrl = new URL('https://www.linkedin.com/sharing/share-offsite/');
      shareUrl.searchParams.set('url', sharePageUrl);
      shareUrl.searchParams.set('title', selectedCertificate.course_title || template?.name || 'Certificado');
      shareUrl.searchParams.set('summary', summary);
      shareUrl.searchParams.set('source', 'Hiperautomação Academy');
      window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(error?.response?.data?.detail || 'Falha ao compartilhar no LinkedIn');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleAddLinkedInSkill = () => {
    if (!selectedCertificate) return;
    const skillName = selectedCertificate.course_title || template?.name || 'Hiperautomação Academy';
    const skillUrl = new URL('https://www.linkedin.com/profile/add');
    skillUrl.searchParams.set('startTask', 'SKILL');
    skillUrl.searchParams.set('skill', skillName);
    window.open(skillUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  const issuableCourses = useMemo(() => {
    if (!courses?.length) return [];
    const issuedCourseIds = new Set(certificates.map((certificate) => certificate.course_id));
    return courses.filter((course) => {
      const progressValue =
        course.progress_percent ??
        course.progressPercentage ??
        course.progress ??
        course.completion_percent ??
        0;
      return progressValue >= 100 && !issuedCourseIds.has(course.id);
    });
  }, [courses, certificates]);

  const handleIssueCertificate = async (courseId) => {
    try {
      setIssuingCourseId(courseId);
      await axios.post(
        `${API}/certificates/issue`,
        { course_id: courseId },
        { headers }
      );
      await fetchCertificates(false);
      await fetchCourses();
    } catch (error) {
      alert(
        error?.response?.data?.detail ||
          t('certificatesPage.issueError', 'Não foi possível emitir o certificado.')
      );
    } finally {
      setIssuingCourseId(null);
    }
  };

  const copyToken = async () => {
    if (!selectedCertificate) return;
    try {
      await navigator.clipboard.writeText(selectedCertificate.token);
      alert(t('certificatesPage.tokenCopied', 'Token copiado!'));
    } catch {
      alert(selectedCertificate.token);
    }
  };

  const getBindingValue = (binding, fallbackLabel, element) => {
    if (!selectedCertificate) return fallbackLabel;
    switch (binding) {
      case 'student_name':
        return selectedCertificate.student_name;
      case 'course_title':
        return selectedCertificate.course_title;
      case 'completion_date':
        return formatDate(selectedCertificate.completed_at);
      case 'issued_date':
        return formatDate(selectedCertificate.issued_at);
      case 'validation_code':
        return selectedCertificate.token;
      case 'hours':
        return t('certificatesPage.hoursLabel', { hours: hoursValue });
      case 'instructor_name':
        return selectedCertificate.metadata?.instructor_name || 'Hiperautomação Academy';
      case 'custom':
      default:
        return element?.content || fallbackLabel;
    }
  };

  const renderCertificatePreview = () => {
    if (!selectedCertificate || !template) return null;
    return (
      <div
        ref={previewRef}
        className="relative w-full aspect-[1.414/1] rounded-3xl overflow-hidden border-4 shadow-2xl"
        style={{
          borderColor: accentColor,
          backgroundImage: backgroundUrl
            ? `url(${backgroundUrl})`
            : 'linear-gradient(135deg, #0f172a, #020617)'
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm pointer-events-none" />
        <div className="relative h-full w-full p-10 z-10">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm tracking-[0.55em] text-gray-500 uppercase">
                {t('certificatesPage.badge', 'Certificado oficial')}
              </p>
              <h1 className="text-3xl font-semibold text-[#0f172a]">
                {template.name || selectedCertificate.course_title}
              </h1>
            </div>
            {template.badge_url ? (
              <img src={template.badge_url} alt="Badge" className="h-16 object-contain drop-shadow" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                <Award className="text-emerald-400" />
              </div>
            )}
          </div>

          <div className="mt-6 relative h-[75%]" ref={canvasRef}>
            {textElements.map((element) => {
              const x = (element.x / 100) * canvasSize.width;
              const y = (element.y / 100) * canvasSize.height;
              const width = ((element.width || 60) / 100) * canvasSize.width;
              return (
                <div
                  key={element.id}
                  className="absolute px-3 py-1"
                  style={{
                    left: x,
                    top: y,
                    width,
                    color: element.color,
                    fontSize: `${element.font_size}px`,
                    fontFamily: element.font_family,
                    fontWeight: element.font_weight,
                    textTransform: element.uppercase ? 'uppercase' : 'none',
                    textAlign: element.align,
                    letterSpacing: `${element.letter_spacing || 0}em`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {getBindingValue(element.binding, element.label, element)}
                </div>
              );
            })}
          </div>

          {signatureImages.length > 0 && (
            <div className="flex justify-center gap-16 mt-8">
              {signatureImages.slice(0, 3).map((url, index) => (
                <div key={`${url}-${index}`} className="text-center">
                  <img src={url} alt="Assinatura" className="h-16 object-contain mx-auto mb-2" />
                  <div className="h-px w-40 bg-gray-400 mx-auto" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center space-y-4">
      <ShieldCheck className="mx-auto text-emerald-400" size={48} />
      <h3 className="text-2xl font-semibold">{t('certificatesPage.emptyTitle', 'Nenhum certificado disponível ainda')}</h3>
      <p className="text-gray-400 max-w-xl mx-auto">
        {t(
          'certificatesPage.emptyDescription',
          'Conclua um curso com certificação para liberar automaticamente seus diplomas oficiais de forma digital.'
        )}
      </p>
      <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
        <a href="/dashboard">{t('certificatesPage.exploreCourses', 'Explorar cursos')}</a>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#02060f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] pointer-events-none" />
      <div className="absolute -top-24 -right-10 w-80 h-80 bg-emerald-500/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-8 w-72 h-72 bg-cyan-500/15 blur-[130px] pointer-events-none" />

      <UnifiedHeader
        user={user}
        onLogout={onLogout}
        showInsights={false}
        supportConfig={supportConfig}
        resumeLessonId={null}
      />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="glass-panel bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="uppercase text-sm tracking-[0.35em] text-emerald-300/70 flex items-center gap-2">
              <ShieldCheck size={16} /> {t('certificatesPage.subtitle', 'Valide, baixe e compartilhe seus certificados.')}
            </p>
            <h1 className="text-3xl font-bold mt-2">{t('certificatesPage.title', 'Meus certificados')}</h1>
            <p className="text-gray-400">
              {t(
                'certificatesPage.helper',
                'Cada diploma acompanha token único de validação pública para empresas e parceiros.'
              )}
            </p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-4 py-2 rounded-2xl text-sm">
            {t('certificatesPage.total', '{{count}} certificados', { count: certificates.length })}
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>{t('common.loading')}</p>
          </div>
        ) : certificates.length === 0 && issuableCourses.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                {t('certificatesPage.collection', 'Coleção')}
              </h2>
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {orderedCertificates.map((certificate) => (
                  <button
                    key={certificate.id}
                    onClick={() => setSelectedId(certificate.id)}
                    className={`w-full text-left border rounded-2xl px-4 py-3 transition ${
                      certificate.id === selectedId
                        ? 'border-emerald-400/60 bg-emerald-400/10'
                        : 'border-white/5 bg-white/5 hover:border-emerald-400/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{certificate.course_title}</p>
                        <p className="text-xs text-gray-400">
                          {t('certificatesPage.issuedOn', 'Emitido em')} {formatDate(certificate.issued_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-emerald-300 border-emerald-400/40">
                        {t('certificatesPage.statusValid', 'Válido')}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {issuableCourses.length > 0 && (
                <section className="glass-panel border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                        {t('certificatesPage.readyBadge', 'Curso concluído')}
                      </p>
                      <h2 className="text-xl font-semibold text-white">
                        {t('certificatesPage.readyToIssueTitle', 'Certificados prontos para emitir')}
                      </h2>
                      <p className="text-sm text-emerald-100/70">
                        {t(
                          'certificatesPage.readyToIssueDescription',
                          'Clique para gerar seu diploma digital personalizado.'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {issuableCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div>
                          <p className="text-sm text-gray-300">{course.category || 'Curso'}</p>
                          <h3 className="text-lg font-semibold text-white">{course.title}</h3>
                          <p className="text-xs text-gray-400">
                            {t('certificatesPage.readyCourseSubtitle', 'Disponível para emissão imediata.')}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleIssueCertificate(course.id)}
                          disabled={issuingCourseId === course.id}
                          className="bg-emerald-600 hover:bg-emerald-500"
                        >
                          {issuingCourseId === course.id ? (
                            <Loader2 className="animate-spin mr-2" size={16} />
                          ) : (
                            <Award className="mr-2" size={16} />
                          )}
                          {t('certificatesPage.issueCta', 'Emitir certificado')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {renderCertificatePreview()}

              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleDownload}
                    disabled={exportingFormat === 'png'}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {exportingFormat === 'png' ? (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    ) : (
                      <Download className="mr-2" size={16} />
                    )}
                    {t('certificatesPage.download', 'Baixar certificado')}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 text-white"
                    onClick={handleDownloadPdf}
                    disabled={exportingFormat === 'pdf'}
                  >
                    {exportingFormat === 'pdf' ? (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    ) : (
                      <FileDown className="mr-2" size={16} />
                    )}
                    {t('certificatesPage.downloadPdf', 'Salvar PDF')}
                  </Button>
                  <Button variant="outline" className="border-white/20" onClick={copyToken}>
                    <Copy className="mr-2" size={16} />
                    {t('certificatesPage.copyToken', 'Copiar token')}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20"
                    onClick={() =>
                      window.open(`/certificates/validate?token=${selectedCertificate?.token}`, '_blank')
                    }
                  >
                    <ExternalLink className="mr-2" size={16} />
                    {t('certificatesPage.openValidation', 'Abrir página de validação')}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20"
                    onClick={handleShareLinkedIn}
                    disabled={!selectedCertificate || exportingFormat === 'share'}
                  >
                    {exportingFormat === 'share' ? (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    ) : (
                      <Linkedin className="mr-2" size={16} />
                    )}
                    {t('certificatesPage.shareLinkedIn', 'Compartilhar no LinkedIn')}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20"
                    onClick={handleAddLinkedInSkill}
                    disabled={!selectedCertificate}
                  >
                    <Linkedin className="mr-2" size={16} />
                    {t('certificatesPage.addSkillLinkedIn', 'Adicionar habilidade no LinkedIn')}
                  </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                      {t('certificatesPage.validationToken', 'Token de validação')}
                    </p>
                    <p className="text-sm font-mono mt-2 break-all">{selectedCertificate?.token}</p>
                  </div>
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                      {t('certificatesPage.issuedOn', 'Emitido em')}
                    </p>
                    <p className="text-sm mt-2">{formatDate(selectedCertificate?.issued_at)}</p>
                  </div>
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                      {t('certificatesPage.hours', 'Carga horária')}
                    </p>
                    <p className="text-sm mt-2">{t('certificatesPage.hoursLabel', { hours: hoursValue })}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed">{validationMessage}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyCertificates;
