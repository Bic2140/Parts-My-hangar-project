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

  if (!Array.isArray(aircrafts) || aircrafts.length === 0) {
    console.warn('⚠️ No aircraft data found');
    return;
  }

  async function fetchAllProducts() {
    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const response = await fetch('/api/2024-01/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': 'b89d401b9e18eb32a97eb150cd9f9766' // Replace with real token
        },
        body: JSON.stringify({
          query: `
            query {
              products(first: 50${cursor ? `, after: "${cursor}"` : ''}) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  cursor
                  node {
                    handle
                    metafields(identifiers: [
                      { namespace: "custom", key: "removed_from_aircraft" }
                    ]) {
                      key
                      value
                      reference {
                        ... on Metaobject {
                          fields {
                            key
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `
        })
      });

      const result = await response.json();
      const edges = result?.data?.products?.edges || [];
      allProducts.push(...edges.map(e => e.node));
      hasNextPage = result?.data?.products?.pageInfo?.hasNextPage;
      cursor = result?.data?.products?.pageInfo?.endCursor;
    }

    return allProducts;
  }

  const chunkArray = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  const products = await fetchAllProducts();
  console.log("✅ Fetched", products.length, "products");

  const matchedHandles = [];

  products.forEach(product => {
    const meta = {};
    const metafields = Array.isArray(product.metafields) ? product.metafields : [];

    console.log("🔍 Aircrafts:", aircrafts);
    console.log("🔍 Product metafields:", metafields);
    console.log("🔍 Product meta:", meta);

    const ref = metafields.find(mf => mf && mf.key === 'removed_from_aircraft');
    if (ref?.reference?.fields) {
      ref.reference.fields.forEach(f => {
        if (f?.key && f?.value) {
          meta[f.key] = f.value;
        }
      });
    }

    const isMatch = aircrafts.some(ac => ac.type === meta.make);
    if (isMatch) {
      // Ensure the handle matches the format used in Shopify URLs
      matchedHandles.push(product.handle); // Ensure this is the correct handle format
    }
  });

  console.log("🎯 Matched handles:", matchedHandles);

  if (matchedHandles.length === 0) {
    grid.innerHTML = `<p>No matched parts found for your aircraft.</p>`;
    return;
  }

  console.log(`🎯 Matched ${matchedHandles.length} products. Loading in chunks...`);
  const chunks = chunkArray(matchedHandles, 20);

  for (const chunk of chunks) {
    const rawHandles = chunk.join(',');
    const url = `/sections?section_id=matched-products-server&handles=${encodeURIComponent(rawHandles)}`;
    console.log(`📡 Fetching chunk → ${url}`); // Debugging the URL
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json', // Ensure proper headers
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();
      grid.innerHTML += html;
    } catch (err) {
      console.error('❌ Failed to load chunk:', err);
    }
  }
});
