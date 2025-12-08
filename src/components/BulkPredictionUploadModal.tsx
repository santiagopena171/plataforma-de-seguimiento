'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface BulkPredictionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  pencaSlug: string;
  dayId: string;
  races: Array<{ id: string; seq: number; race_number?: number | null }>;
  memberships: Array<{ id: string; user_id: string; users?: { full_name: string }; guest_name?: string }>;
  onSuccess: () => void;
}

interface ExtractedPrediction {
  memberName: string;
  predictions: Record<number, number>; // race seq -> prediction
}

export default function BulkPredictionUploadModal({
  isOpen,
  onClose,
  pencaSlug,
  dayId,
  races,
  memberships,
  onSuccess,
}: BulkPredictionUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedPrediction[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData([]);
    }
  };

  const handleProcessExcel = async () => {
    if (!selectedFile) return;

    setProcessing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        alert('El archivo debe tener al menos una fila de encabezados y una de datos');
        return;
      }

      // Primera fila son los encabezados
      const headers = jsonData[0];
      const predictions: ExtractedPrediction[] = [];

      // Procesar cada fila de datos (saltando la primera que es encabezado)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const memberName = String(row[0] || '').trim();
        if (!memberName) continue;

        const predictionValues: Record<number, number> = {};

        // Procesar cada columna (saltando la primera que es el nombre)
        for (let j = 1; j < row.length && j < headers.length; j++) {
          const header = String(headers[j] || '').trim().toUpperCase();
          const value = row[j];

          // Extraer número de carrera del header (P1 -> 1, P2 -> 2, etc.)
          const raceSeqMatch = header.match(/P?(\d+)/);
          if (!raceSeqMatch) continue;

          const raceSeq = parseInt(raceSeqMatch[1]);
          const prediction = parseInt(String(value || '').replace(/[^\d]/g, ''));

          if (!isNaN(prediction) && prediction > 0 && prediction <= 15) {
            // Verificar que exista una carrera con ese seq
            if (races.find(r => r.seq === raceSeq)) {
              predictionValues[raceSeq] = prediction;
            }
          }
        }

        if (Object.keys(predictionValues).length > 0) {
          predictions.push({ memberName, predictions: predictionValues });
        }
      }

      if (predictions.length === 0) {
        alert('No se encontraron predicciones válidas en el archivo');
        return;
      }

      setExtractedData(predictions);
    } catch (err) {
      console.error('Error processing Excel:', err);
      alert('Error al procesar el archivo Excel');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (extractedData.length === 0) return;

    setUploading(true);

    try {
      const bulkData = extractedData.flatMap((item) => {
        return Object.entries(item.predictions).map(([raceSeqStr, prediction]) => {
          const raceSeq = parseInt(raceSeqStr);
          const race = races.find(r => r.seq === raceSeq);
          
          // Buscar membership por nombre (solo invitados con guest_name)
          const membership = memberships.find(m => {
            // Solo matchear con memberships que tienen guest_name
            if (!m.guest_name) return false;
            
            const guestName = m.guest_name.toLowerCase().trim();
            const searchName = item.memberName.toLowerCase().trim();
            
            const match = guestName.includes(searchName) || searchName.includes(guestName);
            
            console.log(`Matching "${item.memberName}" vs "${m.guest_name}":`, match);
            
            return match;
          });

          return {
            memberName: item.memberName,
            memberId: membership?.id,
            raceId: race?.id,
            raceSeq,
            prediction,
          };
        });
      });

      const res = await fetch(`/api/admin/pencas/${pencaSlug}/bulk-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: bulkData, dayId }),
      });

      if (!res.ok) throw new Error('Failed to upload predictions');

      const result = await res.json();
      
      if (result.results.failed > 0) {
        alert(`Subidas: ${result.results.success}\nFallidas: ${result.results.failed}\n\nErrores:\n${result.results.errors.slice(0, 5).join('\n')}`);
      } else {
        alert(`✓ ${result.results.success} predicciones cargadas exitosamente`);
      }
      
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error al cargar las predicciones');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setExtractedData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Cargar Predicciones desde Excel</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Formato del archivo Excel:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Primera fila:</strong> Encabezados → "Nombre", "P1", "P2", "P3", ... "P{races.length}"</li>
              <li><strong>Siguientes filas:</strong> Nombre del jugador en columna A, predicciones (números 1-15) en columnas siguientes</li>
              <li><strong>Ejemplo:</strong></li>
            </ul>
            <pre className="mt-2 bg-white p-2 rounded text-xs border">
Nombre    P1    P2    P3
Juan      3     7     2
María     1     4     8
            </pre>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Process Button */}
          {selectedFile && !extractedData.length && (
            <button
              onClick={handleProcessExcel}
              disabled={processing}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 mb-6"
            >
              {processing ? 'Procesando...' : 'Procesar Archivo Excel'}
            </button>
          )}

          {/* Extracted Data Preview */}
          {extractedData.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Datos Extraídos ({extractedData.length} jugadores):</h3>
              <div className="border rounded overflow-auto max-h-64">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      {races.map(r => (
                        <th key={r.id} className="px-3 py-2 text-center">P{r.seq}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.map((item, idx) => {
                      const membership = memberships.find(m => {
                        const fullName = m.users?.full_name || m.guest_name || '';
                        return fullName.toLowerCase().includes(item.memberName.toLowerCase()) ||
                               item.memberName.toLowerCase().includes(fullName.toLowerCase());
                      });
                      
                      return (
                        <tr key={idx} className={`border-t ${!membership ? 'bg-yellow-50' : ''}`}>
                          <td className="px-3 py-2">
                            {item.memberName}
                            {!membership && <span className="text-xs text-yellow-700 ml-2">(⚠️ no encontrado)</span>}
                          </td>
                          {races.map(r => (
                            <td key={r.id} className="px-3 py-2 text-center">
                              {item.predictions[r.seq] || '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {extractedData.length > 0 && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {uploading ? 'Subiendo...' : 'Confirmar y Subir Predicciones'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
