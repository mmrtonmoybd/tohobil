import { useEffect, useState } from 'react';
import { Button, Stack, TextInput } from '@mantine/core';
import { adminFetch, adminUpload } from '../lib/api';
import { t } from '../lib/copy';

const fields = ['app_name', 'support_email', 'support_phone', 'support_whatsapp', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'sms_driver', 'sms_sender', 'timezone', 'default_storage_quota_mb', 'max_file_size_mb', 'data_retention_days'] as const;

export function SettingsPage() {
  const [config, setConfig] = useState<Record<string, string>>({ timezone: 'Asia/Dhaka' });
  const [smtpPass, setSmtpPass] = useState('');
  const [rateKey, setRateKey] = useState('');
  const [rateKeySet, setRateKeySet] = useState(false);
  const [firebase, setFirebase] = useState('Not checked');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    adminFetch<{ config: Record<string, string>; firebase_configured: boolean; firebase: { project_id?: string } | null }>('settings')
      .then((res) => {
        setConfig(res.config || {});
        setRateKeySet(Boolean(res.config?.exchange_rate_api_key_set));
        setFirebase(res.firebase_configured ? `Configured for ${res.firebase?.project_id || 'project'}` : 'Not configured');
      })
      .catch((error: Error) => setNotice(error.message));
  }, []);

  function save() {
    adminFetch('settings', { method: 'POST', body: JSON.stringify({ ...config, smtp_pass: smtpPass, ...(rateKey ? { exchange_rate_api_key: rateKey } : {}) }) })
      .then(() => {
        setNotice(t('save'));
        if (rateKey) {
          setRateKeySet(true);
          setRateKey('');
        }
      })
      .catch((error: Error) => setNotice(error.message));
  }

  async function upload(file: File) {
    const body = new FormData();
    body.append('service_account', file);
    const res = await adminUpload<{ project_id: string }>('settings/firebase', body);
    setFirebase(`Configured for ${res.project_id}`);
  }

  return (
    <Stack maw={640}>
      <h1 style={{ fontSize: 22, margin: 0 }}>{t('settingsTitle')}</h1>
      <div className="surface-card" style={{ padding: 16 }}>
        {fields.map((field) => (
          <TextInput key={field} mt="xs" label={field} value={config[field] || ''} onChange={(event) => setConfig({ ...config, [field]: event.currentTarget.value })} />
        ))}
        <TextInput mt="xs" label="smtp_pass" type="password" value={smtpPass} onChange={(event) => setSmtpPass(event.currentTarget.value)} placeholder="Leave blank to keep the saved password" />
        <TextInput mt="xs" label="Exchange rate API key" type="password" autoComplete="off" value={rateKey} onChange={(event) => setRateKey(event.currentTarget.value)} placeholder={rateKeySet ? 'Saved. Leave blank to keep the current key' : 'ExchangeRate-API key'} />
        <Button mt="md" onClick={save}>{t('save')}</Button>
        {notice && <div>{notice}</div>}
      </div>
      <div className="surface-card" style={{ padding: 16 }}>
        <strong>Firebase</strong>
        <div>{firebase}</div>
        <input aria-label="Firebase service account" type="file" accept="application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) upload(file).catch((error: Error) => setNotice(error.message)); }} />
      </div>
    </Stack>
  );
}
