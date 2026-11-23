import { expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { renderPersonStatementHtml } from './statement';
import type { Person, DebtView } from '../db/types';

it('embeds a local Bengali font and escapes statement content', () => {
  const person = { id: 'p', name: 'মন্ত্রী <script>', phone: null } as Person;
  const debt = { direction: 'receivable', outstanding: 12500 } as DebtView;
  const t = ((key: string) => key) as TFunction;
  const html = renderPersonStatementHtml(
    person,
    [debt],
    [],
    'BDT',
    'bn',
    t,
    'data:font/woff2;base64,AAAA',
  );
  expect(html).toContain('মন্ত্রী &lt;script&gt;');
  expect(html).toContain('data:font/woff2;base64,AAAA');
  expect(html).toContain('৳১২৫.০০');
  expect(html).not.toContain('<script>');
});
