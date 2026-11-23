import { useEffect, useState } from 'react';
import { Button, Stack, TextInput } from '@mantine/core';
import { adminFetch } from '../lib/api';
import { t } from '../lib/copy';

interface SmsData {
  driver: string;
  sender: string;
  sent_today: number;
  log: Array<{ id: number; phone: string; purpose: string; masked_body: string; status: string; created_at: string }>;
}

export function SmsPage() {
  const [data, setData] = useState<SmsData | null>(null);
  const [phone, setPhone] = useState('+8801');
  const [notice, setNotice] = useState('');

  function load() {
    adminFetch<SmsData>('sms').then(setData).catch((error: Error) => setNotice(error.message));
  }
  useEffect(() => { load(); }, []);

  return (
    <Stack>
      <h1 style={{ fontSize: 22, margin: 0 }}>{t('smsTitle')}</h1>
      <div className="surface-card" style={{ padding: 16 }}>
        <div>Driver: {data?.driver || 'log'} · Sender: {data?.sender || 'Tohobil'} · Today: {data?.sent_today ?? 0}</div>
        <TextInput label="E.164 phone" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} />
        <Button mt="sm" onClick={() => adminFetch('sms/test', { method: 'POST', body: JSON.stringify({ phone }) }).then(() => { setNotice('Test message stored with a masked code'); load(); }).catch((error: Error) => setNotice(error.message))}>Send test SMS</Button>
        {notice && <div>{notice}</div>}
      </div>
      <div className="surface-card">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Phone</th><th>Purpose</th><th>Body</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.log ?? []).map((row) => (
              <tr key={row.id}><td>{row.created_at}</td><td>{row.phone}</td><td>{row.purpose}</td><td>{row.masked_body}</td><td>{row.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}
