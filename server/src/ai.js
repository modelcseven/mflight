import { getSetting } from './settings.js';

/** Calls an OpenAI-compatible chat completions endpoint. Throws if AI is not configured. */
export async function chat(messages, { maxTokens = 500 } = {}) {
  const s = await getSetting('ai');
  if (!s.enabled || !s.apiKey || !s.baseUrl) throw Object.assign(new Error('AI is not configured.'), { status: 400 });
  const res = await fetch(`${s.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.model, messages, max_tokens: maxTokens, temperature: 0.6 }),
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error?.message || `AI request failed (${res.status})`), { status: 502 });
  return json.choices?.[0]?.message?.content?.trim() || '';
}

export async function carInsights(car) {
  const spec = JSON.stringify({
    model: car.model, year: car.year, engine: car.engine, transmission: car.transmission, drivetrain: car.drivetrain,
    tires: car.tires, wheels: car.wheels, suspension: car.suspension, exhaust: car.exhaust,
    modifications: car.modifications, mileage: car.mileage,
  });
  const text = await chat([
    { role: 'system', content: 'You are an expert BMW M technician advising a car club member. Reply with exactly 3 short, specific insights (maintenance, setup or driving), one per line, no numbering, max 30 words each.' },
    { role: 'user', content: `My car: ${spec}` },
  ]);
  return text.split('\n').map((l) => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 3);
}
