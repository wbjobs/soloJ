const http = require('http');

function makeRequest(index) {
  return new Promise((resolve, reject) => {
    const testUrl = encodeURIComponent('https://example.com');
    const url = `http://localhost:9000/screenshot?url=${testUrl}&width=800&height=600&format=png`;

    const start = Date.now();
    http.get(url, (response) => {
      const duration = Date.now() - start;
      let chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        console.log(`Request ${index}: Status=${response.statusCode}, Duration=${duration}ms, Size=${Buffer.concat(chunks).length}bytes`);
        resolve({ status: response.statusCode, duration });
      });
    }).on('error', (err) => {
      console.log(`Request ${index}: Error=${err.message}`);
      reject(err);
    });
  });
}

function checkHealth() {
  return new Promise((resolve) => {
    http.get('http://localhost:9000/health', (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('\nHealth check:', data);
        resolve(JSON.parse(data));
      });
    });
  });
}

async function runStressTest() {
  console.log('Starting stress test with 6 concurrent requests...\n');
  
  const promises = [];
  for (let i = 1; i <= 6; i++) {
    promises.push(makeRequest(i));
  }
  
  await checkHealth();
  
  try {
    await Promise.all(promises);
    console.log('\n✓ All requests completed');
  } catch (e) {
    console.log('\n✗ Some requests failed');
  }
  
  await new Promise(r => setTimeout(r, 2000));
  await checkHealth();
  
  console.log('\n✓ Stress test completed - check trackedBrowsers should be 0');
}

runStressTest();
