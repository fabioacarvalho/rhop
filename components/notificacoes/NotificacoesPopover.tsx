'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NotificacoesPopover.module.css';

type Notificacao = {
  id: string;
  mensagem: string;
  lida: boolean;
  link: string;
  criado_em: string;
};

export function NotificacoesPopover() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      fetch('/api/notificacoes')
        .then(res => res.json())
        .then(data => {
          if (data.notificacoes) setNotificacoes(data.notificacoes);
        })
        .catch(console.error);
    }
  }, [open]);

  const handleLida = async (id: string, link: string) => {
    // Optimistic update
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    
    // Request API
    try {
      await fetch(`/api/notificacoes/${id}/lida`, { method: 'PATCH' });
    } catch (e) {
      console.error('Falha ao marcar como lida', e);
    }

    setOpen(false);
    router.push(link);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={styles.trigger}
        aria-label="Notificações"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '0',
          width: '300px',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderRadius: '8px',
          zIndex: 50,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
            Suas Notificações
          </div>

          {notificacoes.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
              Nenhuma notificação encontrada.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notificacoes.map(n => (
                <li 
                  key={n.id}
                  onClick={() => handleLida(n.id, n.link)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    backgroundColor: n.lida ? 'white' : '#f0f8ff'
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: n.lida ? 'normal' : 'bold' }}>
                    {n.mensagem}
                  </p>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {new Date(n.criado_em).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
