import http from 'http';

const data = JSON.stringify({
  playerAId: "68f4cf34223bd266243147d3",
  playerBId: "68f4cf34223bd266243147d5"
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/predict',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
