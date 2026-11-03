/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Logos Reais e Oficiais para Delivery (iFood e 99Food)
 * Baseado fielmente nas marcas oficiais enviadas pelo usuário.
 */

import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
  xl: 'w-14 h-14',
};

/**
 * Logo Real do iFood
 * Quadrado vermelho (#EA1D2C) com o logotipo branco característico e a seta curva sorridente.
 */
export const IfoodLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <img
        src="/assets/logos/ifood-logo.svg"
        alt="iFood"
        className={`${sizeClasses[size]} rounded-lg object-contain shadow-2xs shrink-0 select-none`}
        onError={(e) => {
          // Fallback caso a imagem externa demore a resolver
          e.currentTarget.style.display = 'none';
        }}
      />
      {showText && (
        <span className="font-extrabold tracking-tight text-red-600">iFood</span>
      )}
    </div>
  );
};

/**
 * Logo Real do 99Food
 * Quadrado amarelo degradê (#FFD000 a #F5A623) com os números 99 em preto e "Food" embaixo.
 */
export const Food99Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <img
        src="/assets/logos/99food-logo.svg"
        alt="99Food"
        className={`${sizeClasses[size]} rounded-lg object-contain shadow-2xs shrink-0 select-none`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {showText && (
        <span className="font-extrabold tracking-tight text-stone-900">99Food</span>
      )}
    </div>
  );
};

/**
 * Tag / Badge de Canal com Logo Real
 */
export const ChannelBadge: React.FC<{ channel: 'IFOOD' | '99FOOD'; size?: 'sm' | 'md' }> = ({
  channel,
  size = 'sm',
}) => {
  if (channel === 'IFOOD') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-600 text-white font-black text-[11px] shadow-2xs">
        <img
          src="/assets/logos/ifood-logo.svg"
          alt="iFood"
          className="w-3.5 h-3.5 rounded-sm object-contain"
        />
        <span>iFood</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-400 text-stone-950 font-black text-[11px] shadow-2xs">
      <img
        src="/assets/logos/99food-logo.svg"
        alt="99Food"
        className="w-3.5 h-3.5 rounded-sm object-contain"
      />
      <span>99Food</span>
    </span>
  );
};
