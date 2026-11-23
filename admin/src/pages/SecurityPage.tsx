import { useEffect, useState } from 'react';
import { Button, Stack } from '@mantine/core';
import { adminFetch } from '../lib/api';
import { t } from '../lib/copy';

interface SecurityData {
  failed_logins: Array<{ id: number; event: string; ip: string | null; created_at: string }>;
  admin_sessions: Array<{ id: number; name: string; email: string; ip: string | null; last_active_at: string }>;
  blocked_counts: Array<{ event: string; hits: number }>;
}

export function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState('');

  function load() {
    adminFetch<SecurityData>('security').then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, []);

  return (
    <Stack>
      <h1 style={{ fontSize: 22, margin: 0 }}>{t('securityTitle')}</h1>
      {error && <div>{error}</div>}
      <div className="surface-card" style={{ padding: 16 }}>
        <Button variant="default" onClick={() => adminFetch('auth/logout-others', { method: 'POST' }).then(() => setError(t('logoutOthers')))}>{t('logoutOthers')}</Button>
        <h2 style={{ fontSize: 16 }}>Active admin sessions</h2>
        {(data?.admin_sessions ?? []).map((session) => (
          <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
            <span>{session.name} · {session.email} · {session.ip || 'unknown IP'}</span>
            <button className="btn-secondary" type="button" onClick={() => adminFetch(`security/sessions/${session.id}`, { method: 'DELETE' }).then(load)}>Revoke</button>
          </div>
        ))}
      </div>
      <div className="surface-card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 16 }}>Failed sign-ins, last 7 days</h2>
        <ul>
          {(data?.failed_logins ?? []).map((row) => <li key={row.id}>{row.created_at} · {row.event} · {row.ip}</li>)}
        </ul>
        <h2 style={{ fontSize: 16 }}>Blocked request counts</h2>
        <ul>
          {(data?.blocked_counts ?? []).map((row) => <li key={row.event}>{row.event}: {row.hits}</li>)}
        </ul>
      </div>
    </Stack>
  );
}
