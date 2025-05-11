document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('matched-aircraft-parts');
  const grid = document.getElementById('matched-products-container');
  if (!container || !grid) return;

  const aircraftsRaw = container.dataset.aircrafts || '[]';
  let aircrafts;
  try {
    aircrafts = JSON.parse(aircraftsRaw);
    console.log("🛩️ Customer aircraft data:", aircrafts);
  } catch (err) {
    console.error('❌ Failed to parse aircraft data', err);
    return;
  }

  const aircraftsString = aircrafts.map(ac => ac.type).join(',');
  const response = await fetch(`https://your-vercel-project.vercel.app/api/matched-products?aircrafts=${encodeURIComponent(aircraftsString)}`);
  const data = await response.json();
  const matchedHandles = data.handles || [];

  if (matchedHandles.length === 0) {
    grid.innerHTML = `<p>No matched parts found for your aircraft.</p>`;
    return;
  }

  const chunkArray = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  const chunks = chunkArray(matchedHandles, 20);

  for (const chunk of chunks) {
    const rawHandles = chunk.join(',');
    const url = `/sections?section_id=matched-products-server&handles=${encodeURIComponent(rawHandles)}`;
    console.log(`📡 Fetching chunk → ${url}`);

    try {
      const html = await fetch(url).then(r => r.text());
      grid.innerHTML += html;
    } catch (err) {
      console.error('❌ Failed to load chunk:', err);
    }
  }
});
