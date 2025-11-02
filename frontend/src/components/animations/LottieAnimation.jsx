import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

/**
 * LottieAnimation
 * Uso:
 * - <LottieAnimation src="/lottie/success.json" loop={false} />
 * - <LottieAnimation data={jsonObject} />
 * Caso o JSON não esteja disponível, exibe um fallback simples.
 */
export default function LottieAnimation({ src, data, loop = true, autoplay = true, className = '', style }) {
  const [animationData, setAnimationData] = useState(data || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!src || data) return;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('Falha ao carregar animação');
        const json = await res.json();
        if (isMounted) setAnimationData(json);
      } catch (e) {
        if (isMounted) setError(true);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [src, data]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback se ainda carregando ou se o JSON não tiver estrutura esperada
  if (!animationData || (animationData && !animationData.layers)) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Lottie
      autoplay={autoplay}
      loop={loop}
      rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
      className={className}
      style={style}
      animationData={animationData}
    />
  );
}