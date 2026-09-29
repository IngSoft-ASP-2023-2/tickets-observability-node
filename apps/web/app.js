const API_EVENTS = '/api/events';
const API_BOOKINGS = '/api/bookings';

const $ = (id) => document.getElementById(id);

async function loadEvents() {
  const container = $('events');
  container.innerHTML = '<p class="text-slate-400">Cargando…</p>';
  try {
    const res = await fetch(API_EVENTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = await res.json();
    if (events.length === 0) {
      container.innerHTML = '<p class="text-slate-500">No hay eventos.</p>';
      return;
    }
    container.innerHTML = '';
    for (const e of events) container.appendChild(renderEvent(e));
  } catch (err) {
    container.innerHTML = `<p class="text-red-600 text-sm">Error: ${err.message}</p>`;
  }
}

function renderEvent(e) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-lg shadow p-4 flex items-center justify-between gap-4';
  card.innerHTML = `
    <div>
      <h3 class="font-semibold">${e.name}</h3>
      <p class="text-sm text-slate-500">${e.venue} · ${e.date}</p>
      <p class="text-sm mt-1">$${e.price.toLocaleString('es-AR')} · ${e.availableSeats} cupos</p>
    </div>
    <div class="flex items-center gap-2">
      <input type="number" min="1" max="10" value="1" class="w-16 border rounded px-2 py-1 text-sm text-center" />
      <button class="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm hover:bg-emerald-700">Reservar</button>
    </div>
  `;
  const qtyInput = card.querySelector('input');
  const btn = card.querySelector('button');
  btn.addEventListener('click', () => book(e.id, Number(qtyInput.value), btn));
  return card;
}

async function book(eventId, quantity, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  const email = prompt('Email para la reserva:', 'demo@example.com');
  if (!email) {
    btn.disabled = false;
    btn.textContent = 'Reservar';
    return;
  }
  try {
    const res = await fetch(API_BOOKINGS, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId, customerEmail: email, quantity }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const booking = await res.json();
    alert(`✅ Reserva OK\nbookingId: ${booking.bookingId}\nTotal: $${booking.totalAmount}`);
    $('bookingId').value = booking.bookingId;
    await loadEvents();
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reservar';
  }
}

async function lookup() {
  const id = $('bookingId').value.trim();
  const out = $('bookingResult');
  if (!id) {
    out.textContent = 'Ingresá un bookingId';
    return;
  }
  try {
    const res = await fetch(`${API_BOOKINGS}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    out.textContent = JSON.stringify(await res.json(), null, 2);
  } catch (err) {
    out.textContent = `Error: ${err.message}`;
  }
}

$('reload').addEventListener('click', loadEvents);
$('lookup').addEventListener('click', lookup);
loadEvents();
