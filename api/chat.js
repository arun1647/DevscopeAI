export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        return res.status(500).json({ error: 'API Key not configured in Vercel Environment Variables.' });
    }

    try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(req.body)
        });

        const data = await groqRes.json();
        return res.status(groqRes.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
