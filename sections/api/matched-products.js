export default async function handler(req, res) {
  const aircraftsRaw = req.query.aircrafts || '';
  const aircrafts = aircraftsRaw.split(',').map(str => str.trim());

  if (!aircrafts.length) {
    return res.status(400).json({ error: 'Missing aircrafts query param' });
  }

  const response = await fetch('https://your-shop.myshopify.com/api/2024-01/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
    },
    body: JSON.stringify({
      query: `
        query {
          products(first: 100) {
            edges {
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

  const json = await response.json();
  const edges = json?.data?.products?.edges || [];
  const matchedHandles = [];

  for (const edge of edges) {
    const node = edge.node;
    const metafield = node.metafields?.find(mf => mf.key === 'removed_from_aircraft');

    let make = '';
    if (metafield?.reference?.fields) {
      for (const field of metafield.reference.fields) {
        if (field.key === 'make') make = field.value;
      }
    }

    if (aircrafts.includes(make)) {
      matchedHandles.push(node.handle);
    }
  }

  return res.status(200).json({ handles: matchedHandles });
}
