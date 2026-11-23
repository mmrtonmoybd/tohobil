import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { adminFetch, adminUpload } from '../lib/api';
import { t } from '../lib/copy';

interface Campaign {
  id: number;
  category: string;
  title_en: string;
  title_bn: string | null;
  status: string;
  target: string;
  targeted: number;
  opened: number;
  open_rate: number;
  scheduled_at: string | null;
}

interface PushIndex {
  data: Campaign[];
  templates: Array<{ id: number; name: string; title_en: string; body_en: string; title_bn: string | null; body_bn: string | null; category: string }>;
  automations: Array<{ id: number; name: string; rule: string; enabled: number; cap_per_week: number }>;
}

const helper = createColumnHelper<Campaign>();

export function PushPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['push'], queryFn: () => adminFetch<PushIndex>('push') });
  const [form, setForm] = useState({
    category: 'announcement',
    title_en: '',
    body_en: '',
    title_bn: '',
    body_bn: '',
    target: 'user',
    user_id: '',
    scheduled_at: '',
    current_password: '',
    image_url: '',
    logo_mode: 'app',
    action_type: 'open_app',
    previewLang: 'en',
  });
  const [estimate, setEstimate] = useState('');
  const [notice, setNotice] = useState('');

  const columns = useMemo(() => [
    helper.accessor('id', { header: 'ID' }),
    helper.accessor('title_en', { header: 'Title' }),
    helper.accessor('status', { header: 'Status' }),
    helper.accessor('target', { header: 'Target' }),
    helper.accessor('targeted', { header: 'Targeted' }),
    helper.accessor('opened', { header: 'Opened' }),
    helper.accessor('open_rate', { header: 'Open rate', cell: (info) => `${Math.round(info.getValue() * 1000) / 10}%` }),
  ], []);
  const table = useReactTable({ data: query.data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() });

  function payload(when: string) {
    return {
      ...form,
      when,
      user_id: Number(form.user_id) || 0,
    };
  }

  const save = useMutation({
    mutationFn: (when: string) => adminFetch('push', { method: 'POST', body: JSON.stringify(payload(when)) }),
    onSuccess: () => {
      setNotice(t('save'));
      queryClient.invalidateQueries({ queryKey: ['push'] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  async function previewAudience() {
    try {
      const res = await adminFetch<{ estimate: { mode: string; devices: number; users: number } }>('push/estimate', {
        method: 'POST',
        body: JSON.stringify(payload('draft')),
      });
      setEstimate(`${res.estimate.mode}: ${res.estimate.devices} devices, ${res.estimate.users} users`);
    } catch (error) {
      setEstimate(error instanceof Error ? error.message : 'Estimate failed');
    }
  }

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    const res = await adminUpload<{ url: string }>('push/image', body);
    setForm((current) => ({ ...current, image_url: res.url }));
  }

  const title = form.previewLang === 'bn' && form.title_bn ? form.title_bn : form.title_en;
  const body = form.previewLang === 'bn' && form.body_bn ? form.body_bn : form.body_en;

  return (
    <Stack gap="md">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pushTitle')}</h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 13 }}>{t('pushHelp')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.8fr)', gap: 16 }}>
        <div className="surface-card" style={{ padding: 16 }}>
          <Stack gap="sm">
            <Select label="Category" data={['announcement', 'offer', 'update', 'security']} value={form.category} onChange={(value) => setForm({ ...form, category: value || 'announcement' })} />
            <TextInput label={t('pushEnglishTitle')} value={form.title_en} onChange={(event) => setForm({ ...form, title_en: event.currentTarget.value })} />
            <Textarea label={t('pushEnglishBody')} value={form.body_en} onChange={(event) => setForm({ ...form, body_en: event.currentTarget.value })} />
            <TextInput label={t('pushBengaliTitle')} value={form.title_bn} onChange={(event) => setForm({ ...form, title_bn: event.currentTarget.value })} />
            <Textarea label={t('pushBengaliBody')} value={form.body_bn} onChange={(event) => setForm({ ...form, body_bn: event.currentTarget.value })} />
            <Select label="Target" data={['user', 'selected', 'segment', 'all']} value={form.target} onChange={(value) => setForm({ ...form, target: value || 'user' })} />
            {form.target === 'user' && <TextInput label="User ID" value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.currentTarget.value })} />}
            <TextInput type="datetime-local" label={t('schedule')} value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.currentTarget.value })} />
            <TextInput label={t('reenterPassword')} value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.currentTarget.value })} />
            <input aria-label="Push image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) uploadImage(file).catch((error: Error) => setNotice(error.message)); }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={() => save.mutate('now')}>{t('sendNow')}</Button>
              <Button variant="default" onClick={() => save.mutate('draft')}>{t('saveDraft')}</Button>
              <Button variant="default" onClick={() => save.mutate('schedule')}>{t('schedule')}</Button>
              <Button variant="light" onClick={previewAudience}>{t('audience')}</Button>
            </div>
            {estimate && <div>{estimate}</div>}
            {notice && <div>{notice}</div>}
          </Stack>
        </div>
        <div className="surface-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Android preview</strong>
            <Button size="xs" variant="subtle" onClick={() => setForm({ ...form, previewLang: form.previewLang === 'en' ? 'bn' : 'en' })}>{form.previewLang.toUpperCase()}</Button>
          </div>
          <div style={{ marginTop: 16, borderRadius: 28, border: '8px solid #111827', background: '#0f172a', color: 'white', minHeight: 420, padding: 16 }}>
            <div style={{ marginTop: 48, background: '#1f2937', borderRadius: 16, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Tohobil</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{title || 'Title'}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{body || 'Body'}</div>
              {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
            </div>
          </div>
        </div>
      </div>
      <div className="surface-card">
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}
                <th>Actions</th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                <td>
                  <button className="btn-secondary" type="button" onClick={() => adminFetch(`push/${row.original.id}/duplicate`, { method: 'POST' }).then(() => query.refetch())}>Duplicate</button>
                  {['draft', 'scheduled'].includes(row.original.status) && (
                    <button className="btn-secondary" type="button" onClick={() => adminFetch(`push/${row.original.id}/cancel`, { method: 'POST' }).then(() => query.refetch())}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TemplateForms templates={query.data?.templates ?? []} automations={query.data?.automations ?? []} onSaved={() => query.refetch()} />
    </Stack>
  );
}

function TemplateForms({ templates, automations, onSaved }: { templates: PushIndex['templates']; automations: PushIndex['automations']; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rule, setRule] = useState('inactive_days');
  const [templateId, setTemplateId] = useState('');
  return (
    <div className="surface-card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Templates and automations</h2>
      <Stack gap="xs">
        <TextInput label="Template name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <TextInput label={t('pushEnglishTitle')} value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        <Textarea label={t('pushEnglishBody')} value={body} onChange={(event) => setBody(event.currentTarget.value)} />
        <Button onClick={() => adminFetch('push/templates', { method: 'POST', body: JSON.stringify({ name, title_en: title, body_en: body, category: 'announcement', target: 'all' }) }).then(onSaved)}>Save template</Button>
      </Stack>
      <ul>
        {templates.map((item) => <li key={item.id}>{item.name}: {item.title_en}</li>)}
      </ul>
      <Stack gap="xs">
        <TextInput label="Template ID" value={templateId} onChange={(event) => setTemplateId(event.currentTarget.value)} />
        <Select label="Rule" data={['inactive_days', 'no_records', 'old_version', 'no_sync']} value={rule} onChange={(value) => setRule(value || 'inactive_days')} />
        <Button variant="default" onClick={() => adminFetch('push/automations', { method: 'POST', body: JSON.stringify({ name: `${rule} automation`, template_id: Number(templateId), rule, rule_value: rule === 'old_version' ? '1.0.0' : '7', enabled: 1, cap_per_week: 2 }) }).then(onSaved)}>Save automation</Button>
      </Stack>
      <ul>
        {automations.map((item) => <li key={item.id}>{item.name} ({item.rule}) cap {item.cap_per_week}/week</li>)}
      </ul>
    </div>
  );
}
