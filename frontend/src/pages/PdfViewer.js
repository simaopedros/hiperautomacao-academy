import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileText } from 'lucide-react';

export default function PdfViewer() {
  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState('Documento PDF');
  const objectUrlRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      // Ensure same-origin messages
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      try {
        if (data.type === 'pdf-blob' && data.blob instanceof Blob) {
          // Clean previous
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          const url = URL.createObjectURL(data.blob);
          objectUrlRef.current = url;
          setSrc(url);
          if (data.title) setTitle(data.title);
        } else if (data.type === 'pdf-url' && typeof data.url === 'string') {
          setSrc(data.url);
          if (data.title) setTitle(data.title);
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1c] via-[#111827] to-[#1e293b]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center gap-2 text-white">
          <FileText className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold truncate max-w-[60vw]">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/20 bg-black/40 text-white hover:bg-black/60"
            onClick={() => window.close()}
          >
            <X className="mr-2 h-4 w-4" /> Fechar
          </Button>
        </div>
      </header>
      <main className="p-4">
        {src ? (
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40">
            <iframe title="PDF" src={src} className="w-full h-[calc(100vh-120px)]" />
          </div>
        ) : (
          <div className="glass-panel p-8 text-center max-w-xl mx-auto">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 mx-auto">
              <FileText className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Aguardando documento...</h2>
            <p className="text-gray-400">Abra a partir da página da aula para visualizar aqui.</p>
          </div>
        )}
      </main>
    </div>
  );
}