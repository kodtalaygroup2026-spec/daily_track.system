'use client';
import PhotoViewer from '@/components/PhotoViewer';
import { NAMES, emptyText, slot } from './ui';

// kind: the photo that was clicked, so the viewer opens on it
export default function Lightbox({ task: t, kind = 'before', onClose }) {
  const photos = ['before', 'after'].map((k) => ({
    key: k,
    label: NAMES[k] + (t[k + 'At'] ? ' · ' + t[k + 'At'] : ''),
    src: slot(t, k) === 'ok' ? t[k] : null,
    alt: `รูป${NAMES[k]} ${t.title}`,
    note: emptyText(t, k),
  }));
  const subtitle = [t.tech || 'ยังไม่มีคนทำ', t.beforeAt && `เริ่ม ${t.beforeAt}`, t.status === 'done' && t.afterAt && `เสร็จ ${t.afterAt}`].filter(Boolean).join(' · ');
  return <PhotoViewer photos={photos} index={kind === 'after' ? 1 : 0} title={t.title} subtitle={subtitle} onClose={onClose} />;
}
