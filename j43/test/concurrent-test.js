const fetch = require('node-fetch');

const CONCURRENT_REQUESTS = 10;
const TEST_PACKAGE = 'unique-string';

async function makeRequest(id) {
  const start = Date.now();
  console.log(`[Request ${id}] Starting at ${new Date(start).toISOString()}`);
  
  try {
    const response = await fetch(`http://localhost:4873/${TEST_PACKAGE}`);
    const data = await response.json();
    const duration = Date.now() - start;
    console.log(`[Request ${id}] Completed in ${duration}ms, got: ${data.name}@${data['dist-tags'].latest}`);
    return { id, success: true, duration, data };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`[Request ${id}] Failed after ${duration}ms: ${error.message}`);
    return { id, success: false, duration, error: error.message };
  }
}

async function main() {
  console.log(`\n=== Testing Request Merge with ${CONCURRENT_REQUESTS} concurrent requests ===\n`);
  console.log(`Target: http://localhost:4873/${TEST_PACKAGE}`);
  console.log(`Expected: Only 1 upstream request, others merged\n`);

  const promises = [];
  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);

  console.log(`\n=== Summary ===`);
  const successful = results.filter(r => r.success).length;
  console.log(`Successful: ${successful}/${CONCURRENT_REQUESTS}`);
  console.log(`Check server logs for "[REQUEST MERGE]" messages to verify deduplication!`);
}

main().catch(console.error);
