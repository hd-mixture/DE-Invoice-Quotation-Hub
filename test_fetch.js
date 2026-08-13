const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/google/callback',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const fs = require('fs');
    fs.writeFileSync('error_dump.html', data);
    console.log('Saved error dump. Status code:', res.statusCode);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(JSON.stringify({ code: 'test' }));
req.end();
