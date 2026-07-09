const fs = require('fs');

let js = fs.readFileSync('d:/Aru/assets/js/dashboard-script.js', 'utf8');

js = js.replace(/const groqApiKey = getGroqApiKey\(\);/g, '');
js = js.replace(/if \(!groqApiKey\) throw new Error\("API Key required"\);/g, '');
js = js.replace(/https:\/\/api.groq.com\/openai\/v1\/chat\/completions/g, '/api/chat');
js = js.replace(/"Authorization": `Bearer \$\{groqApiKey\}`,/g, '');
js = js.replace(/headers: \{ "Authorization": `Bearer \$\{groqApiKey\}`, "Content-Type": "application\/json" \},/g, 'headers: { "Content-Type": "application/json" },');

fs.writeFileSync('d:/Aru/assets/js/dashboard-script.js', js, 'utf8');
console.log('Fixed!');
