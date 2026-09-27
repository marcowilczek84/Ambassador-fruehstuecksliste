// Browser-local synthetic data only. Every Supabase request is blocked by the audit.
module.exports = function seedUiFixture() {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
  const rooms = [20,30,40,50,60].flatMap(base => Array.from({length:9}, (_,i) => base+i)).filter(n=>n!==55).map(room => ({
    room, guests: room===64?[]:room===21?['Audit Anna Beispiel','Audit Ben Beispiel']:room===31?['Audit Alexandra Lange Familienname','Audit Frederik Zweiter Familienname']:['Audit Gast '+room],
    people:room===64?0:room===21||room===31?2:1, included:room%3!==1,
    present:room===20, arrivedCount:room===20?1:0, departedCount:0,
    table:room===20?'Tisch 12':undefined, arrival:'2026-09-26', departure:'2026-09-30',
    note:room===21?'Synthetische Bemerkung für die UI-Abnahme.':'', guestInfo:[]
  }));
  localStorage.setItem('ambassador-breakfast-rooms', JSON.stringify({date,rooms}));
  localStorage.setItem('ambassador-breakfast-activity-v1', JSON.stringify({date,items:[{id:'audit-existing-checkin-20',at:Date.now(),kind:'checkin',people:1,table:'Tisch 12',label:'Audit Zimmer 20 erfasst',afterRooms:[rooms[0]],roomNumbers:[20],beforeRooms:[{...rooms[0],present:false,arrivedCount:0,table:''}]}]}));
};
