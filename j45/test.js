const http = require('http');
const fs = require('fs');

function testScreenshot() {
  console.log('Testing screenshot service...\n');

  const testUrl = encodeURIComponent('https://example.com');
  const url = `http://localhost:9000/screenshot?url=${testUrl}&width=800&height=600&format=png`;

  console.log('Request URL:', url);
  
  const file = fs.createWriteStream('test_output.png');

  http.get(url, (response) => {
    console.log('Status:', response.statusCode);
    console.log('Content-Type:', response.headers['content-type']);

    if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n✓ Screenshot saved to test_output.png');
        console.log('✓ Test passed!');
      });
    } else {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('Error response:', data);
      });
    }
  }).on('error', (err) => {
    console.error('Request error:', err.message);
  });
}

function testPostWithInjection() {
  console.log('\n\nTesting POST with custom CSS/JS injection...\n');

  const postData = JSON.stringify({
    url: 'https://example.com',
    width: 800,
    height: 600,
    format: 'png',
    customCss: 'body { background-color: red !important; } h1 { color: blue !important; }',
    customJs: 'console.log("Custom JS executed")'
  });

  const options = {
    hostname: 'localhost',
    port: 9000,
    path: '/screenshot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const file = fs.createWriteStream('test_output_injected.png');

  const req = http.request(options, (response) => {
    console.log('Status:', response.statusCode);
    console.log('Content-Type:', response.headers['content-type']);

    if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n✓ Injected screenshot saved to test_output_injected.png');
        console.log('✓ POST test passed!');
      });
    } else {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('Error response:', data);
      });
    }
  });

  req.on('error', (err) => {
    console.error('Request error:', err.message);
  });

  req.write(postData);
  req.end();
}

testScreenshot();
setTimeout(testPostWithInjection, 15000);
