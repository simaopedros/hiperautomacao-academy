import React, { useEffect, useRef, useState } from 'react';
import { DotLottie } from '@lottiefiles/dotlottie-web';

/**
 * DotLottieCanvas
 * Wrapper React para DotLottie (canvas). Aceita .lottie ou .json locais.
 * Exemplo:
 * <DotLottieCanvas src="/lottie/success.json" autoplay loop className="w-28 h-28" />
 */
export default function DotLottieCanvas({ src, autoplay = true, loop = true, className = '', style }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);
    let instance = null;
    let mounted = true;
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    try {
      instance = new DotLottie({
        autoplay,
        loop,
        canvas,
        src,
      });
    } catch (e) {
      if (mounted) setError(true);
    }

    return () => {
      mounted = false;
      try {
        if (instance && typeof instance.destroy === 'function') {
          instance.destroy();
        }
      } catch (e) {
        // ignore
      }
    };
  }, [src, autoplay, loop]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}