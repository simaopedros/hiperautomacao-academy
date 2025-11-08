import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Search, ArrowLeft, Copy, Award, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CertificateValidation = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialToken) {
      handleValidate();
    }
  }, []);

  const handleValidate = async (event) => {
    event?.preventDefault();
    if (!token.trim()) {
      setError(t('certificateValidation.emptyToken', 'Informe o token para validar.'));
      setResult(null);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API}/certificates/validate`, { params: { token } });
      setResult(response.data);
      setSearchParams({ token });
    } catch (err) {
      setResult(null);
      setError(err?.response?.data?.detail || t('certificateValidation.invalid', 'Certificado não encontrado.'));
    } finally {
      setLoading(false);
    }
  };

  const certificate = result?.certificate;
  const template = certificate?.template || certificate?.template_snapshot;

  const formatDate = (value) => {
    if (!value) return '--';
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleDateString();
    }
  };

  const copyToken = async () => {
    if (!certificate?.token) return;
    try {
      await navigator.clipboard.writeText(certificate.token);
      alert(t('certificatesPage.tokenCopied', 'Token copiado!'));
    } catch {
      alert(certificate.token);
    }
  };

  return (
    <div className="min-h-screen bg-[#02060f] text-white flex flex-col items-center px-4 py-10">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-3">
          <Badge className="bg-emerald-500/10 text-emerald-200 border-emerald-400/40 px-4 py-1 rounded-full">
            <ShieldCheck size={16} className="inline mr-2" />
            {t('certificateValidation.badge', 'Validação de autenticidade')}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold">
            {t('certificateValidation.title', 'Confirme um certificado')}
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t(
              'certificateValidation.subtitle',
              'Digite o token informado no certificado e confirme em segundos se o documento foi emitido oficialmente pela Hiperautomação Academy.'
            )}
          </p>
        </div>

        <form
          onSubmit={handleValidate}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
        >
          <div>
            <Label htmlFor="token">{t('certificateValidation.inputLabel', 'Token de validação')}</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('certificateValidation.tokenPlaceholder', 'Ex: HC-9F28-ABCD')}
              className="bg-black/20 border-white/10 mt-2"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-2xl">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Search className="mr-2" size={16} />}
            {t('certificateValidation.cta', 'Validar token')}
          </Button>
        </form>

        {result && certificate && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">
                  {t('certificateValidation.statusValid', 'Certificado válido')}
                </p>
                <h2 className="text-2xl font-semibold text-white">{certificate.course_title}</h2>
                <p className="text-gray-400">{result.validation_message}</p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-4 py-2 rounded-2xl text-sm">
                <ShieldCheck size={16} className="mr-2" />
                {t('certificatesPage.metadataBadge', 'Documento oficial')}
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {t('certificateValidation.student', 'Estudante')}
                </p>
                <p className="text-lg font-semibold">{certificate.student_name}</p>
                <p className="text-sm text-gray-400">{certificate.student_email}</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {t('certificateValidation.course', 'Curso')}
                </p>
                <p className="text-lg font-semibold">{certificate.course_title}</p>
                <p className="text-sm text-gray-400">
                  {t('certificateValidation.issuedAt', 'Emitido em')} {formatDate(certificate.issued_at)}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {t('certificateValidation.token', 'Token')}
                </p>
                <p className="font-mono text-sm break-all mt-1">{certificate.token}</p>
                <Button variant="ghost" size="sm" className="mt-2 p-0 text-emerald-300" onClick={copyToken}>
                  <Copy size={14} className="mr-1" />
                  {t('certificatesPage.copyToken', 'Copiar token')}
                </Button>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {t('certificateValidation.workload', 'Carga horária')}
                </p>
                <p className="text-lg font-semibold">
                  {t('certificatesPage.hoursLabel', { hours: certificate.workload_hours || template?.workload_hours || 0 })}
                </p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {t('certificateValidation.completion', 'Concluído em')}
                </p>
                <p className="text-lg font-semibold">{formatDate(certificate.completed_at)}</p>
              </div>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
              <Award size={24} className="text-emerald-400" />
              <div>
                <p className="text-sm text-gray-300">
                  {template?.validation_message ||
                    t(
                      'certificateValidation.validationMessage',
                      'Certificado emitido com assinatura digital e verificável publicamente.'
                    )}
                </p>
              </div>
            </div>

            <Button variant="ghost" className="text-gray-300" onClick={() => setResult(null)}>
              <ArrowLeft size={16} className="mr-2" />
              {t('certificateValidation.newSearch', 'Validar outro token')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateValidation;
