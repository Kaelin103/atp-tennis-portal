async function testEndpoint() {
  try {
    const url = 'http://localhost:5000/api/players/rankings/dynamic?minMatches=5&limit=50&window=52w&sortBy=winRate&algo=classic&decay=true&lambda=0.8';
    console.log(`Testing GET ${url}`);
    const res = await fetch(url);
    console.log('Status:', res.status);
    if (res.ok) {
        const data = await res.json();
        console.log('Data Players Count:', data.players ? data.players.length : 0);
        console.log('Meta:', data.meta);
        if (data.players && data.players.length > 0) {
            console.log('Top player:', data.players[0]);
        } else {
            console.log('No players returned.');
        }
    } else {
        const text = await res.text();
        console.error('Error Body:', text);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testEndpoint();
