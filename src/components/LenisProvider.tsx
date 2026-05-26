/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import Lenis from 'lenis';

interface LenisContextType {
  lenisRef: React.MutableRefObject<Lenis | null>;
}

const LenisContext = createContext<LenisContextType>({ lenisRef: { current: null } });

/**
 * Hook para acessar a instância Lenis.
 * Retorna null se o Lenis ainda não foi inicializado.
 */
export const useLenis = () => {
  const context = useContext(LenisContext);
  return context.lenisRef.current;
};

interface LenisProviderProps {
  children: React.ReactNode;
}

export const LenisProvider: React.FC<LenisProviderProps> = ({ children }) => {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Inicializa Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing padrão de Lenis
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // Função de loop de animação
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisContext.Provider value={{ lenisRef }}>
      {children}
    </LenisContext.Provider>
  );
};