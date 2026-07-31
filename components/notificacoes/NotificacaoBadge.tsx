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
    <div style={{
      position: 'absolute',
      top: '-5px',
      right: '-5px',
      backgroundColor: 'red',
      color: 'white',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: 'bold'
    }}>
      {contagem > 99 ? '99+' : contagem}
    </div>
  );
}
