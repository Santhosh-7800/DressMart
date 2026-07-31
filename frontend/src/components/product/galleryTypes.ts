export type GalleryItem =
  | { type: 'image'; id: string; url: string; alt: string }
  | { type: 'video'; id: string; url: string }
  | { type: '360'; id: string; frames: string[] };
