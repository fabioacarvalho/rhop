'use client';

import { useEffect, useState } from 'react';

export function NotificacaoBadge() {
  const [contagem, setContagem] = useState(0);

  useEffect(() => {
    fetch('/api/notificacoes?contagem=true')
      .then(res => res.json())
      .then(data => {
        if (typeof data.contagem === 'number') {
          setContagem(data.contagem);
        }
      })
      .catch(console.error);
  }, []);

  if (contagem === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '2px',
        right: '2px',
        backgroundColor: 'var(--vermelho)',
        color: '#fff',
        border: '2px solid var(--paper-raised)',
        borderRadius: '50%',
        minWidth: '18px',
        height: '18px',
        padding: '0 3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 700,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {contagem > 99 ? '99+' : contagem}
    </div>
  );
}
