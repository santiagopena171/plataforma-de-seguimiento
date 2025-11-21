'use client';

import { useState } from 'react';
import html2canvas from 'html2canvas';
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

            // Create temporary div for rendering
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.padding = '40px';
            tempDiv.style.backgroundColor = 'white';
            tempDiv.style.fontFamily = 'Arial, sans-serif';

            // Build HTML table
            let html = `
                <div style="margin-bottom: 20px;">
                    <h1 style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0;">${data.pencaName}</h1>
                    <h2 style="font-size: 18px; color: #6b7280; margin-top: 8px;">Resumen de Predicciones</h2>
                </div>
                <table style="border-collapse: collapse; font-size: 14px; width: auto;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: left; font-weight: 600;">Participante</th>
            `;

            // Add race headers
            data.races.forEach((race: any) => {
                html += `<th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; font-weight: 600;">${race.name}</th>`;
            });

            html += `
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Add participant rows
            data.participants.forEach((participant: any, index: number) => {
                html += `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                        <td style="border: 1px solid #d1d5db; padding: 12px 16px; font-weight: 500;">${participant.name}</td>
                `;

                data.races.forEach((race: any) => {
                    const prediction = participant.predictions[race.id] || '-';
                    html += `<td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center;">${prediction}</td>`;
                });

                html += `</tr>`;
            });

            html += `
                    </tbody>
                </table>
            `;

            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv);

            // Convert to canvas
            const canvas = await html2canvas(tempDiv, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            // Remove temp div
            document.body.removeChild(tempDiv);

            // Convert to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Predicciones_${data.pencaName.replace(/\\s+/g, '_')}.jpg`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Imagen descargada con éxito');
                }
            }, 'image/jpeg', 0.95);

        } catch (error) {
            console.error('Error downloading image:', error);
            toast.error('Error al descargar la imagen');
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
