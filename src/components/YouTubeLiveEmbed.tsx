'use client';

import { useState, useEffect } from 'react';

interface YouTubeLiveEmbedProps {
  videoId?: string;
  channelId?: string;
  title?: string;
  className?: string;
}

/**
 * Componente para embeder transmisiones en vivo de YouTube
 * Acepta videoId (ID de video específico) o channelId (transmisión en vivo del canal)
 * 
 * Ejemplos de URLs de YouTube:
 * - Video: https://www.youtube.com/watch?v=VIDEO_ID -> usar videoId="VIDEO_ID"
 * - Canal en vivo: https://www.youtube.com/channel/CHANNEL_ID/live -> usar channelId="CHANNEL_ID"
 * - Usuario en vivo: https://www.youtube.com/@username/live -> necesitas el channelId del canal
 */
export default function YouTubeLiveEmbed({
  videoId,
  channelId,
  title = 'Transmisión en vivo',
  className = '',
}: YouTubeLiveEmbedProps) {
  const [embedUrl, setEmbedUrl] = useState<string>('');

  useEffect(() => {
    if (videoId) {
      // Video específico de YouTube
      setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1`);
    } else if (channelId) {
      // Transmisión en vivo del canal
      setEmbedUrl(`https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=0&modestbranding=1`);
    }
  }, [videoId, channelId]);

  if (!embedUrl) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-red-600">🔴</span>
            {title}
          </h3>
        </div>
      )}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={embedUrl}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
