async function testRadar() {
  try {
    const aId = encodeURIComponent("Jannik Sinner");
    const bId = encodeURIComponent("Carlos Alcaraz");
    const url = `http://localhost:5000/api/players/compare/radar?aId=${aId}&bId=${bId}&weeks=52&decay=true&lambda=0.8`;
    console.log(`Testing GET ${url}`);
    const res = await fetch(url);
    if (res.ok) {
        const data = await res.json();
        console.log('Radar Data:', JSON.stringify(data, null, 2));
    } else {
        const text = await res.text();
        console.error('Error Body:', text);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testRadar();
