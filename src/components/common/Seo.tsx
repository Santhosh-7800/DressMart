import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description?: string;
}

const SITE_NAME = 'DressMart';

export function Seo({ title, description }: SeoProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | ${SITE_NAME}`;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? '';
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (meta && description) meta.setAttribute('content', previousDescription);
    };
  }, [title, description]);

  return null;
}
