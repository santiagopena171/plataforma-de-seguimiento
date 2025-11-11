'use client';

export default function RefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
    >
      🔄 Refrescar
    </button>
  );
}
