'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface LiveStream {
  id: string;
  penca_id: string;
  title: string;
  description: string | null;
  youtube_video_id: string | null;
  youtube_channel_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export default function LiveStreamsManager({ pencaId }: { pencaId: string }) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtube_url: '',
    is_active: true,
    display_order: 0,
  });

  // Función para extraer IDs de URLs de YouTube
  const parseYouTubeUrl = (url: string): { videoId: string | null; channelId: string | null } => {
    try {
      // Limpiar espacios
      url = url.trim();
      
      // Patrón para video: youtube.com/watch?v=VIDEO_ID o youtu.be/VIDEO_ID
      const videoPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      ];
      
      for (const pattern of videoPatterns) {
        const match = url.match(pattern);
        if (match) {
          return { videoId: match[1], channelId: null };
        }
      }
      
      // Patrón para canal en vivo: youtube.com/channel/CHANNEL_ID/live
      const channelPattern = /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;
      const channelMatch = url.match(channelPattern);
      if (channelMatch) {
        return { videoId: null, channelId: channelMatch[1] };
      }
      
      // Si es solo un ID (11 caracteres alfanuméricos), asumir que es video ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return { videoId: url, channelId: null };
      }
      
      return { videoId: null, channelId: null };
    } catch (err) {
      return { videoId: null, channelId: null };
    }
  };

  useEffect(() => {
    loadStreams();
  }, [pencaId]);

  const loadStreams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('penca_id', pencaId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setStreams(data || []);
    } catch (err: any) {
      console.error('Error loading streams:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      youtube_url: '',
      is_active: true,
      display_order: streams.length,
    });
    setEditingStream(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (stream: LiveStream) => {
    // Reconstruir la URL desde el video_id o channel_id
    let url = '';
    if (stream.youtube_video_id) {
      url = `https://www.youtube.com/watch?v=${stream.youtube_video_id}`;
    } else if (stream.youtube_channel_id) {
      url = `https://www.youtube.com/channel/${stream.youtube_channel_id}/live`;
    }
    
    setFormData({
      title: stream.title,
      description: stream.description || '',
      youtube_url: url,
      is_active: stream.is_active,
      display_order: stream.display_order,
    });
    setEditingStream(stream);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!formData.youtube_url.trim()) {
      setError('Debes proporcionar una URL de YouTube');
      return;
    }

    // Extraer IDs de la URL
    const { videoId, channelId } = parseYouTubeUrl(formData.youtube_url);
    
    if (!videoId && !channelId) {
      setError('URL de YouTube inválida. Verifica que sea una URL válida de YouTube.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const streamData = {
        penca_id: pencaId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        youtube_video_id: videoId,
        youtube_channel_id: channelId,
        is_active: formData.is_active,
        display_order: formData.display_order,
      };

      if (editingStream) {
        // Update existing stream
        const { error } = await supabase
          .from('live_streams')
          .update(streamData)
          .eq('id', editingStream.id);

        if (error) throw error;
      } else {
        // Create new stream
        const { error } = await supabase
          .from('live_streams')
          .insert([streamData]);

        if (error) throw error;
      }

      await loadStreams();
      resetForm();
      router.refresh();
    } catch (err: any) {
      console.error('Error saving stream:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (streamId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta transmisión?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('live_streams')
        .delete()
        .eq('id', streamId);

      if (error) throw error;

      await loadStreams();
      router.refresh();
    } catch (err: any) {
      console.error('Error deleting stream:', err);
      setError(err.message);
    }
  };

  const toggleActive = async (stream: LiveStream) => {
    try {
      const { error } = await supabase
        .from('live_streams')
        .update({ is_active: !stream.is_active })
        .eq('id', stream.id);

      if (error) throw error;

      await loadStreams();
      router.refresh();
    } catch (err: any) {
      console.error('Error toggling stream:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando transmisiones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Transmisiones en Vivo
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancelar' : '+ Nueva Transmisión'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingStream ? 'Editar Transmisión' : 'Nueva Transmisión'}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ej: Carreras del Día - Maroñas"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de YouTube *
            </label>
            <input
              type="text"
              value={formData.youtube_url}
              onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Pega cualquier URL de YouTube (video o canal en vivo)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Orden
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                min="0"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingStream ? 'Actualizar' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {streams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay transmisiones configuradas. Haz clic en "Nueva Transmisión" para agregar una.
          </div>
        ) : (
          streams.map((stream) => (
            <div
              key={stream.id}
              className={`bg-white border rounded-lg p-4 ${
                stream.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{stream.title}</h3>
                    {stream.is_active && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        Activo
                      </span>
                    )}
                  </div>
                  {stream.description && (
                    <p className="text-sm text-gray-600 mb-2">{stream.description}</p>
                  )}
                  <div className="text-xs text-gray-500 space-y-1">
                    {stream.youtube_video_id && (
                      <div>
                        🎥 <a 
                          href={`https://www.youtube.com/watch?v=${stream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          youtube.com/watch?v={stream.youtube_video_id}
                        </a>
                      </div>
                    )}
                    {stream.youtube_channel_id && (
                      <div>
                        📺 <a 
                          href={`https://www.youtube.com/channel/${stream.youtube_channel_id}/live`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          youtube.com/channel/{stream.youtube_channel_id}/live
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => toggleActive(stream)}
                    className={`px-3 py-1 text-sm rounded ${
                      stream.is_active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {stream.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleEdit(stream)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(stream.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          💡 Cómo agregar una transmisión
        </h4>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Ve a YouTube y encuentra el video o transmisión en vivo que quieres mostrar</li>
          <li>Copia la URL completa de la barra de direcciones (Ej: https://www.youtube.com/watch?v=dQw4w9WgXcQ)</li>
          <li>Pégala en el campo "URL de YouTube" arriba</li>
          <li>¡Listo! El sistema detecta automáticamente si es un video o un canal en vivo</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-blue-300">
          <p className="text-xs text-blue-700">
            <strong>URLs soportadas:</strong> youtube.com/watch?v=..., youtu.be/..., youtube.com/channel/.../live
          </p>
        </div>
      </div>
    </div>
  );
}
