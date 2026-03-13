const axios = require('axios');

async function testApi() {
    const baseUrl = 'http://localhost:1111/api/home';
    
    console.log(`Testing GET ${baseUrl}...`);
    try {
        const getRes = await axios.get(baseUrl);
        console.log('GET Success:', typeof getRes.data === 'object');
    } catch (e) {
        console.log('GET Failed (expected if server is not running):', e.message);
    }

    console.log(`Testing POST ${baseUrl}...`);
    try {
        const postRes = await axios.post(baseUrl, {});
        console.log('POST Success:', typeof postRes.data === 'object');
    } catch (e) {
        console.log('POST Failed (expected if server is not running):', e.message);
    }
}

testApi();
