/* Check the Mews report date before accepting a daily list. */
(() => {
  'use strict';
  let selected = null;
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
  const display = iso => iso.split('-').reverse().join('.');
  const isoDate = value => {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return [value.getFullYear(), String(value.getMonth()+1).padStart(2,'0'), String(value.getDate()).padStart(2,'0')].join('-');
    const text = String(value || '');
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || null;
  };
  async function reportDate(file) {
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const parameters = workbook.Sheets.Parameters;
    if (parameters) {
      const rows = window.XLSX.utils.sheet_to_json(parameters, { header: 1, raw: true });
      const start = rows.find(row => String(row[0] || '').trim().toLowerCase() === 'start')?.[1];
      const end = rows.find(row => String(row[0] || '').trim().toLowerCase() === 'end')?.[1];
      const dates = [isoDate(start), isoDate(end)].filter(Boolean);
      if (dates.length === 2 && dates[0] === dates[1]) return { date: dates[0], source: 'report' };
    }
    // Prepared files have no Mews report metadata. The filename is a hint only.
    const named = file.name.match(/^Mews_Gaesteliste_(\d{2})-(\d{2})-(\d{4})(?:_|\.|\()/i);
    if (named) return { date: `${named[3]}-${named[2]}-${named[1]}`, source: 'filename' };
    const customers = workbook.Sheets.Customers;
    if (!customers) return null;
    const rows = window.XLSX.utils.sheet_to_json(customers, { header: 1, raw: false });
    const departures = rows.slice(1).filter(row => row[1] && /\bPeople\b/i.test(String(row[2] || '')))
      .map(row => isoDate(String(row[2]).split(' - ').at(-1)));
    if (departures.length && departures.every(date => date && date < today())) return { source: 'expired' };
    return null;
  }
  document.addEventListener('change', event => {
    if (!event.target.matches?.('input[type="file"][accept*=".xlsx"]')) return;
    const file = event.target.files?.[0];
    selected = file ? { file, result: reportDate(file).catch(() => null) } : null;
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.import-modal .modal-action.primary');
    if (!button || !selected?.file || !button.closest('.import-modal')) return;
    if (button.dataset.reportDateConfirmed === selected.file.name) return;
    event.preventDefault();event.stopImmediatePropagation();
    const current = selected;
    current.result.then(info => {
      if (!button.isConnected || selected !== current) return;
      if (!info || (info.date === today() && info.source !== 'expired')) {button.dataset.reportDateConfirmed=current.file.name;button.click();return;}
      const warning = document.createElement('div');
      warning.className = 'gm-dialog-layer import-date-warning';
      const heading = info.source === 'report' ? `Diese Mews-Datei gehört zum ${display(info.date)}.`
        : info.source === 'filename' ? `Der Dateiname nennt den ${display(info.date)}; ein Berichtsdatum ist in der Datei nicht nachweisbar.`
        : 'Alle erkannten Aufenthalte in dieser Datei sind bereits beendet.';
      warning.innerHTML = `<div class="gm-dialog" role="dialog" aria-modal="true"><h3>Mews-Liste prüfen</h3><p></p><p>Du erstellst die Frühstücksliste für den ${display(today())}. Datei trotzdem verwenden?</p><div class="gm-dialog-actions"><button type="button" data-cancel>Abbrechen</button><button type="button" data-accept>Trotzdem verwenden</button></div></div>`;
      warning.querySelector('p').textContent = heading;
      warning.querySelector('[data-cancel]').onclick = () => warning.remove();
      warning.querySelector('[data-accept]').onclick = () => {warning.remove();button.dataset.reportDateConfirmed=current.file.name;button.click();};
      document.body.append(warning);
    });
  }, true);
})();
