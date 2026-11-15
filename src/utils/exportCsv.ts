import { assignBibNumbers } from '../data/rundownSchedule';
import { COMPETITION_MAP, Registration } from '../types/registration';
import { formatDateTimeId } from './formatDate';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRegistrationsToCsv(
  registrations: Registration[],
  filenamePrefix = 'rekap-lomba-hut-ri-82'
): void {
  const bibMap = assignBibNumbers(registrations);

  const headers = [
    'No',
    'Kode Daftar',
    'Nomor Dada',
    'Nama Lengkap Anak',
    'Nama Orang Tua / Wali',
    'Umur (Tahun)',
    'No. WhatsApp',
    'Lomba yang Diikuti',
    'Status Kehadiran',
    'Waktu Daftar Ulang',
    'Waktu Daftar',
  ];

  const rows = registrations.map((item, index) => {
    const competitionLabels = item.competitions
      .map((id) => COMPETITION_MAP[id]?.name ?? id)
      .join('; ');

    const bibLabels = (bibMap.get(item.id) ?? []).join('; ') || '-';
    const formattedWa = item.whatsapp ? item.whatsapp : '-';
    const attendanceStatus = item.checkedIn ? 'Hadir' : 'Belum Hadir';
    const checkInTime = item.checkedInAt ? formatDateTimeId(item.checkedInAt) : '-';

    return [
      index + 1,
      item.registrationCode,
      bibLabels,
      item.childName,
      item.parentName,
      item.age,
      formattedWa,
      competitionLabels,
      attendanceStatus,
      checkInTime,
      formatDateTimeId(item.createdAt),
    ];
  });

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
