import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, Download, ExternalLink } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CertificateShare = () => {
  const { shareId } = useParams();
  const { t } = useTranslation();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShare = async () => {
      if (!shareId) {
        setError(t('certificateShare.notFound', 'Link expirado ou inválido.'));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await axios.get(`${API}/certificates/share/${shareId}`);
        setShareData(response.data);
        setError('');
      } catch (err) {
        setError(err?.response?.data?.detail || t('certificateShare.notFound', 'Link expirado ou inválido.'));
      } finally {
        setLoading(false);
      }
    };
    fetchShare();
  }, [shareId, t]);

  const validationUrl =
    shareData && typeof window !== 'undefined'
      ? `${window.location.origin}/certificates/validate?token=${shareData.token}`
      : '';

  const formatDate = (value) => {
    if (!value) return '--';
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#02060f] text-white flex items-center justify-center">
        <Loader2 className="animate-spin" size={42} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#02060f] text-white flex items-center justify-center px-4">
        <div className="bg-white/5 border border-red-500/40 text-red-200 rounded-3xl p-10 text-center">
          <ShieldCheck className="mx-auto mb-2 text-red-400" size={32} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const recipientLabel = t('certificateShare.sharedFor', {
    name: shareData.student_name || t('certificateShare.courseLabel', 'Curso')
  });

  return (
    <div className="min-h-screen bg-[#02060f] text-white px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Badge className="bg-emerald-500/10 text-emerald-200 border border-emerald-400/40 px-4 py-1 rounded-full">
            <ShieldCheck size={16} className="inline mr-2" />
            {t('certificatesPage.metadataBadge', 'Documento oficial')}
          </Badge>
          <h1 className="text-3xl font-bold">{t('certificateShare.title', 'Certificado compartilhado')}</h1>
          <p className="text-gray-400">{t('certificateShare.subtitle', 'Baixe o PNG oficial e confira a autenticidade com o link de validação.')}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
          <div className="text-sm uppercase tracking-[0.35em] text-gray-500">{recipientLabel}</div>
          <h2 className="text-2xl font-semibold text-white">{shareData.course_title || t('certificateShare.courseLabel', 'Curso')}</h2>
          <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/40">
            <img src={shareData.image_data} alt="Certificado compartilhado" className="w-full object-cover" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500">{t('certificateShare.tokenLabel', 'Token de validação')}</p>
              <p className="text-sm font-mono mt-2 break-all">{shareData.token}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500">{t('certificateShare.courseLabel', 'Curso')}</p>
              <p className="text-sm mt-2">{shareData.course_title || t('certificateShare.courseLabel', 'Curso')}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500">{t('certificateShare.issuedOn', 'Emitido em')}</p>
              <p className="text-sm mt-2">{formatDate(shareData.issued_at)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-white/20">
              <a
                href={shareData.image_data}
                download={`${shareData.course_title || 'certificado'}-${shareData.token}.png`}
                className="inline-flex items-center"
              >
                <Download size={16} className="mr-2" />
                {t('certificateShare.download', 'Baixar certificado')}
              </a>
            </Button>
            <Button
              variant="outline"
              className="border-white/20"
              onClick={() => window.open(validationUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={16} className="mr-2" />
              {t('certificateShare.validationLink', 'Ir para validação')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateShare;
