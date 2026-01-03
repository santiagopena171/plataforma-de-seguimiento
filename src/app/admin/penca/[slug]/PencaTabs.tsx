'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DeleteRaceButton from '@/components/DeleteRaceButton';
import AddMemberModal from './AddMemberModal';
import AddRaceDayModal from '@/components/AddRaceDayModal';
import BulkPredictionUploadModal from '@/components/BulkPredictionUploadModal';
import LiveStreamsManager from '@/components/LiveStreamsManager';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// Función para formatear la hora sin conversión de zona horaria
function formatRaceTime(isoString: string): string {
  // Extraer solo la parte HH:MM del ISO string
  const timeMatch = isoString.match(/T(\d{2}):(\d{2})/);
  if (!timeMatch) return isoString;

  const [_, hourStr, minuteStr] = timeMatch;
  const hour = parseInt(hourStr);
  const minute = parseInt(minuteStr);

  // Convertir de 24h a 12h
  let hour12 = hour % 12 || 12;
  const meridiem = hour >= 12 ? 'PM' : 'AM';

  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

interface Member {
  id: string;
  user_id: string | null;
  guest_name?: string | null;
  role: string;
  joined_at: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
}

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: string;
  race_day?: number | null;
  race_day_id?: string | null;
  penca_id?: string;
  race_entries: any[];
  predictions: any[];
}

interface RaceDay {
  id: string;
  penca_id: string;
  day_number: number;
  day_name: string;
  day_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Score {
  id: string;
  penca_id: string;
  race_id: string;
  user_id: string | null;
  membership_id: string | null;
  points_total: number;
  breakdown: any;
  created_at: string;
  updated_at: string;
}

interface Prediction {
  id: string;
  race_id: string;
  user_id: string | null;
  membership_id: string | null;
  winner_pick: string | null;
  exacta_pick: any;
  trifecta_pick: any;
  winner_entry?: {
    id: string;
    program_number: number;
    horse_name: string;
  };
}

interface RaceResult {
  id: string;
  race_id: string;
  official_order: string[]; // Array de entry IDs [1°, 2°, 3°]
  created_at: string;
}

interface PencaTabsProps {
  pencaSlug: string;
  pencaId: string;
  races: Race[];
  raceDays: RaceDay[];
  memberships: Member[];
  numParticipants: number;
  scores: Score[];
  predictions: Prediction[];
  raceResults: RaceResult[];
  invitesCount: number;
}

export default function PencaTabs({ pencaSlug, pencaId, races, raceDays, memberships, numParticipants, scores, predictions, raceResults, invitesCount }: PencaTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'races' | 'members' | 'leaderboard' | 'streams'>('races');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [closingRace, setClosingRace] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
  const [deletingDay, setDeletingDay] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [extractingRaces, setExtractingRaces] = useState<string | null>(null);

  // Filtrar solo miembros no-admin (jugadores reales)
  const actualMembers = memberships?.filter(m => m.role !== 'admin') || [];
  const adminMembers = memberships?.filter(m => m.role === 'admin') || [];

  // Seleccionar automáticamente el primer día cuando se carga la página
  useEffect(() => {
    if (raceDays && raceDays.length > 0 && !selectedDayId) {
      setSelectedDayId(raceDays[0].id);
    }
  }, [raceDays, selectedDayId]);

  const handleAddMember = async (guestName: string) => {
    try {
      const response = await fetch(`/api/admin/pencas/${pencaSlug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al agregar miembro');
      }

      // Recargar la página para mostrar el nuevo miembro
      router.refresh();
    } catch (error: any) {
      throw error;
    }
  };

  const handleClosePredictions = async (raceId: string) => {
    try {
      setClosingRace(raceId);
      const response = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });

      if (!response.ok) {
        throw new Error('Error al cerrar predicciones');
      }

      // Recargar la página para actualizar el estado
      window.location.reload();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al cerrar predicciones');
    } finally {
      setClosingRace(null);
    }
  };

  const handleOpenPredictions = async (raceId: string) => {
    try {
      setClosingRace(raceId);
      const response = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled' }),
      });

      if (!response.ok) {
        throw new Error('Error al abrir predicciones');
      }

      // Recargar la página para actualizar el estado
      window.location.reload();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al abrir predicciones');
    } finally {
      setClosingRace(null);
    }
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este día? Las carreras asignadas no se eliminarán, solo se desasociarán del día.')) {
      return;
    }

    try {
      setDeletingDay(dayId);
      const response = await fetch(`/api/admin/pencas/${pencaSlug}/race-days?dayId=${dayId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el día');
      }

      router.refresh();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al eliminar el día');
    } finally {
      setDeletingDay(null);
    }
  };

  const handleExtractRaces = async (dayId: string) => {
    try {
      setExtractingRaces(dayId);

      // Fetch race results summary data
      const response = await fetch(`/api/admin/pencas/${pencaSlug}/race-days/${dayId}/extract-summary`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Error al obtener el resumen de carreras');
      }

      const data = await response.json();
      console.log('Data received:', data);

      // Construir el mapa de jugadores procesando las carreras
      const playersMap = new Map<string, { name: string; racePoints: number[]; total: number }>();

      // Recorrer cada carrera y procesar sus scores
      if (data.races && data.races.length > 0) {
        data.races.forEach((race: any, raceIndex: number) => {
          console.log(`Processing race ${raceIndex} (C#${race.seq}):`, race);
          if (race.scores && race.scores.length > 0) {
            race.scores.forEach((score: any) => {
              console.log(`  Score: ${score.playerName} = ${score.points} pts (membership: ${score.membershipId})`);
              
              // Si el jugador no existe en el map, crearlo
              if (!playersMap.has(score.membershipId)) {
                playersMap.set(score.membershipId, {
                  name: score.playerName,
                  racePoints: new Array(data.races.length).fill(0),
                  total: 0,
                });
              }
              
              // Asignar los puntos de esta carrera
              const player = playersMap.get(score.membershipId)!;
              player.racePoints[raceIndex] = score.points || 0;
              player.total += score.points || 0;
            });
          }
        });
      }

      console.log('Final players map:', Array.from(playersMap.entries()));

      // Ordenar jugadores por total de puntos
      const sortedPlayers = Array.from(playersMap.values()).sort((a, b) => b.total - a.total);

      console.log('Sorted players:', sortedPlayers);

      // Verificar si hay datos para mostrar
      if (sortedPlayers.length === 0) {
        alert('⚠️ No hay jugadores con predicciones en este día.');
        setExtractingRaces(null);
        return;
      }

      // Verificar si hay puntos calculados (solo advertencia, no bloquear)
      const hasAnyPoints = sortedPlayers.some(p => p.total > 0);
      console.log('Has any points?', hasAnyPoints);

      if (!hasAnyPoints) {
        console.warn('Warning: No points calculated yet for this day');
      }

      // Create a temporary div to render the summary
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = 'auto';
      tempDiv.style.padding = '30px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      // Build the HTML content - Estilo tabla Excel
      let html = `
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">
            ${data.pencaName}
          </h1>
          <h2 style="font-size: 20px; font-weight: 600; color: #4b5563; margin-bottom: 5px;">
            ${data.dayName}
          </h2>
          ${data.dayDate ? `
            <p style="font-size: 14px; color: #6b7280;">
              ${new Date(data.dayDate).toLocaleDateString('es-UY', { dateStyle: 'long' })}
            </p>
          ` : ''}
        </div>
        <div style="border-top: 2px solid #4f46e5; margin-bottom: 20px;"></div>
      `;

      if (data.races && data.races.length > 0 && sortedPlayers.length > 0) {
        // Calcular ancho dinámico basado en número de carreras
        const cellWidth = 70;
        const nameWidth = 150;
        const totalWidth = 80;
        const tableWidth = nameWidth + (data.races.length * cellWidth) + totalWidth;

        html += `
          <table style="width: ${tableWidth}px; border-collapse: collapse; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);">
                <th style="padding: 12px; text-align: left; color: white; font-weight: bold; font-size: 14px; border: 1px solid #4338ca; width: ${nameWidth}px;">
                  Jugador
                </th>
        `;

        // Headers de carreras
        data.races.forEach((race: any) => {
          html += `
            <th style="padding: 12px; text-align: center; color: white; font-weight: bold; font-size: 13px; border: 1px solid #4338ca; width: ${cellWidth}px;">
              C#${race.seq}
            </th>
          `;
        });

        html += `
                <th style="padding: 12px; text-align: center; color: white; font-weight: bold; font-size: 14px; border: 1px solid #4338ca; width: ${totalWidth}px; background: #312e81;">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
        `;

        // Filas de jugadores
        sortedPlayers.forEach((player, playerIndex) => {
          const rowBg = playerIndex % 2 === 0 ? '#f9fafb' : '#ffffff';
          const rankEmoji = playerIndex === 0 ? '🥇' : playerIndex === 1 ? '🥈' : playerIndex === 2 ? '🥉' : '';
          
          html += `
            <tr style="background-color: ${rowBg};">
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #1f2937; font-size: 14px; background: ${rowBg};">
                ${rankEmoji} ${player.name}
              </td>
          `;

          // Puntos por carrera
          player.racePoints.forEach((points) => {
            const pointsColor = points > 0 ? '#4f46e5' : '#374151';
            const pointsWeight = points > 0 ? 'bold' : 'normal';
            html += `
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; color: ${pointsColor}; font-weight: ${pointsWeight}; font-size: 14px;">
                ${points}
              </td>
            `;
          });

          html += `
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; color: #1f2937; font-weight: bold; font-size: 16px; background-color: ${playerIndex < 3 ? '#eef2ff' : rowBg};">
                ${player.total}
              </td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 12px; background-color: #f9fafb; border-radius: 6px; width: ${tableWidth}px; margin-left: auto; margin-right: auto; border: 1px solid #e5e7eb;">
            <h4 style="font-size: 13px; font-weight: bold; color: #374151; margin: 0 0 8px 0;">🏁 Resultados Oficiales</h4>
            <div style="display: grid; gap: 6px; font-size: 11px; line-height: 1.5;">
        `;

        data.races.forEach((race: any) => {
          const result = race.officialResult;
          if (result && (result.first || result.second || result.third || result.fourth)) {
            const positions = [];
            if (result.first) positions.push(`🥇 ${result.first}`);
            if (result.second) positions.push(`🥈 ${result.second}`);
            if (result.third) positions.push(`🥉 ${result.third}`);
            if (result.fourth) positions.push(`4° ${result.fourth}`);
            
            html += `
              <div style="color: #4b5563;">
                <strong style="color: #4f46e5;">C#${race.seq}:</strong> ${positions.join(' • ')}
              </div>
            `;
          } else {
            html += `
              <div style="color: #6b7280;">
                <strong style="color: #6b7280;">C#${race.seq}:</strong> <em>Pendiente</em>
              </div>
            `;
          }
        });

        html += `
            </div>
          </div>
        `;
      } else {
        html += `<p style="text-align: center; color: #6b7280; font-size: 16px;">No hay datos disponibles para este día</p>`;
      }

      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Generate image using html2canvas
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      document.body.removeChild(tempDiv);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const dayName = data.dayName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          link.download = `resumen_${dayName}_${Date.now()}.jpg`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error completo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al extraer el resumen de carreras: ${errorMessage}`);
    } finally {
      setExtractingRaces(null);
    }
  };

  const handleDownloadPredictions = async (raceId: string) => {
    try {
      setGeneratingImage(raceId);

      // Fetch predictions data
      const response = await fetch(`/api/admin/races/${raceId}/predictions-data`);
      if (!response.ok) {
        throw new Error('Error al obtener las predicciones');
      }

      const data = await response.json();

      // Create a temporary div to render the predictions
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      // Build the HTML content
      let html = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">
            ${data.race.pencaName}
          </h1>
          <h2 style="font-size: 22px; font-weight: 600; color: #4b5563; margin-bottom: 5px;">
            Carrera #${data.race.seq}
          </h2>
          <p style="font-size: 16px; color: #6b7280; margin-bottom: 5px;">
            ${data.race.venue} • ${data.race.distance_m}m
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            ${new Date(data.race.start_at).toLocaleDateString('es-UY', { dateStyle: 'long' })}
          </p>
        </div>
        <div style="border-top: 3px solid #4f46e5; margin-bottom: 30px;"></div>
        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 20px; text-align: center;">
          Predicciones de los Jugadores
        </h3>
      `;

      // Add predictions
      if (data.predictions && data.predictions.length > 0) {
        html += '<div style="display: grid; gap: 15px;">';
        data.predictions.forEach((pred: any, index: number) => {
          html += `
            <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; background-color: #f9fafb;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 5px 0;">
                    ${pred.playerName}
                  </p>
                  <p style="font-size: 14px; color: #6b7280; margin: 0;">
                    Jugador ${index + 1}
                  </p>
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 14px; color: #6b7280; margin: 0 0 5px 0;">
                    Ganador predicho:
                  </p>
                  <p style="font-size: 24px; font-weight: bold; color: #4f46e5; margin: 0;">
                    #${pred.winnerNumber}
                  </p>
                </div>
              </div>
            </div>
          `;
        });
        html += '</div>';
      } else {
        html += `<p style="text-align: center; color: #6b7280; font-size: 16px;">No hay predicciones registradas</p>`;
      }

      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Convert to canvas and download
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
          a.download = `predicciones-carrera-${data.race.seq}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error('Error generating image:', err);
      alert('Error al generar la imagen');
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleExportLeaderboard = async () => {
    try {
      setGeneratingImage('leaderboard');

      // Filtrar solo carreras con resultados publicados
      const publishedRaces = races.filter((race: Race) => race.status === 'result_published');

      // Preparar datos de la tabla
      const leaderboardData = actualMembers
        .map((member) => {
          const memberScores = scores?.filter((s: Score) => (s.user_id && s.user_id === member.user_id) || s.membership_id === member.id) || [];
          const totalPoints = memberScores.reduce((sum, score) => sum + (score.points_total || 0), 0);

          return {
            member,
            memberScores,
            totalPoints
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);

      // Crear div temporal para renderizar la tabla
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      // Construir HTML de la tabla
      let html = `
        <table style="border-collapse: collapse; font-size: 14px; width: auto;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: left; font-weight: 600;">Posición</th>
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: left; font-weight: 600;">Jugador</th>
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; font-weight: 600; background-color: #10b981; color: white;">Total</th>
      `;

      // Agregar columnas para cada carrera publicada
      publishedRaces.forEach((race: Race) => {
        html += `<th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; font-weight: 600;">Carrera #${race.seq}</th>`;
      });

      html += `
            </tr>
          </thead>
          <tbody>
      `;

      // Agregar filas de jugadores
      leaderboardData.forEach(({ member, memberScores, totalPoints }, index) => {
        const playerName = member.guest_name || member.profiles?.display_name || 'Sin nombre';

        html += `
          <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px;">${playerName}</td>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; background-color: #d1fae5; font-weight: 600;">${totalPoints}</td>
        `;

        // Agregar puntos por cada carrera publicada
        publishedRaces.forEach((race: Race) => {
          const raceScore = memberScores.find(s => s.race_id === race.id);
          const points = raceScore?.points_total || 0;
          html += `<td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center;">${points}</td>`;
        });

        html += `</tr>`;
      });

      html += `
          </tbody>
        </table>
      `;

      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Convertir a canvas y descargar
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      // Eliminar div temporal
      document.body.removeChild(tempDiv);

      // Convertir a blob y descargar
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tabla-posiciones-${pencaSlug}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error('Error exporting leaderboard:', err);
      alert('Error al exportar la tabla de posiciones');
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleExportLeaderboardByDay = async () => {
    try {
      setGeneratingImage('leaderboard-by-day');

      // Preparar datos agrupados por día
      const leaderboardByDay = actualMembers
        .map((member) => {
          const memberScores = scores?.filter((s: Score) => (s.user_id && s.user_id === member.user_id) || s.membership_id === member.id) || [];
          
          // Calcular puntos por día
          const pointsByDay = raceDays.map((day) => {
            const dayRaces = races.filter((r: Race) => r.race_day_id === day.id && r.status === 'result_published');
            const dayPoints = dayRaces.reduce((sum, race) => {
              const raceScore = memberScores.find(s => s.race_id === race.id);
              return sum + (raceScore?.points_total || 0);
            }, 0);
            return { dayName: day.day_name, points: dayPoints };
          });

          const totalPoints = pointsByDay.reduce((sum, day) => sum + day.points, 0);

          return {
            member,
            pointsByDay,
            totalPoints
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);

      // Crear div temporal
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      // Construir HTML
      let html = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">
            Puntos por Día
          </h1>
          <p style="font-size: 16px; color: #6b7280;">
            ${pencaSlug}
          </p>
        </div>
        <table style="border-collapse: collapse; font-size: 14px; width: auto;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: left; font-weight: 600;">Posición</th>
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: left; font-weight: 600;">Jugador</th>
      `;

      // Agregar columnas para cada día
      raceDays.forEach((day) => {
        html += `<th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; font-weight: 600;">${day.day_name}</th>`;
      });

      html += `
              <th style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; font-weight: 600; background-color: #10b981; color: white;">Total</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Agregar filas de jugadores
      leaderboardByDay.forEach(({ member, pointsByDay, totalPoints }, index) => {
        const playerName = member.guest_name || member.profiles?.display_name || 'Sin nombre';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

        html += `
          <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center;">${medal} ${index + 1}</td>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px;">${playerName}</td>
        `;

        // Agregar puntos por día
        pointsByDay.forEach(({ points }) => {
          html += `<td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center;">${points}</td>`;
        });

        html += `<td style="border: 1px solid #d1d5db; padding: 12px 16px; text-align: center; background-color: #d1fae5; font-weight: 600;">${totalPoints}</td>`;
        html += `</tr>`;
      });

      html += `
          </tbody>
        </table>
      `;

      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Convertir a canvas y descargar
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      document.body.removeChild(tempDiv);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tabla-posiciones-por-dia-${pencaSlug}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error('Error exporting leaderboard by day:', err);
      alert('Error al exportar la tabla por días');
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleDownloadResults = async (raceId: string) => {
    try {
      setGeneratingImage(raceId);

      // Fetch results data
      const response = await fetch(`/api/admin/races/${raceId}/results-data`);
      if (!response.ok) {
        throw new Error('Error al obtener los resultados');
      }

      const data = await response.json();

      // Create a temporary div to render the results
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      // Build the HTML content
      let html = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">
            ${data.race.pencaName}
          </h1>
          <h2 style="font-size: 22px; font-weight: 600; color: #4b5563; margin-bottom: 5px;">
            Carrera #${data.race.seq} - Resultados
          </h2>
          <p style="font-size: 16px; color: #6b7280; margin-bottom: 5px;">
            ${data.race.venue} • ${data.race.distance_m}m
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            ${new Date(data.race.start_at).toLocaleDateString('es-UY', { dateStyle: 'long' })}
          </p>
        </div>
        <div style="border-top: 3px solid #4f46e5; margin-bottom: 30px;"></div>
      `;

      // Add official result
      if (data.officialResult && data.officialResult.length > 0) {
        html += `
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #92400e; margin-bottom: 15px; text-align: center;">
              🏆 Resultado Oficial
            </h3>
            <div style="display: grid; gap: 10px;">
        `;

        data.officialResult.forEach((result: any) => {
          const medal = result.position === 1 ? '🥇' : result.position === 2 ? '🥈' : '🥉';
          html += `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">${medal}</span>
              <span style="font-size: 16px; font-weight: 600; color: #92400e;">
                ${result.position}° - Caballo #${result.number}
              </span>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      }

      // Add predictions and scores
      html += `
        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 20px; text-align: center;">
          Predicciones y Puntos
        </h3>
      `;

      if (data.predictions && data.predictions.length > 0) {
        html += '<div style="display: grid; gap: 15px;">';
        data.predictions.forEach((pred: any, index: number) => {
          const bgColor = index === 0 ? '#fef3c7' : index === 1 ? '#e0e7ff' : index === 2 ? '#fce7f3' : '#f9fafb';
          const borderColor = index === 0 ? '#f59e0b' : index === 1 ? '#6366f1' : index === 2 ? '#ec4899' : '#e5e7eb';

          html += `
            <div style="border: 2px solid ${borderColor}; border-radius: 8px; padding: 15px; background-color: ${bgColor};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                  <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 5px 0;">
                    ${index + 1}. ${pred.playerName}
                  </p>
                  <p style="font-size: 14px; color: #6b7280; margin: 0;">
                    Predicción: Caballo #${pred.winnerNumber}
                  </p>
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 28px; font-weight: bold; color: #4f46e5; margin: 0;">
                    ${pred.points}
                  </p>
                  <p style="font-size: 12px; color: #6b7280; margin: 0;">
                    puntos
                  </p>
                </div>
              </div>
            </div>
          `;
        });
        html += '</div>';
      } else {
        html += `<p style="text-align: center; color: #6b7280; font-size: 16px;">No hay predicciones registradas</p>`;
      }

      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Convert to canvas and download
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      // Remove temp div
      document.body.removeChild(tempDiv);

      // Convert to blob and download
      const a = document.createElement('a');
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = `resultados-carrera-${data.race.seq}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setGeneratingImage(null);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error generating results image:', err);
      alert('Error al generar la imagen de resultados');
      setGeneratingImage(null);
    }
  };

  // Renderizado del componente
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex gap-4 px-4 sm:px-6 overflow-x-auto"
          aria-label="Tabs"
        >
          <button
            onClick={() => setActiveTab('races')}
            className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'races'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Carreras ({races?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'members'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Miembros ({actualMembers.length}/{numParticipants})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'leaderboard'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Tabla de Posiciones
          </button>
          <button
            onClick={() => setActiveTab('streams')}
            className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'streams'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            🔴 Transmisiones
          </button>
          <Link
            href={`/admin/penca/${pencaSlug}/config`}
            className="flex-shrink-0 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
          >
            Configuración
          </Link>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-6">
        {/* Races Tab */}
        {activeTab === 'races' && (
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Gestión de Carreras</h3>
              <button
                onClick={() => setIsAddDayModalOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
              >
                + Agregar Día
              </button>
            </div>

            {/* Tabs de Días */}
            {raceDays && raceDays.length > 0 && (
              <div className="mb-6">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex gap-2 overflow-x-auto" aria-label="Días">
                    {raceDays.map((day) => {
                      const dayRaces = races.filter((race) => race.race_day_id === day.id);
                      const isSelected = selectedDayId === day.id;
                      
                      return (
                        <button
                          key={day.id}
                          onClick={() => setSelectedDayId(day.id)}
                          className={`flex-shrink-0 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                            isSelected
                              ? 'border-indigo-500 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            📅 {day.day_name}
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {dayRaces.length}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}

            {/* Contenido del día seleccionado */}
            {raceDays && raceDays.length > 0 && selectedDayId ? (
              <div className="space-y-4">
                {(() => {
                  const selectedDay = raceDays.find(d => d.id === selectedDayId);
                  if (!selectedDay) return null;
                  
                  const dayRaces = races.filter((race) => race.race_day_id === selectedDay.id);
                  
                  return (
                    <>
                      {/* Header del día seleccionado */}
                      <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-semibold text-indigo-700">
                            📅 {selectedDay.day_name}
                          </h4>
                          {selectedDay.day_date && (
                            <span className="text-sm text-gray-600">
                              {new Date(selectedDay.day_date).toLocaleDateString('es-UY', { 
                                dateStyle: 'medium' 
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsBulkUploadModalOpen(true)}
                            className="text-sm px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            📤 Cargar Predicciones
                          </button>
                          <button
                            onClick={() => handleExtractRaces(selectedDay.id)}
                            disabled={extractingRaces === selectedDay.id}
                            className="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {extractingRaces === selectedDay.id ? 'Generando...' : '📊 Extraer Carreras'}
                          </button>
                          <Link
                            href={`/admin/penca/${pencaSlug}/race/new?dayId=${selectedDay.id}`}
                            className="text-sm px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            + Agregar Carrera
                          </Link>
                          <button
                            onClick={() => handleDeleteDay(selectedDay.id)}
                            disabled={deletingDay === selectedDay.id}
                            className="text-sm px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            {deletingDay === selectedDay.id ? 'Eliminando...' : 'Eliminar Día'}
                          </button>
                        </div>
                      </div>

                      {/* Lista de Carreras */}
                      {dayRaces.length > 0 ? (
                        <div className="space-y-3">
                          {dayRaces.map((race) => {
                            const raceResult = raceResults.find(r => r.race_id === race.id);
                            const predsForRace = (predictions || []).filter((p: any) => p.race_id === race.id);
                            // Contar solo predicciones válidas (que tienen winner_pick)
                            const validPreds = predsForRace.filter((p: any) => p.winner_pick);
                            const uniquePredKeys = new Set(validPreds.map((p: any) => p.membership_id || p.user_id)).size;

                            return (
                              <div
                                key={race.id}
                                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                      <span className="text-lg font-bold text-gray-900">
                                        Carrera #{race.seq}
                                      </span>
                                      <span
                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${race.status === 'scheduled'
                                          ? 'bg-blue-100 text-blue-800'
                                          : race.status === 'closed'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-purple-100 text-purple-800'
                                          }`}
                                      >
                                        {race.status}
                                      </span>
                                    </div>
                                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                                      <p>
                                        📍 {race.venue} • 📏 {race.distance_m}m
                                      </p>
                                      <p>
                                        🕐{' '}
                                        {new Date(race.start_at).toLocaleDateString('es-UY', {
                                          dateStyle: 'medium',
                                        })}, {formatRaceTime(race.start_at)}
                                      </p>
                                      <p>🐴 {race.race_entries?.length || 0} caballos</p>
                                    </div>

                                    {/* Resultado Oficial */}
                                    {raceResult && raceResult.official_order && raceResult.official_order.length > 0 && (
                                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <p className="text-sm font-bold text-yellow-900 mb-2">🏆 Resultado Oficial:</p>
                                        <div className="space-y-1">
                                          {raceResult.official_order.slice(0, 3).map((entryId: string, index: number) => {
                                            const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                            return entry ? (
                                              <p key={entryId} className="text-sm text-yellow-900">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">Caballo #{entry.program_number}</span>
                                              </p>
                                            ) : null;
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Link
                                      href={`/admin/penca/${pencaSlug}/race/${race.id}/preview`}
                                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Ver
                                    </Link>
                                    <Link
                                      href={`/admin/penca/${pencaSlug}/race/${race.id}/edit`}
                                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                      Editar
                                    </Link>

                                    {/* Botón para cerrar/abrir predicciones */}
                                    {race.status === 'result_published' ? (
                                      <button
                                        onClick={() => handleDownloadResults(race.id)}
                                        disabled={generatingImage === race.id}
                                        className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                      >
                                        {generatingImage === race.id ? 'Generando...' : 'Resultado Publicado'}
                                      </button>
                                    ) : race.status === 'closed' ? (
                                      <button
                                        onClick={() => handleOpenPredictions(race.id)}
                                        disabled={closingRace === race.id}
                                        className="text-sm text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50"
                                      >
                                        {closingRace === race.id ? 'Abriendo...' : 'Abrir Predicciones'}
                                      </button>
                                    ) : (
                                      // Si ya hay predicciones (para todos los miembros) mostrar botón para descargar
                                      uniquePredKeys >= actualMembers.length ? (
                                        <button
                                          onClick={() => handleDownloadPredictions(race.id)}
                                          disabled={generatingImage === race.id}
                                          className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                                        >
                                          {generatingImage === race.id ? 'Generando...' : 'Predicciones Completas'}
                                        </button>
                                      ) : (
                                        // Enlace para que el admin cree/ingrese predicciones para todos los miembros
                                        <Link
                                          href={`/admin/penca/${pencaSlug}/race/${race.id}/predictions`}
                                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                                        >
                                          Predicciones ({uniquePredKeys}/{actualMembers.length})
                                        </Link>
                                      )
                                    )}

                                    {/* Botón para publicar resultado */}
                                    {race.status === 'result_published' ? (
                                      <button
                                        onClick={() => handleDownloadResults(race.id)}
                                        disabled={generatingImage === race.id}
                                        className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                      >
                                        {generatingImage === race.id ? 'Generando...' : 'Resultado Publicado'}
                                      </button>
                                    ) : (
                                      <Link
                                        href={`/admin/penca/${pencaSlug}/race/${race.id}/publish`}
                                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                                      >
                                        Publicar Resultado
                                      </Link>
                                    )}
                                    <DeleteRaceButton raceId={race.id} slug={pencaSlug} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">
                          No hay carreras en este día. Haz clic en "+ Agregar Carrera" para crear una.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : raceDays && raceDays.length > 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Selecciona un día para ver sus carreras</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay días creados todavía</p>
                <p className="text-sm text-gray-400">Haz clic en "+ Agregar Día" para comenzar</p>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Miembros de la Penca</h3>
              <p className="text-sm text-gray-500">
                {actualMembers.length} de {numParticipants} espacios ocupados
              </p>
            </div>

            {actualMembers.length > 0 ? (
              <div className="space-y-4">
                {/* Miembros actuales */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Jugador
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rol
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Se unió
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {actualMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.guest_name || member.profiles?.display_name || 'Sin nombre'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                                }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(member.joined_at).toLocaleDateString('es-UY', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={async () => {
                                if (confirm('¿Estás seguro de que quieres eliminar a este miembro? Esta acción no se puede deshacer.')) {
                                  try {
                                    const response = await fetch(`/api/admin/pencas/${pencaSlug}/members/${member.id}`, {
                                      method: 'DELETE',
                                    });

                                    if (!response.ok) {
                                      throw new Error('Error al eliminar miembro');
                                    }

                                    router.refresh();
                                  } catch (error) {
                                    console.error('Error:', error);
                                    alert('Error al eliminar miembro');
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Espacios vacíos */}
                {numParticipants > actualMembers.length && (
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3">Espacios Disponibles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array(numParticipants - actualMembers.length)
                        .fill(null)
                        .map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                          >
                            <svg
                              className="w-12 h-12 text-gray-400 mb-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <p className="text-gray-400 text-center mb-2">Espacio disponible</p>
                            <button
                              onClick={() => setIsAddMemberModalOpen(true)}
                              className="mt-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                              + Agregar miembro
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay miembros todavía</p>
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Espacios Disponibles ({numParticipants})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(numParticipants)
                      .fill(null)
                      .map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                        >
                          <svg
                            className="w-12 h-12 text-gray-400 mb-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <p className="text-gray-400 text-center mb-2">Espacio disponible</p>
                          <button
                            onClick={() => setIsAddMemberModalOpen(true)}
                            className="mt-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            + Agregar miembro
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Tabla de Posiciones</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportLeaderboard}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar
                </button>
                <button
                  onClick={handleExportLeaderboardByDay}
                  disabled={generatingImage === 'leaderboard-by-day'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {generatingImage === 'leaderboard-by-day' ? 'Generando...' : 'Exportar por Día'}
                </button>
              </div>
            </div>
            {actualMembers.length > 0 ? (
              <div className="space-y-6">
                {actualMembers
                  .map((member) => {
                    // Calcular puntos totales del miembro desde scores
                    // Soportar tanto scores por user_id como por membership_id (invitados/guest)
                    const memberScores = scores?.filter((s: Score) => (s.user_id && s.user_id === member.user_id) || s.membership_id === member.id) || [];
                    const totalPoints = memberScores.reduce((sum, score) => sum + (score.points_total || 0), 0);
                    return { member, totalPoints };
                  })
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map(({ member, totalPoints }, index) => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center w-12 h-12">
                            {index === 0 && <span className="text-3xl">🥇</span>}
                            {index === 1 && <span className="text-3xl">🥈</span>}
                            {index === 2 && <span className="text-3xl">🥉</span>}
                            {index > 2 && (
                              <span className="text-lg font-bold text-gray-600">
                                #{index + 1}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {member.guest_name || member.profiles?.display_name || 'Sin nombre'}
                            </p>
                            <p className="text-sm text-gray-500">Se unió {new Date(member.joined_at).toLocaleDateString('es-UY')}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <div className="text-left sm:text-right">
                            <p className="text-2xl font-bold text-indigo-600">{totalPoints} pts</p>
                          </div>
                          <button
                            onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-100 rounded-md self-start sm:self-end"
                          >
                            {expandedMember === member.id ? 'Ocultar predicciones' : 'Ver predicciones'}
                          </button>
                        </div>
                      </div>

                      {/* Detalles de predicciones - expandible */}
                      {expandedMember === member.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-4">Predicciones Detalladas</p>
                          <div className="space-y-4">
                            {races.map((race) => {
                              // Obtener la predicción y el score del miembro para esta carrera
                              // Encontrar score/ prediction por user_id o por membership_id (invitados)
                              const memberRaceScore = scores.find(s => ((s.user_id && s.user_id === member.user_id) || s.membership_id === member.id) && s.race_id === race.id);
                              const memberPrediction = predictions.find(p => ((p.user_id && p.user_id === member.user_id) || p.membership_id === member.id) && p.race_id === race.id);
                              const raceResult = raceResults.find(r => r.race_id === race.id);

                              return (
                                <div key={race.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
                                    <div>
                                      <p className="font-semibold text-gray-900">Carrera #{race.seq}</p>
                                      <p className="text-xs text-gray-600">{race.venue} • {race.distance_m}m</p>
                                    </div>
                                    <span className={`text-sm font-bold px-2 py-1 rounded ${memberRaceScore?.points_total
                                      ? 'bg-green-100 text-green-700'
                                      : race.status === 'result_published'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-200 text-gray-700'
                                      }`}>
                                      {memberRaceScore?.points_total || 0} pts
                                    </span>
                                  </div>

                                  {/* Resultado Oficial */}
                                  {raceResult && raceResult.official_order && raceResult.official_order.length > 0 && (
                                    <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                                      <p className="text-xs font-bold text-yellow-900 mb-2">🏆 Resultado Oficial:</p>
                                      <div className="space-y-1">
                                        {raceResult.official_order.slice(0, 3).map((entryId: string, index: number) => {
                                          const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                          return entry ? (
                                            <p key={entryId} className="text-xs text-yellow-900">
                                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">Caballo #{entry.program_number}</span>
                                            </p>
                                          ) : null;
                                        })}
                                      </div>
                                      {memberRaceScore && memberRaceScore.breakdown && (
                                        <div className="mt-2 pt-2 border-t border-yellow-300">
                                          <p className="text-xs font-semibold text-yellow-900 mb-1">Puntos obtenidos:</p>
                                          <div className="space-y-0.5">
                                            {Object.entries(memberRaceScore.breakdown).map(([key, value]: [string, any]) => (
                                              <p key={key} className="text-xs text-yellow-800">
                                                {key === 'winner' ? '🎯 Ganador' : key === 'exacta' ? '🎯 Exacta' : key === 'trifecta' ? '🎯 Trifecta' : key}: <span className="font-bold">{value} pts</span>
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {memberPrediction ? (
                                    <div className="mt-2 space-y-2">
                                      {/* Winner Pick */}
                                      {memberPrediction.winner_entry && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Ganador:</p>
                                          <p className="text-gray-900">
                                            <span className="font-bold">#{memberPrediction.winner_entry.program_number}</span> {memberPrediction.winner_entry.horse_name}
                                          </p>
                                        </div>
                                      )}

                                      {/* Exacta Pick */}
                                      {memberPrediction.exacta_pick && Array.isArray(memberPrediction.exacta_pick) && memberPrediction.exacta_pick.length > 0 && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Exacta (1° y 2°):</p>
                                          <div className="space-y-1">
                                            {memberPrediction.exacta_pick.map((entryId: string, index: number) => {
                                              const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                              return entry ? (
                                                <p key={entryId} className="text-gray-900">
                                                  {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                                </p>
                                              ) : null;
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Trifecta Pick */}
                                      {memberPrediction.trifecta_pick && Array.isArray(memberPrediction.trifecta_pick) && memberPrediction.trifecta_pick.length > 0 && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Trifecta (1°, 2° y 3°):</p>
                                          <div className="space-y-1">
                                            {memberPrediction.trifecta_pick.map((entryId: string, index: number) => {
                                              const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                              return entry ? (
                                                <p key={entryId} className="text-gray-900">
                                                  {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                                </p>
                                              ) : null;
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Status */}
                                      {race.status === 'result_published' ? (
                                        <div className="text-xs text-gray-600">
                                          <p className="text-green-600 font-semibold">✓ Resultado publicado</p>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-500">
                                          <p>⏳ Resultado pendiente</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400 mt-2">
                                      Sin predicción
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay miembros en la penca</p>
              </div>
            )}
          </div>
        )}

        {/* Streams Tab */}
        {activeTab === 'streams' && (
          <div>
            <LiveStreamsManager pencaId={pencaId} />
          </div>
        )}
      </div>

      {/* Modal para agregar miembro */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onAdd={handleAddMember}
        pencaSlug={pencaSlug}
      />

      {/* Modal para agregar día */}
      {isAddDayModalOpen && (
        <AddRaceDayModal
          pencaSlug={pencaSlug}
          pencaId={races[0]?.penca_id || ''}
          onClose={() => setIsAddDayModalOpen(false)}
          existingDays={raceDays.map(d => ({ day_number: d.day_number, day_name: d.day_name }))}
        />
      )}

      {/* Modal para carga masiva de predicciones */}
      {selectedDayId && (
        <BulkPredictionUploadModal
          isOpen={isBulkUploadModalOpen}
          onClose={() => setIsBulkUploadModalOpen(false)}
          pencaSlug={pencaSlug}
          dayId={selectedDayId}
          races={races.filter(r => r.race_day_id === selectedDayId)}
          memberships={memberships}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
