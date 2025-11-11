-- Enable Realtime on relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE races;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;

-- Storage: Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('pencas-assets', 'pencas-assets', true);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for penca assets
CREATE POLICY "Anyone can view penca assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'pencas-assets');

CREATE POLICY "Penca admins can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pencas-assets'
  AND EXISTS (
    SELECT 1 FROM pencas
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM penca_admins
        WHERE penca_id = pencas.id AND user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Penca admins can update assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pencas-assets'
  AND EXISTS (
    SELECT 1 FROM pencas
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM penca_admins
        WHERE penca_id = pencas.id AND user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'pencas-assets'
  AND EXISTS (
    SELECT 1 FROM pencas
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM penca_admins
        WHERE penca_id = pencas.id AND user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Penca admins can delete assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pencas-assets'
  AND EXISTS (
    SELECT 1 FROM pencas
    WHERE id::text = (storage.foldername(name))[1]
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM penca_admins
        WHERE penca_id = pencas.id AND user_id = auth.uid()
      )
    )
  )
);
