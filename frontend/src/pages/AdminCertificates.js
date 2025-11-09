
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Rnd } from 'react-rnd';
import {
  Award,
  BadgeCheck,
  CheckCircle,
  Copy,
  Image as ImageIcon,
  Move,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import AdminNavigation from '@/components/AdminNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const bindingOptions = [
  { value: 'student_name', label: 'Nome do estudante', helper: 'Preenchido automaticamente com o nome do aluno' },
  { value: 'course_title', label: 'Nome do curso', helper: 'Traz o título oficial do curso' },
  { value: 'completion_date', label: 'Data de conclusão', helper: 'Data em que o aluno concluiu todas as aulas' },
  { value: 'issued_date', label: 'Data de emissão', helper: 'Data em que o certificado foi emitido' },
  { value: 'validation_code', label: 'Token de validação', helper: 'Código único para validação pública' },
  { value: 'hours', label: 'Carga horária', helper: 'Carga horária configurada para o certificado' },
  { value: 'instructor_name', label: 'Nome do mentor', helper: 'Nome do instrutor/instituição' },
  { value: 'custom', label: 'Texto personalizado', helper: 'Defina um texto fixo, como um subtítulo ou assinatura' }
];

const fontFamilies = [
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'DM Sans', label: 'DM Sans' }
];

const fontWeightOptions = [
  { value: '300', label: 'Leve' },
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Média' },
  { value: '600', label: 'Semi-bold' },
  { value: '700', label: 'Negrito' },
  { value: '800', label: 'Extra bold' },
  { value: '900', label: 'Black' }
];

const fontStyleOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Itálico' }
];

const textAlignOptions = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centralizado' },
  { value: 'right', label: 'Direita' }
];

const defaultTemplate = {
  name: '',
  course_id: '',
  description: '',
  background_url: '',
  badge_url: '',
  accent_color: '#10b981',
  workload_hours: 20,
  validation_message: 'Certificamos que este documento é válido e pode ser confirmado através do token informado.',
  signature_images: [],
  status: 'draft'
};

const generateId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const clampNumber = (value, min, max, fallback = min) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const anchorDots = [
  { top: 0, left: 0 },
  { top: 0, right: 0 },
  { bottom: 0, left: 0 },
  { bottom: 0, right: 0 }
];

const anchorDotBaseStyle = {
  width: 12,
  height: 12,
  borderRadius: '999px',
  backgroundColor: '#22d3ee',
  border: '2px solid rgba(15, 23, 42, 0.9)',
  boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.6)',
  position: 'absolute',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)'
};

const createResizeHandleStyle = () => ({
  width: 12,
  height: 12,
  borderRadius: '999px',
  backgroundColor: '#38bdf8',
  border: '2px solid rgba(2, 6, 23, 0.9)',
  boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.6)',
  pointerEvents: 'all',
  opacity: 0.95,
  transform: 'translate(-50%, -50%)'
});

const cornerResizeHandleStyles = {
  topRight: createResizeHandleStyle(),
  bottomRight: createResizeHandleStyle(),
  bottomLeft: createResizeHandleStyle(),
  topLeft: createResizeHandleStyle()
};

const cornerResizeConfig = {
  top: false,
  right: false,
  bottom: false,
  left: false,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true
};

const buildElement = (overrides = {}) => ({
  id: overrides.id || generateId(),
  label: overrides.label || 'Novo elemento',
  binding: overrides.binding || 'custom',
  content: overrides.content || '',
  font_family: overrides.font_family || 'Poppins',
  font_weight: overrides.font_weight || '600',
  font_style: overrides.font_style || 'normal',
  font_size: overrides.font_size || 30,
  color: overrides.color || '#0f172a',
  align: overrides.align || 'center',
  uppercase: Boolean(overrides.uppercase),
  letter_spacing: overrides.letter_spacing ?? 0.5,
  width: clampNumber(overrides.width ?? 60, 10, 100, overrides.width ?? 60),
  x: clampNumber(overrides.x ?? 20, 0, 100, overrides.x ?? 20),
  y: clampNumber(overrides.y ?? 40, 0, 100, overrides.y ?? 40),
  z_index: overrides.z_index ?? 2
});

const createPresetElements = ({
  nameFontFamily = 'Playfair Display',
  nameColor = '#f8fafc',
  courseColor = '#e0e7ff',
  infoColor = '#cbd5f5',
  validationColor = '#94a3b8',
  titleText = 'Certificado de Conclusão',
  subtitleText = 'Certificamos que o estudante',
  highlightText = 'concluiu com excelência o curso e está habilitado a comprovar sua jornada.',
  footerText = 'Documento emitido digitalmente pela Hiperautomação Academy.',
  nameY = 35,
  courseY = 52,
  infoY = 64,
  validationY = 76,
  letterSpacing = 0.4,
  uppercaseName = true,
  width = 82
} = {}) => [
  {
    label: 'Título principal',
    binding: 'custom',
    content: titleText,
    font_size: 36,
    font_family: 'Playfair Display',
    font_weight: '700',
    font_style: 'normal',
    color: '#f8fafc',
    width: 90,
    x: 5,
    y: 12,
    align: 'center',
    uppercase: true,
    letter_spacing: 0.8
  },
  {
    label: 'Subtítulo',
    binding: 'custom',
    content: subtitleText,
    font_size: 18,
    font_family: 'DM Sans',
    font_weight: '500',
    font_style: 'italic',
    color: '#cbd5f5',
    width: 80,
    x: 10,
    y: 23,
    align: 'center',
    letter_spacing: 0.1
  },
  {
    label: 'Resumo',
    binding: 'custom',
    content: highlightText,
    font_size: 14,
    font_family: 'DM Sans',
    font_weight: '400',
    font_style: 'normal',
    color: '#94a3b8',
    width: 85,
    x: 8,
    y: 44,
    align: 'center',
    letter_spacing: 0.08
  },
  {
    label: 'Nome do aluno',
    binding: 'student_name',
    font_size: 44,
    font_family: nameFontFamily,
    font_weight: '700',
    font_style: 'normal',
    color: nameColor,
    width,
    x: 10,
    y: nameY,
    align: 'center',
    uppercase: uppercaseName,
    letter_spacing: letterSpacing
  },
  {
    label: 'Curso',
    binding: 'course_title',
    font_size: 26,
    font_family: 'Poppins',
    font_weight: '600',
    font_style: 'normal',
    color: courseColor,
    width: 78,
    x: 10,
    y: courseY,
    align: 'center',
    letter_spacing: 0.2
  },
  {
    label: 'Conclusão',
    binding: 'completion_date',
    font_size: 16,
    font_family: 'DM Sans',
    font_weight: '500',
    font_style: 'normal',
    color: infoColor,
    width: 75,
    x: 12,
    y: infoY,
    align: 'center',
    letter_spacing: 0.15
  },
  {
    label: 'Token de validação',
    binding: 'validation_code',
    font_size: 14,
    font_family: 'DM Sans',
    font_weight: '500',
    font_style: 'normal',
    color: validationColor,
    width: 72,
    x: 12,
    y: validationY,
    align: 'center',
    letter_spacing: 0.25
  },
  {
    label: 'Rodapé',
    binding: 'custom',
    content: footerText,
    font_size: 12,
    font_family: 'DM Sans',
    font_weight: '400',
    font_style: 'normal',
    color: '#94a3b8',
    width: 90,
    x: 5,
    y: 88,
    align: 'center',
    letter_spacing: 0.2
  }
];

const defaultElements = createPresetElements().map((element) => buildElement(element));

const PRECONFIGURED_TEMPLATES = [
  {
    id: 'preset-aurora',
    name: 'Aurora Minimalista',
    description: 'Linhas geométricas, tipografia serifada e tons frios para um toque futurista.',
    preview_course_title: 'Design de Experiências Digitais',
    accent_color: '#4f46e5',
    background_url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 16,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#f8fafc',
      courseColor: '#c7d2fe',
      infoColor: '#e0f2fe',
      validationColor: '#bae6fd',
      nameFontFamily: 'Playfair Display',
      letterSpacing: 0.6
    })
  },
  {
    id: 'preset-classico',
    name: 'Clássico Colonial',
    description: 'Serifa elegante, bordas douradas e paleta crepuscular para formaturas formais.',
    preview_course_title: 'Gestão Histórica',
    accent_color: '#b45309',
    background_url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 24,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#fde68a',
      courseColor: '#fcd34d',
      infoColor: '#fbbf24',
      validationColor: '#f97316',
      nameFontFamily: 'Cormorant Garamond',
      letterSpacing: 0.5
    })
  },
  {
    id: 'preset-futuro',
    name: 'Futuro Tech',
    description: 'Grades, neon e contraste alto para programas de tecnologia e dados.',
    preview_course_title: 'Inteligência Artificial Aplicada',
    accent_color: '#14b8a6',
    background_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 18,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#ecfeff',
      courseColor: '#99f6e4',
      infoColor: '#5eead4',
      validationColor: '#22d3ee',
      nameFontFamily: 'Montserrat',
      letterSpacing: 0.7
    })
  },
  {
    id: 'preset-elegancia',
    name: 'Elegância Corporativa',
    description: 'Paleta sóbria com foco em assinaturas e símbolos institucionais.',
    preview_course_title: 'Liderança e Estratégia',
    accent_color: '#d97706',
    background_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 20,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#fff7ed',
      courseColor: '#fdba74',
      infoColor: '#fd7e14',
      validationColor: '#fb923c',
      nameFontFamily: 'Playfair Display',
      letterSpacing: 0.55
    })
  },
  {
    id: 'preset-vibrante',
    name: 'Vibrante Acadêmico',
    description: 'Layout editorial e energia criativa com texturas leves e tipografia marcante.',
    preview_course_title: 'Comunicação Transformadora',
    accent_color: '#be123c',
    background_url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 22,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#fce7f3',
      courseColor: '#fecdd3',
      infoColor: '#fde047',
      validationColor: '#fb7185',
      nameFontFamily: 'Poppins',
      letterSpacing: 0.55
    })
  },
  {
    id: 'preset-premium',
    name: 'Premium Contrast',
    description: 'Pretos profundos com azuis luminosos para programas executivos e de alto impacto.',
    preview_course_title: 'Marketing e Branding',
    accent_color: '#0ea5e9',
    background_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 20,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#e0f2fe',
      courseColor: '#bae6fd',
      infoColor: '#7dd3fc',
      validationColor: '#22d3ee',
      nameFontFamily: 'DM Sans',
      letterSpacing: 0.35
    })
  },
  {
    id: 'preset-digital',
    name: 'Academia Digital',
    description: 'Campos organizados e cores suaves para cursos de automação e dados em escala.',
    preview_course_title: 'Automação de Negócios',
    accent_color: '#a855f7',
    background_url: 'https://images.unsplash.com/photo-1498075702571-ecb018f3752b?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 18,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#f3e8ff',
      courseColor: '#c4b5fd',
      infoColor: '#d8b4fe',
      validationColor: '#c084fc',
      nameFontFamily: 'Montserrat',
      letterSpacing: 0.45
    })
  },
  {
    id: 'preset-signature',
    name: 'Signature Spark',
    description: 'Textos dramáticos com foco em assinaturas oficiais e selo do mentor.',
    preview_course_title: 'Mentoria Premium',
    accent_color: '#f97316',
    background_url: 'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 12,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#fef3c7',
      courseColor: '#fde68a',
      infoColor: '#fcd34d',
      validationColor: '#f97316',
      nameFontFamily: 'Playfair Display',
      letterSpacing: 0.7
    })
  },
  {
    id: 'preset-metamorfose',
    name: 'Metamorfose',
    description: 'Padrões fluidos e transparências para certificações criativas e artísticas.',
    preview_course_title: 'Narrativas Visuais',
    accent_color: '#22d3ee',
    background_url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 19,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#e0f2fe',
      courseColor: '#bae6fd',
      infoColor: '#a5f3fc',
      validationColor: '#38bdf8',
      nameFontFamily: 'DM Sans',
      letterSpacing: 0.4
    })
  },
  {
    id: 'preset-urbano',
    name: 'Impacto Urbano',
    description: 'Textos compactos, caixas geométricas e toque industrial para inovação urbana.',
    preview_course_title: 'Inovação Urbana',
    accent_color: '#15803d',
    background_url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
    workload_hours: 21,
    validation_message: 'Certificado validado via token público com chancela oficial.',
    text_elements: createPresetElements({
      nameColor: '#f0fdf4',
      courseColor: '#bbf7d0',
      infoColor: '#86efac',
      validationColor: '#4ade80',
      nameFontFamily: 'Montserrat',
      letterSpacing: 0.3,
      uppercaseName: false
    })
  }
];

const AdminCertificates = ({ user, onLogout }) => {
  const [templates, setTemplates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [form, setForm] = useState(defaultTemplate);
  const [textElements, setTextElements] = useState(defaultElements);
  const [issued, setIssued] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeElementId, setActiveElementId] = useState(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ email: '', user_id: '', completed_at: '', notes: '' });
  const [assetUploading, setAssetUploading] = useState(false);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1120, height: 630 });
  const [centerGuides, setCenterGuides] = useState({ horizontal: false, vertical: false });
  const updateCenterGuides = useCallback(
    (element) => {
      if (!element) return;
      const widthPercent = element.width ?? 60;
      const xCenter = (element.x ?? 0) + widthPercent / 2;
      const heightApprox = Math.min(25, Math.max(12, (element.font_size ?? 30) / 2.5));
      const yCenter = (element.y ?? 0) + heightApprox / 2;
      const threshold = 0.85;
      setCenterGuides({
        vertical: Math.abs(xCenter - 50) <= threshold,
        horizontal: Math.abs(yCenter - 50) <= threshold
      });
    },
    []
  );
  const [editingElementId, setEditingElementId] = useState(null);

  const token = useMemo(() => localStorage.getItem('token'), []);
  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  useEffect(() => {
    fetchTemplates();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setIssued([]);
      return;
    }
    fetchIssued(selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    setActiveElementId(null);
    setEditingElementId(null);
  }, [selectedTemplateId, selectedPresetId]);

  useEffect(() => {
    if (!activeElementId) {
      setCenterGuides({ horizontal: false, vertical: false });
    }
  }, [activeElementId]);

  useEffect(() => {
    if (!canvasRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        setCanvasSize({
          width: width || 1120,
          height: height || 630
        });
      });
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeElementId) return;
    const handleKeyDown = (event) => {
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
        return;
      }
      const targetTag = event.target?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(targetTag)) {
        return;
      }
      event.preventDefault();
      setTextElements((prev) =>
        prev.map((element) => {
          if (element.id !== activeElementId) return element;
          const step = event.shiftKey ? 0.5 : 1;
          const delta = {
            x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
            y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0
          };
          const updated = {
            ...element,
            x: clampNumber((element.x ?? 0) + delta.x, 0, 100, element.x ?? 0),
            y: clampNumber((element.y ?? 0) + delta.y, 0, 100, element.y ?? 0)
          };
          updateCenterGuides(updated);
          return updated;
        })
      );
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeElementId, updateCenterGuides]);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await axios.get(`${API}/admin/certificates/templates`, { headers: authHeaders });
      setTemplates(res.data || []);
      if (res.data?.length && !selectedTemplateId) {
        applyTemplate(res.data[0]);
      }
      if (!res.data?.length) {
        resetToNewTemplate();
      }
    } catch (err) {
      console.error('Erro ao carregar modelos de certificado', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${API}/admin/courses`, { headers: authHeaders });
      setCourses(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar cursos', err);
    }
  };

  const fetchIssued = async (templateId) => {
    try {
      const res = await axios.get(`${API}/admin/certificates/issues`, {
        headers: authHeaders,
        params: { template_id: templateId }
      });
      setIssued(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar certificados emitidos', err);
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl) {
      resetToNewTemplate();
      return;
    }
    setSelectedPresetId(null);
    setSelectedTemplateId(tpl.id);
    setForm({
      name: tpl.name || '',
      course_id: tpl.course_id || '',
      description: tpl.description || '',
      background_url: tpl.background_url || '',
      badge_url: tpl.badge_url || '',
      accent_color: tpl.accent_color || '#10b981',
      workload_hours: tpl.workload_hours ?? 20,
      validation_message: tpl.validation_message || defaultTemplate.validation_message,
      signature_images: tpl.signature_images || [],
      status: tpl.status || 'draft'
    });
    const mappedElements = (tpl.text_elements && tpl.text_elements.length ? tpl.text_elements : defaultElements).map(
      (element) => buildElement(element)
    );
    setTextElements(mappedElements);
    setCenterGuides({ horizontal: false, vertical: false });
  };

  const applyPreset = (preset) => {
    if (!preset) {
      resetToNewTemplate();
      return;
    }
    setSelectedTemplateId(null);
    setSelectedPresetId(preset.id);
    setForm({
      ...defaultTemplate,
      name: preset.name || '',
      course_id: preset.course_id || '',
      description: preset.description || '',
      background_url: preset.background_url || '',
      badge_url: preset.badge_url || '',
      accent_color: preset.accent_color || defaultTemplate.accent_color,
      workload_hours: preset.workload_hours ?? defaultTemplate.workload_hours,
      validation_message: preset.validation_message || defaultTemplate.validation_message,
      signature_images: preset.signature_images || [],
      status: 'draft'
    });
    const mappedElements = (preset.text_elements && preset.text_elements.length ? preset.text_elements : defaultElements).map(
      (element) => buildElement(element)
    );
    setTextElements(mappedElements);
    setCenterGuides({ horizontal: false, vertical: false });
  };

  const resetToNewTemplate = () => {
    setSelectedTemplateId(null);
    setSelectedPresetId(null);
    setForm(defaultTemplate);
    setTextElements(defaultElements.map((el) => buildElement(el)));
    setCenterGuides({ horizontal: false, vertical: false });
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleElementChange = (id, field, value) => {
    setTextElements((prev) =>
      prev.map((element) => {
        if (element.id !== id) return element;
        let updated = element;
        if (field === 'x' || field === 'y') {
          updated = { ...element, [field]: clampNumber(value, 0, 100, element[field] ?? 0) };
        } else if (field === 'width') {
          updated = { ...element, [field]: clampNumber(value, 10, 100, element.width ?? 60) };
        } else if (field === 'letter_spacing') {
          updated = { ...element, letter_spacing: clampNumber(value, -2, 5, element.letter_spacing ?? 0) };
        } else if (field === 'uppercase') {
          updated = { ...element, uppercase: Boolean(value) };
        } else {
          updated = { ...element, [field]: value };
        }
        if (['x', 'y', 'width'].includes(field)) {
          updateCenterGuides(updated);
        }
        return updated;
      })
    );
  };

  const handleElementSelect = useCallback(
    (id) => {
      setActiveElementId(id);
      const element = textElements.find((entry) => entry.id === id);
      if (element) {
        updateCenterGuides(element);
      }
    },
    [textElements, updateCenterGuides]
  );

  const handleElementDoubleClick = useCallback(
    (id) => {
      setEditingElementId((prev) => (prev === id ? null : id));
      setActiveElementId(id);
      const element = textElements.find((entry) => entry.id === id);
      if (element) {
        updateCenterGuides(element);
      }
    },
    [textElements, updateCenterGuides]
  );

  const handleElementDrag = (id, x, y) => {
    if (!canvasSize.width || !canvasSize.height) return;
    const element = textElements.find((entry) => entry.id === id);
    if (!element) return;
    const xPercent = Math.round(((x / canvasSize.width) * 100 + Number.EPSILON) * 100) / 100;
    const yPercent = Math.round(((y / canvasSize.height) * 100 + Number.EPSILON) * 100) / 100;
    const updatedElement = {
      ...element,
      x: clampNumber(xPercent, 0, 100, element.x),
      y: clampNumber(yPercent, 0, 100, element.y)
    };
    setTextElements((prev) =>
      prev.map((entry) => (entry.id === id ? updatedElement : entry))
    );
    updateCenterGuides(updatedElement);
  };

  const handleElementResize = (id, widthPx, positionX, positionY) => {
    if (!canvasSize.width || !canvasSize.height) return;
    const element = textElements.find((entry) => entry.id === id);
    if (!element) return;
    const widthPercent = clampNumber((widthPx / canvasSize.width) * 100, 10, 100, 60);
    const xPercent = clampNumber((positionX / canvasSize.width) * 100, 0, 100, 0);
    const yPercent = clampNumber((positionY / canvasSize.height) * 100, 0, 100, 0);
    const oldWidth = element.width || 60;
    const widthRatio = oldWidth ? widthPercent / oldWidth : 1;
    const updatedElement = {
      ...element,
      width: widthPercent,
      x: xPercent,
      y: yPercent,
      font_size: clampNumber(Math.round((element.font_size || 30) * widthRatio), 10, 200, element.font_size || 30)
    };
    setTextElements((prev) =>
      prev.map((entry) => (entry.id === id ? updatedElement : entry))
    );
    updateCenterGuides(updatedElement);
  };

  const editingElement = useMemo(
    () => textElements.find((entry) => entry.id === editingElementId),
    [editingElementId, textElements]
  );

  const inspectorPosition = useMemo(() => {
    if (!editingElement || !canvasSize.width || !canvasSize.height) return null;
    const inspectorWidth = 280;
    const inspectorHeight = 220;
    const leftRet = ((editingElement.x ?? 0) / 100) * canvasSize.width - 10;
    const topRet = ((editingElement.y ?? 0) / 100) * canvasSize.height - 130;
    const left = Math.min(Math.max(10, leftRet), canvasSize.width - inspectorWidth - 10);
    const top = Math.min(Math.max(10, topRet), canvasSize.height - inspectorHeight - 10);
    return { left, top };
  }, [editingElement, canvasSize]);

  const closeEditors = useCallback(() => {
    setEditingElementId(null);
    setActiveElementId(null);
    setCenterGuides({ horizontal: false, vertical: false });
  }, []);

  const addElement = () => {
    const newElement = buildElement({
      label: 'Novo texto',
      binding: 'custom',
      y: 82,
      x: 10,
      width: 80
    });
    setTextElements((prev) => [...prev, newElement]);
    setActiveElementId(newElement.id);
  };

  const removeElement = (id) => {
    setTextElements((prev) => prev.filter((element) => element.id !== id));
    if (activeElementId === id) {
      setActiveElementId(null);
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('Copiado para a área de transferência!');
    } catch (err) {
      alert(value);
    }
  };

  const uploadAsset = async (type) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          setAssetUploading(true);
          const formData = new FormData();
          formData.append('file', file);
          const res = await axios.post(`${API}/admin/certificates/uploads?type=${type}`, formData, {
            headers: {
              ...authHeaders,
              'Content-Type': 'multipart/form-data'
            }
          });
          if (type === 'background') {
            handleFormChange('background_url', res.data.url);
          } else if (type === 'badge') {
            handleFormChange('badge_url', res.data.url);
          } else if (type === 'signature') {
            handleFormChange('signature_images', [...(form.signature_images || []), res.data.url]);
          }
        } catch (err) {
          alert(err?.response?.data?.detail || 'Falha ao enviar arquivo');
        } finally {
          setAssetUploading(false);
        }
      };
      input.click();
    } catch (err) {
      console.error(err);
    }
  };

  const saveTemplate = async () => {
    if (!form.course_id) {
      alert('Selecione um curso antes de salvar');
      return;
    }
    if (!form.name.trim()) {
      alert('Defina um nome para o certificado');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        workload_hours: Number(form.workload_hours) || undefined,
        text_elements: textElements
      };
      let response;
      if (selectedTemplateId) {
        response = await axios.put(`${API}/admin/certificates/templates/${selectedTemplateId}`, payload, {
          headers: authHeaders
        });
      } else {
        response = await axios.post(`${API}/admin/certificates/templates`, payload, { headers: authHeaders });
      }
      await fetchTemplates();
      applyTemplate(response.data);
      alert('Modelo salvo com sucesso!');
    } catch (err) {
      alert(err?.response?.data?.detail || 'Falha ao salvar o modelo');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId) {
      resetToNewTemplate();
      return;
    }
    if (!window.confirm('Deseja realmente excluir este modelo?')) return;
    try {
      await axios.delete(`${API}/admin/certificates/templates/${selectedTemplateId}`, { headers: authHeaders });
      alert('Modelo removido');
      setSelectedTemplateId(null);
      await fetchTemplates();
      resetToNewTemplate();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Não foi possível deletar este modelo');
    }
  };

  const issueCertificate = async (event) => {
    event?.preventDefault();
    if (!selectedTemplateId) return;
    if (!issueForm.email && !issueForm.user_id) {
      alert('Informe o email ou o ID do usuário');
      return;
    }
    try {
      const payload = {
        email: issueForm.email || undefined,
        user_id: issueForm.user_id || undefined,
        completed_at: issueForm.completed_at ? new Date(issueForm.completed_at).toISOString() : undefined,
        metadata: issueForm.notes ? { notes: issueForm.notes } : undefined
      };
      await axios.post(`${API}/admin/certificates/templates/${selectedTemplateId}/issue`, payload, {
        headers: authHeaders
      });
      alert('Certificado emitido com sucesso!');
      setIssueModalOpen(false);
      setIssueForm({ email: '', user_id: '', completed_at: '', notes: '' });
      fetchIssued(selectedTemplateId);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Falha ao emitir certificado');
    }
  };

  const previewText = (element) => {
    const dynamicSample = {
      student_name: 'Ana Clara Ventura',
      course_title: 'Formação em Hiperautomação',
      completion_date: '10 de Novembro de 2025',
      issued_date: '10/11/2025',
      validation_code: 'HC-9F28-ABCD',
      hours: `${form.workload_hours || 20} horas`,
      instructor_name: user?.name || 'Equipe Hiperautomação'
    };
    if (element.binding === 'custom') {
      return element.content || element.label;
    }
    return dynamicSample[element.binding] || element.label;
  };

  const getCourseName = useCallback(
    (courseId) => courses.find((course) => course.id === courseId)?.title || 'Curso não encontrado',
    [courses]
  );

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <AdminNavigation user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <section className="bg-[#090d17] border border-white/5 rounded-3xl p-6 flex flex-col gap-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="uppercase text-sm tracking-[0.35em] text-emerald-300/70 flex items-center gap-2">
                <Sparkles size={16} /> Experiência premium
              </p>
              <h1 className="text-3xl md:text-4xl font-bold mt-2">Laboratório de Certificados</h1>
              <p className="text-gray-400">
                Monte certificados personalizados, arraste elementos e ofereça comprovantes elegantes dignos das melhores
                plataformas de educação.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-white/20" onClick={resetToNewTemplate}>
                <RefreshCw size={16} className="mr-2" />
                Novo Modelo
              </Button>
              <Button onClick={saveTemplate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
                {saving ? 'Salvando...' : 'Salvar modelo'}
              </Button>
              <Button variant="outline" onClick={() => setIssueModalOpen(true)} disabled={!selectedTemplateId}>
                <Award size={16} className="mr-2" />
                Emitir manualmente
              </Button>
              <Button variant="destructive" onClick={deleteTemplate}>
                <Trash2 size={16} className="mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BadgeCheck size={18} className="text-emerald-400" />
                  Modelos
                </h2>
                {loadingTemplates && <span className="text-xs text-gray-400">Atualizando...</span>}
              </div>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {templates.length === 0 && (
                  <div className="text-sm text-gray-500 bg-white/5 border border-white/5 rounded-xl p-4">
                    Nenhum certificado criado ainda. Clique em "Novo modelo" para começar.
                  </div>
                )}
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                      tpl.id === selectedTemplateId
                        ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                        : 'border-white/5 bg-white/5 text-gray-300 hover:border-emerald-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{tpl.name || 'Sem nome'}</p>
                      <Badge variant="outline" className={tpl.status === 'published' ? 'text-emerald-300' : 'text-yellow-200'}>
                        {tpl.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{getCourseName(tpl.course_id)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-400" />
                  Modelos pré-configurados
                </h2>
                <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Ponto de partida</span>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {PRECONFIGURED_TEMPLATES.map((preset) => {
                  const isActive = preset.id === selectedPresetId;
                  return (
                    <div
                      key={preset.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        isActive
                          ? 'border-emerald-400/60 bg-emerald-400/10'
                          : 'border-white/5 bg-white/5 text-gray-300'
                      }`}
                    >
                      <div
                        className="relative h-24 rounded-xl overflow-hidden mb-3"
                        style={{
                          backgroundColor: preset.accent_color,
                          backgroundImage: preset.background_url ? `url(${preset.background_url})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <p className="absolute bottom-2 left-3 text-[11px] uppercase tracking-[0.3em] text-white/90">
                          {preset.preview_course_title}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold">{preset.name}</p>
                        <p className="text-xs text-gray-400">{preset.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] uppercase tracking-[0.3em] text-gray-400">
                          Carga {preset.workload_hours}h
                        </span>
                        <Button
                          variant="outline"
                          className={`text-xs px-3 py-1 ${
                            isActive ? 'border-emerald-300 bg-emerald-400/20 text-white' : 'border-white/20 text-gray-200'
                          }`}
                          onClick={() => applyPreset(preset)}
                        >
                          {isActive ? 'Aplicado' : 'Carregar modelo'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wand2 size={18} className="text-cyan-400" />
                Configurações do modelo
              </h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="certificate-name">Nome do certificado</Label>
                  <Input
                    id="certificate-name"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Certificado oficial de conclusão"
                  />
                </div>
                <div>
                  <Label>Curso</Label>
                  <Select value={form.course_id} onValueChange={(value) => handleFormChange('course_id', value)}>
                    <SelectTrigger className="bg-black/30 border-white/10">
                      <SelectValue placeholder="Selecione um curso" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#080b14] border-white/5">
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Mensagem que aparece junto ao certificado"
                    className="bg-black/20 border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Accent color</Label>
                    <Input
                      type="color"
                      value={form.accent_color}
                      onChange={(e) => handleFormChange('accent_color', e.target.value)}
                      className="h-11 cursor-pointer"
                    />
                  </div>
                  <div>
                    <Label>Carga horária</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.workload_hours}
                      onChange={(e) => handleFormChange('workload_hours', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Publicar</Label>
                    <Switch
                      checked={form.status === 'published'}
                      onCheckedChange={(checked) => handleFormChange('status', checked ? 'published' : 'draft')}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Apenas modelos publicados liberam certificados automáticos ao concluir o curso.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/20"
                    onClick={() => uploadAsset('background')}
                    disabled={assetUploading}
                  >
                    <ImageIcon size={16} className="mr-2" />
                    {assetUploading ? 'Enviando...' : 'Fundo'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/20"
                    onClick={() => uploadAsset('badge')}
                    disabled={assetUploading}
                  >
                    <UploadCloud size={16} className="mr-2" />
                    Badge
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/20"
                    onClick={() => uploadAsset('signature')}
                    disabled={assetUploading}
                  >
                    <UploadCloud size={16} className="mr-2" />
                    Assinatura
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Move size={18} className="text-sky-300" />
                  Elementos de texto
                </h2>
                <Button size="sm" variant="outline" className="border-white/20" onClick={addElement}>
                  <Plus size={14} className="mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {textElements.map((element) => (
                  <div key={element.id} className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{element.label || 'Elemento sem título'}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeElement(element.id)}
                        className="text-red-300 hover:text-red-200"
                        aria-label="Remover elemento"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Rótulo</Label>
                        <Input value={element.label} onChange={(e) => handleElementChange(element.id, 'label', e.target.value)} />
                      </div>
                      <div>
                        <Label>Ligação</Label>
                        <Select
                          value={element.binding}
                          onValueChange={(value) => handleElementChange(element.id, 'binding', value)}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#080b14] border-white/5 max-h-64">
                            {bindingOptions.map((binding) => (
                              <SelectItem key={binding.value} value={binding.value}>
                                {binding.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {element.binding === 'custom' && (
                      <div>
                        <Label>Conteúdo</Label>
                        <Input
                          value={element.content}
                          onChange={(e) => handleElementChange(element.id, 'content', e.target.value)}
                          placeholder="Texto fixo"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Tamanho (px)</Label>
                        <Input
                          type="number"
                          min="10"
                          value={element.font_size}
                          onChange={(e) => handleElementChange(element.id, 'font_size', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Cor</Label>
                        <Input
                          type="color"
                          value={element.color}
                          onChange={(e) => handleElementChange(element.id, 'color', e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Família</Label>
                        <Select
                          value={element.font_family}
                          onValueChange={(value) => handleElementChange(element.id, 'font_family', value)}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#080b14] border-white/5">
                            {fontFamilies.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Largura (%)</Label>
                        <Input
                          type="number"
                          min="10"
                          max="100"
                          value={element.width}
                          onChange={(e) => handleElementChange(element.id, 'width', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Peso da fonte</Label>
                        <Select
                          value={element.font_weight}
                          onValueChange={(value) => handleElementChange(element.id, 'font_weight', value)}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#080b14] border-white/5">
                            {fontWeightOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Estilo</Label>
                        <Select
                          value={element.font_style}
                          onValueChange={(value) => handleElementChange(element.id, 'font_style', value)}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#080b14] border-white/5">
                            {fontStyleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Alinhamento</Label>
                        <Select
                          value={element.align}
                          onValueChange={(value) => handleElementChange(element.id, 'align', value)}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#080b14] border-white/5">
                            {textAlignOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div>
                        <Label>Espaçamento (em)</Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="-1"
                            max="3"
                            step="0.05"
                            value={element.letter_spacing ?? 0}
                            onChange={(e) => handleElementChange(element.id, 'letter_spacing', Number(e.target.value))}
                            className="h-2 w-full accent-emerald-400"
                          />
                          <span className="text-xs text-gray-400 w-12 text-right">
                            {(element.letter_spacing ?? 0).toFixed(2)}em
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="mb-1">Maiúsculas</Label>
                        <Switch
                          checked={Boolean(element.uppercase)}
                          onCheckedChange={(checked) => handleElementChange(element.id, 'uppercase', checked)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Posição X (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={element.x}
                          onChange={(e) => handleElementChange(element.id, 'x', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Posição Y (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={element.y}
                          onChange={(e) => handleElementChange(element.id, 'y', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UploadCloud size={18} className="text-purple-300" />
                Assinaturas
              </h2>
              {(!form.signature_images || form.signature_images.length === 0) && (
                <p className="text-sm text-gray-500">Adicione assinaturas ou selos de quem valida os certificados.</p>
              )}
              <div className="space-y-2">
                {(form.signature_images || []).map((url, index) => (
                  <div key={`${url}-${index}`} className="flex items-center gap-3 bg-white/5 rounded-xl p-2">
                    <img src={url} alt="Assinatura" className="h-10 object-contain rounded-md bg-white/5" />
                    <Input
                      value={url}
                      onChange={(e) => {
                        const clone = [...(form.signature_images || [])];
                        clone[index] = e.target.value;
                        handleFormChange('signature_images', clone);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const clone = [...(form.signature_images || [])];
                        clone.splice(index, 1);
                        handleFormChange('signature_images', clone);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full border-dashed border-white/30"
                onClick={() => handleFormChange('signature_images', [...(form.signature_images || []), ''])}
              >
                <Plus size={14} className="mr-2" />
                Inserir URL manualmente
              </Button>
            </div>

            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-5 space-y-3">
              <Label>Mensagem de validação</Label>
              <Textarea
                rows={4}
                className="bg-black/20 border-white/10"
                value={form.validation_message}
                onChange={(e) => handleFormChange('validation_message', e.target.value)}
                placeholder="Mensagem exibida na página pública de validação"
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#080d18] border border-white/5 rounded-3xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/70">Preview ao vivo</p>
                  <h3 className="text-xl font-semibold">Arraste os textos direto no certificado</h3>
                  <p className="text-gray-400 text-sm">
                    Cada elemento pode ser reposicionado com drag and drop. As mudanças são salvas no próximo "Salvar modelo".
                  </p>
                </div>
              </div>

              <div className="w-full max-w-4xl mx-auto">
                <div className="relative w-full aspect-[16/9]" onMouseDown={closeEditors}>
                  <div
                    ref={canvasRef}
                    className="absolute inset-0 rounded-3xl overflow-hidden border-4 shadow-2xl"
                    style={{
                      borderColor: form.accent_color,
                      backgroundImage: form.background_url
                        ? `url(${form.background_url})`
                        : 'linear-gradient(135deg, #0f172a 0%, #020617 40%, #0f172a 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/10 pointer-events-none" />
                    <div className="absolute inset-0 flex flex-col justify-between p-10 z-10 pointer-events-none">
                      <div className="flex justify-between items-center">
                        {form.badge_url ? (
                          <img src={form.badge_url} alt="Badge" className="h-16 object-contain drop-shadow" />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                            <Award className="text-emerald-400" />
                          </div>
                        )}
                      </div>
                      {(form.signature_images || []).length > 0 && (
                        <div className="flex justify-center gap-16 mt-8">
                          {form.signature_images
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((url, index) => (
                              <div key={`${url}-${index}`} className="text-center">
                                <img src={url} alt="Assinatura" className="h-16 object-contain mx-auto mb-2" />
                                <div className="h-px w-40 bg-gray-400 mx-auto" />
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 z-30 pointer-events-none">
                      {centerGuides.vertical && (
                        <div
                          className="absolute inset-y-0 w-px bg-emerald-400/70"
                          style={{ left: '50%', transform: 'translateX(-50%)' }}
                        />
                      )}
                      {centerGuides.horizontal && (
                        <div
                          className="absolute inset-x-0 h-px bg-emerald-400/70"
                          style={{ top: '50%', transform: 'translateY(-50%)' }}
                        />
                      )}
                    </div>
                    <div className="absolute inset-0 z-20">
                      <div className="relative h-full w-full">
                        {textElements.map((element) => {
                          const position = {
                            x: (element.x / 100) * canvasSize.width,
                            y: (element.y / 100) * canvasSize.height
                          };
                          const width = ((element.width || 60) / 100) * canvasSize.width;
                          const isActiveElement = activeElementId === element.id;
                          return (
                            <Rnd
                              key={element.id}
                              bounds="parent"
                              size={{ width, height: 'auto' }}
                              position={position}
                              enableResizing={isActiveElement ? cornerResizeConfig : false}
                              resizeHandleStyles={cornerResizeHandleStyles}
                              onDragStart={() => handleElementSelect(element.id)}
                              onResizeStart={() => handleElementSelect(element.id)}
                              onDragStop={(e, data) => handleElementDrag(element.id, data.x, data.y)}
                              onResizeStop={(e, _direction, ref, _delta, position) =>
                                handleElementResize(element.id, ref.offsetWidth, position?.x ?? 0, position?.y ?? 0)
                              }
                              style={{
                                zIndex: isActiveElement ? 100 : element.z_index || 2
                              }}
                              className="text-element"
                            >
                              <div
                                className={`cursor-move px-3 py-1 relative ${isActiveElement ? 'shadow-[0_0_0_3px_rgba(16,185,129,0.6)]' : ''}`}
                                style={{
                                  color: element.color,
                                  fontSize: `${element.font_size}px`,
                                  fontFamily: element.font_family,
                                  fontWeight: element.font_weight,
                                  fontStyle: element.font_style || 'normal',
                                  textTransform: element.uppercase ? 'uppercase' : 'none',
                                  textAlign: element.align,
                                  letterSpacing: `${element.letter_spacing || 0}em`,
                                  border: isActiveElement
                                    ? '1px dashed rgba(16,185,129,0.9)'
                                    : '1px dashed rgba(255,255,255,0.2)',
                                  borderRadius: 10,
                                  backgroundColor: isActiveElement ? 'rgba(16,185,129,0.08)' : 'transparent',
                                  textShadow: '0 4px 25px rgba(15,23,42,0.85)'
                                }}
                                onMouseDown={(event) => {
                                  event.stopPropagation();
                                  handleElementSelect(element.id);
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  handleElementDoubleClick(element.id);
                                }}
                              >
                                {isActiveElement &&
                                  anchorDots.map((offset, index) => (
                                    <span
                                      key={`${element.id}-anchor-${index}`}
                                      style={{ ...anchorDotBaseStyle, ...offset }}
                                    />
                                  ))}
                                {previewText(element)}
                              </div>
                            </Rnd>
                          );
                        })}
                      </div>
                    </div>
                    {editingElement && inspectorPosition && (
                      <div
                        className="absolute z-40 pointer-events-auto rounded-2xl border border-white/20 bg-[#05070d]/90 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.7)] text-xs text-white max-w-[280px]"
                        style={{
                          left: inspectorPosition.left,
                          top: inspectorPosition.top
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-300 mb-2">
                          Editar elemento
                        </p>
                        <div className="space-y-2 text-sm">
                          {editingElement.binding === 'custom' && (
                            <div>
                              <Label className="text-[11px] uppercase tracking-[0.3em]">Conteúdo</Label>
                              <Textarea
                                rows={2}
                                className="bg-black/40 border-white/10 text-white text-xs"
                                value={editingElement.content}
                                onChange={(e) =>
                                  handleElementChange(editingElement.id, 'content', e.target.value)
                                }
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] uppercase tracking-[0.3em]">Tamanho</Label>
                              <Input
                                type="number"
                                min="8"
                                value={editingElement.font_size}
                                onChange={(e) =>
                                  handleElementChange(editingElement.id, 'font_size', Number(e.target.value))
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] uppercase tracking-[0.3em]">Cor</Label>
                              <Input
                                type="color"
                                value={editingElement.color}
                                onChange={(e) =>
                                  handleElementChange(editingElement.id, 'color', e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Select
                              value={editingElement.font_weight}
                              onValueChange={(value) => handleElementChange(editingElement.id, 'font_weight', value)}
                            >
                              <SelectTrigger className="bg-black/30 border-white/10 text-[11px]">
                                <SelectValue placeholder="Peso" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#080b14] border-white/10 text-xs">
                                {fontWeightOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={editingElement.font_style}
                              onValueChange={(value) => handleElementChange(editingElement.id, 'font_style', value)}
                            >
                              <SelectTrigger className="bg-black/30 border-white/10 text-[11px]">
                                <SelectValue placeholder="Estilo" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#080b14] border-white/10 text-xs">
                                {fontStyleOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={editingElement.align}
                              onValueChange={(value) => handleElementChange(editingElement.id, 'align', value)}
                            >
                              <SelectTrigger className="bg-black/30 border-white/10 text-[11px]">
                                <SelectValue placeholder="Alinhar" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#080b14] border-white/10 text-xs">
                                {textAlignOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] uppercase tracking-[0.3em] mb-0">Maiúsculas</Label>
                            <Switch
                              checked={Boolean(editingElement.uppercase)}
                              onCheckedChange={(checked) =>
                                handleElementChange(editingElement.id, 'uppercase', checked)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] uppercase tracking-[0.3em]">Espaçamento</Label>
                            <input
                              type="range"
                              min="-1"
                              max="3"
                              step="0.05"
                              value={editingElement.letter_spacing ?? 0}
                              onChange={(e) =>
                                handleElementChange(editingElement.id, 'letter_spacing', Number(e.target.value))
                              }
                              className="h-2 w-full accent-emerald-400"
                            />
                            <p className="text-[10px] text-gray-400 text-right">
                              {(editingElement.letter_spacing ?? 0).toFixed(2)}em
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-center text-xs text-gray-500 mt-4">
                  Dica: clique em "Emitir manualmente" para testar a visualização com um email interno.
                </p>
              </div>
            </div>

            <div className="bg-[#080d18] border border-white/5 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Certificados emitidos</h3>
                <span className="text-sm text-gray-400">{issued.length} registros</span>
              </div>

              {issued.length === 0 && (
                <div className="border border-dashed border-white/15 rounded-2xl p-6 text-center text-gray-400">
                  Ainda não existem certificados emitidos com este modelo.
                </div>
              )}

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2">
                {issued.map((cert) => (
                  <div key={cert.id} className="border border-white/10 rounded-2xl p-4 bg-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{cert.student_name}</p>
                        <p className="text-xs text-gray-400">{cert.student_email}</p>
                      </div>
                      <Badge variant="outline" className="text-emerald-300 flex items-center gap-1">
                        <CheckCircle size={14} />
                        Válido
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-300">
                      Emissão: {new Date(cert.issued_at).toLocaleDateString('pt-BR')} &bull; Token: {cert.token}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20"
                        onClick={() => copyToClipboard(cert.token)}
                      >
                        <Copy size={14} className="mr-1" />
                        Copiar token
                      </Button>
                      {cert.validation_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20"
                          onClick={() => window.open(cert.validation_url, '_blank')}
                        >
                          Validar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={issueModalOpen} onOpenChange={setIssueModalOpen}>
        <DialogContent className="bg-[#060912] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir certificado manualmente</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={issueCertificate}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={issueForm.email}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>ID do usuário</Label>
                <Input
                  value={issueForm.user_id}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, user_id: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Data de conclusão</Label>
              <Input
                type="date"
                value={issueForm.completed_at}
                onChange={(e) => setIssueForm((prev) => ({ ...prev, completed_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                rows={3}
                className="bg-black/30 border-white/10"
                value={issueForm.notes}
                onChange={(e) => setIssueForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Informações adicionais enviadas como metadata"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIssueModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">
                Emitir agora
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCertificates;
