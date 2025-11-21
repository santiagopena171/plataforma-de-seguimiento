'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface DownloadPredictionsButtonProps {
    slug: string;
}

export default function DownloadPredictionsButton({ slug }: DownloadPredictionsButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        try {
            setLoading(true);

            // Fetch data
            const response = await fetch(`/api/admin/pencas/${slug}/all-predictions`);
            if (!response.ok) {
                throw new Error('Error al obtener los datos');
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Prepare data for Excel
            // Headers: Participante, Carrera 1, Carrera 2, ...
            const headers = ['Participante', ...data.races.map((r: any) => r.name)];

            // Rows
            const rows = data.participants.map((p: any) => {
                const row: any[] = [p.name];
                data.races.forEach((r: any) => {
                    row.push(p.predictions[r.id] || '-');
                });
                return row;
            });

            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

            // Set column widths
            const wscols = [{ wch: 30 }]; // Participante column width
            data.races.forEach(() => wscols.push({ wch: 25 })); // Race columns width
            ws['!cols'] = wscols;

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Predicciones");

            // Generate Excel file
            XLSX.writeFile(wb, `Predicciones_${data.pencaName.replace(/\s+/g, '_')}.xlsx`);

            toast.success('Archivo descargado con éxito');
        } catch (error) {
            console.error('Error downloading excel:', error);
            toast.error('Error al descargar el archivo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDownload}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
            {loading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                </>
            ) : (
                <>
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Resumen de Predicciones
                </>
            )}
        </button>
    );
}
