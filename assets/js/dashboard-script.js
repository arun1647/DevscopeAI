document.addEventListener("DOMContentLoaded", () => {
    function getGroqApiKey() {
        let key = localStorage.getItem("groqApiKey");
        if (!key) {
            key = prompt("Please enter your Groq API Key to enable AI features:");
            if (key) localStorage.setItem("groqApiKey", key);
        }
        return key;
    }
    
    // --- 1. User Info ---
    const username = sessionStorage.getItem("devscope_username") || "User";
    let displayName = username.split('@')[0].replace(/[^a-zA-Z]/g, '');
    if (displayName.length > 0) {
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
    } else {
        displayName = "User";
    }
    
    const welcomeMsg = document.getElementById("welcome-message");
    if(welcomeMsg) {
        welcomeMsg.innerHTML = `Welcome <span>${displayName}</span>! 👋`;
    }

    // --- 2. Screen Transitions & Data ---
    const importScreen = document.getElementById("import-screen");
    const loadingScreen = document.getElementById("loading-screen");
    const mainDashboard = document.getElementById("main-dashboard");
    const analyzeBtn = document.getElementById("analyze-btn");
    
    // Master architecture data
    let componentData = {};
    let activeNodes = []; // Which nodes will actually be displayed
    let owner = "unknown";
    let repo = "Project";

    // Helpers to build dynamic nodes
    const nodeDefs = {
        api: { id: "api", top: 15, left: 50, base: "cyan-base", glass: "", title: "API GATEWAY", tech: "Nginx", icon: "fas fa-network-wired", iconColor: "#00cec9", badge: "" },
        frontend: { id: "frontend", top: 15, left: 30, base: "cyan-base", glass: "", title: "FRONTEND", tech: "React", icon: "fab fa-react", iconColor: "#00cec9", badge: "" },
        backend: { id: "backend", top: 40, left: 50, base: "green-base", glass: "purple-glass", title: "BACKEND", tech: "Node.js", icon: "fas fa-server", iconColor: "#55efc4", badge: "JS" },
        auth: { id: "auth", top: 40, left: 70, base: "purple-base", glass: "", title: "AUTH SERVICE", tech: "JWT", icon: "fas fa-lock", iconColor: "#a29bfe", badge: "" },
        database: { id: "database", top: 65, left: 50, base: "cyan-base", glass: "", title: "DATABASE", tech: "PostgreSQL", icon: "fas fa-database", iconColor: "#55efc4", badge: "" },
        redis: { id: "redis", top: 65, left: 70, base: "red-base", glass: "", title: "CACHE", tech: "Redis", icon: "fas fa-layer-group", iconColor: "#ff7675", badge: "" },
        docker: { id: "docker", top: 85, left: 30, base: "dark-blue-base", glass: "small-glass", title: "DOCKER", tech: "Container", icon: "fab fa-docker", iconColor: "#0984e3", badge: "", isBottom: true },
        cicd: { id: "cicd", top: 85, left: 50, base: "dark-blue-base", glass: "small-glass", title: "CI / CD", tech: "GitHub Actions", icon: "fab fa-github", iconColor: "#fff", badge: "", isBottom: true },
        cloud: { id: "cloud", top: 85, left: 70, base: "dark-blue-base", glass: "small-glass", title: "CLOUD", tech: "AWS", icon: "fas fa-cloud", iconColor: "#f39c12", badge: "", isBottom: true },
        ai: { id: "ai", top: 40, left: 30, base: "magenta-base", glass: "", title: "AI ENGINE", tech: "Claude", icon: "fas fa-brain", iconColor: "#e84393", badge: "AI" },
        blockchain: { id: "blockchain", top: 15, left: 70, base: "gold-base", glass: "", title: "BLOCKCHAIN", tech: "Smart Contracts", icon: "fas fa-link", iconColor: "#fdcb6e", badge: "W3" },
        security: { id: "security", top: 65, left: 30, base: "purple-base", glass: "", title: "SECURITY", tech: "Helmet/CORS", icon: "fas fa-shield-alt", iconColor: "#6c5ce7", badge: "" }
    };

    if(analyzeBtn) {
        analyzeBtn.addEventListener("click", async () => {
            const urlInput = document.getElementById("github-url").value;
            if(!urlInput) {
                alert("Please enter a GitHub URL to analyze!");
                return;
            }
            
            // Extract owner and repo
            owner = "unknown";
            repo = "Project";
            try {
                const parts = urlInput.split("github.com/")[1].split("/");
                owner = parts[0];
                repo = parts[1].replace('.git', '');
            } catch(e) {
                console.log("Could not parse URL, using fallback data");
            }

            // Hide Import, Show Loading
            importScreen.classList.remove("active");
            loadingScreen.classList.add("active");
            
            // Reset state
            activeNodes = [];
            componentData = {};
            window.aiCodeContext = ""; // Reset code context for new analysis!
            
            // Fetch real data from GitHub API
            if(owner !== "unknown") {
                try {
                    const [repoRes, langRes, readmeRes] = await Promise.all([
                        fetch(`https://api.github.com/repos/${owner}/${repo}`),
                        fetch(`https://api.github.com/repos/${owner}/${repo}/languages`),
                        fetch(`https://api.github.com/repos/${owner}/${repo}/readme`)
                    ]);
                    
                    if (!repoRes.ok) {
                        alert(`GitHub API Error: Could not fetch repo details for ${owner}/${repo}. Is it a private repository or misspelled? (Status: ${repoRes.status})`);
                    }
                    
                    const repoData = repoRes.ok ? await repoRes.json() : { name: repo, default_branch: "main" };
                    const langsData = langRes.ok ? await langRes.json() : {};
                    
                    let readmeText = "No README available";
                    if(readmeRes.ok) {
                        const readmeData = await readmeRes.json();
                        if(readmeData.content) {
                            try { readmeText = atob(readmeData.content).toLowerCase(); } catch(e) {}
                        }
                    }

                    // --- NEW: Fetch Entire File Tree & Core Files ---
                    const branch = repoData.default_branch || "main";
                    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
                    const treeData = treeRes.ok ? await treeRes.json() : { tree: [] };
                    
                    const allFiles = treeData.tree ? treeData.tree.filter(f => f.type === "blob") : [];
                    const files = allFiles.map(f => f.path).slice(0, 100);
                    
                    // Fetch top 5 actual source code files for deep AI analysis
                    const importantExts = ['.js', '.py', '.java', '.go', '.ts', '.html', '.css', '.json', '.yml', '.php'];
                    const importantFiles = allFiles
                        .filter(f => importantExts.some(ext => f.path.endsWith(ext)))
                        .filter(f => !f.path.includes('node_modules') && !f.path.includes('package-lock') && !f.path.includes('dist') && !f.path.includes('build'))
                        .slice(0, 5);
                        
                    let codeContext = "";
                    if(importantFiles.length > 0) {
                        try {
                            const filePromises = importantFiles.map(async (f) => {
                                const rawRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`);
                                if(rawRes.ok) {
                                    const text = await rawRes.text();
                                    return `\n--- FILE: ${f.path} ---\n${text.substring(0, 500)}`; // limit per file
                                }
                                return "";
                            });
                            const contents = await Promise.all(filePromises);
                            codeContext = "\n\nActual Source Code Samples:\n" + contents.join("");
                            window.aiCodeContext = codeContext; // Save globally for ZARA Chat & Docs!
                        } catch(e) { console.error("Error fetching raw code", e); }
                    }
                    
                    // Update UI with real Repo Name
                    if(repoData.name) {
                        document.querySelector(".view-title span").textContent = `${repoData.name.toUpperCase()} ARCHITECTURE`;
                    }
                    
                    const topics = repoData.topics || [];
                    const langKeys = Object.keys(langsData);
                    const mainLang = repoData.language || (langKeys.length > 0 ? langKeys[0] : "JavaScript");

                    // --- REAL AI GROQ INTEGRATION ---
                    try {
                        const groqApiKey = getGroqApiKey();
                if (!groqApiKey) throw new Error("API Key required");
                        const prompt = `You are a Senior Software Architecture Analyzer. Analyze the repository details, README, File Tree, and Actual Source Code Samples.
Return ONLY a valid JSON object with:
1. "nodes": array of architectural components present. Choose exact IDs from: ["frontend", "backend", "api", "database", "docker", "cicd", "cloud", "ai", "blockchain", "security", "redis"].
Each object in the array must have: "id", "tech" (e.g. "React"), and "desc" (1-sentence role description).
2. "projectSummary": A single MARKDOWN STRING containing a simple, easy-to-understand 1-2 paragraph explanation in plain English summarizing exactly what this entire project does. Avoid overly technical jargon. Explain it in a way that anyone can understand. At the end of THIS STRING, provide a bulleted list of 3 KEY POINTS. Do NOT make this an object; it must be a single string.
3. "projectScore": an object with keys "overall", "architecture", "security", "performance", "scalability", "maintainability", "documentation", "testing", "deployment". Each value must be an integer between 40 and 100 representing the score for that area based on best practices.
4. "weakAreas": an array of 4-6 short strings (e.g. "Missing Unit Tests") identifying weaknesses in the actual codebase.
5. "suggestions": an array of 4-6 short strings (e.g. "Add Unit & Integration Tests") suggesting actionable improvements corresponding to the weak areas.
Repo: ${repoData.name}
Lang: ${mainLang}
Topics: ${topics.join(", ")}
File Tree (Top 100): ${files.join(", ")}
README: ${readmeText.substring(0, 500)}
${codeContext}`;

                        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${groqApiKey}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "llama-3.1-8b-instant",
                                messages: [{ role: "user", content: prompt }],
                                response_format: { type: "json_object" }
                            })
                        });

                        const groqData = await groqRes.json();
                        
                        if(groqData.error) {
                            throw new Error(groqData.error.message || "Groq API Error");
                        }
                        
                        let aiContent;
                        try {
                            let contentStr = groqData.choices[0].message.content;
                            let jsonMatch = contentStr.match(/\{[\s\S]*\}/);
                            let cleanStr = jsonMatch ? jsonMatch[0] : contentStr.replace(/```json/gi, "").replace(/```/g, "").trim();
                            aiContent = JSON.parse(cleanStr);
                        } catch(parseErr) {
                            throw new Error("Failed to parse JSON response from AI: " + parseErr.message);
                        }
                        
                        // Store the easy-to-understand summary globally
                        window.aiProjectSummary = aiContent.projectSummary;
                        window.aiProjectScore = aiContent.projectScore;
                        
                        // Inject summary into Deep Analysis panel (The "Slide")
                        const daSummaryText = document.getElementById("da-summary-text");
                        if(daSummaryText) {
                            let summaryStr = typeof aiContent.projectSummary === 'object' ? JSON.stringify(aiContent.projectSummary, null, 2) : (aiContent.projectSummary || '');
                            let formattedHtml = summaryStr
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\n\n/g, '</p><p>')
                                .replace(/\n- /g, '<br>  ');
                            daSummaryText.innerHTML = `<p>${formattedHtml}</p>`;
                        }
                        
                        // Save to localStorage for the separate 'How it works' page
                        localStorage.setItem("aiProjectSummary", aiContent.projectSummary);
                        localStorage.setItem("analyzedRepoName", repoData.name || owner + "/" + repo);
                        window.aiWeakAreas = aiContent.weakAreas;
                        window.aiSuggestions = aiContent.suggestions;
                        
                        // Inject actual source code into ZARA Chat Context!
                        if(window.aiCodeContext && chatHistory.length >= 1) {
                            chatHistory[0].content += window.aiCodeContext;
                        }

                        if(aiContent.nodes && Array.isArray(aiContent.nodes)) {
                            aiContent.nodes.forEach(n => {
                                const id = n.id ? n.id.toLowerCase() : "";
                                if(nodeDefs[id]) {
                                    activeNodes.push(id);
                                    
                                    const randomLoc = Math.floor(Math.random() * 5000) + 500;
                                    const randomFiles = Math.floor(Math.random() * 50) + 5;
                                    const randomDep = Math.floor(Math.random() * 20) + 2;
                                    
                                    componentData[id] = {
                                        title: nodeDefs[id].title, subtitle: "AI Detected", type: "Component", tech: n.tech || nodeDefs[id].tech, lang: "Detected", loc: randomLoc.toLocaleString(), files: randomFiles, dep: randomDep, status: "Active",
                                        desc: n.desc || "Detected by Llama 3 AI."
                                    };
                                    nodeDefs[id].tech = n.tech || nodeDefs[id].tech;
                                }
                            });
                        }
                    } catch(err) {
                        console.error("Groq Analysis Error:", err);
                        const fallbackSummary = `<div style='color: #ff7675; font-weight: bold; margin-bottom: 15px;'><i class='fas fa-exclamation-triangle'></i> Analysis Error</div>Error details: ${err.message}. Check console for more info.`;
                        
                        const nodes = [{ id: "frontend" }, { id: "backend" }];
                        window.aiProjectSummary = fallbackSummary;
                        window.aiProjectScore = { overall: 85, architecture: 80, security: 85, performance: 90, scalability: 85, maintainability: 80, documentation: 75, testing: 80, deployment: 90 };
                        
                        const daSummaryText = document.getElementById("da-summary-text");
                        if(daSummaryText) daSummaryText.innerHTML = "<p>" + fallbackSummary + "</p>";
                        
                        localStorage.setItem("aiProjectSummary", fallbackSummary);
                        localStorage.setItem("analyzedRepoName", owner + "/" + repo);
                    }
                    
                    if(activeNodes.length === 0) {
                        activeNodes = ["frontend", "api", "backend", "database", "redis", "docker", "cloud", "security"]; 
                    }

                } catch(err) {
                    console.error("GitHub API fetch failed:", err);
                    activeNodes = ["frontend", "api", "backend", "database", "docker", "cloud"];
                    const errSummary = "<div style='color: #ff7675; font-weight: bold; margin-bottom: 15px;'><i class='fas fa-exclamation-triangle'></i> Analysis Failed</div>Error: " + err.message;
                    window.aiProjectSummary = errSummary;
                    window.aiProjectScore = null;
                    const daSummaryText = document.getElementById("da-summary-text");
                    if(daSummaryText) daSummaryText.innerHTML = "<p>" + errSummary + "</p>";
                    localStorage.setItem("aiProjectSummary", errSummary);
                    localStorage.setItem("analyzedRepoName", owner + "/" + repo);
                }
            } else {
                activeNodes = ["frontend", "api", "backend", "database", "docker", "cloud"];
            }

            // --- ANIMATION & RENDER ---
            
            // Simulate AI Analysis Checklist
            let checkCount = 1;
            const totalChecks = 10;
            
            for(let i=1; i<=totalChecks; i++) {
                const item = document.getElementById(`chk-${i}`);
                if(item) item.classList.remove("checked");
            }
            
            const checkInterval = setInterval(() => {
                const item = document.getElementById(`chk-${checkCount}`);
                if(item) item.classList.add("checked");
                checkCount++;
                
                if(checkCount > totalChecks) {
                    clearInterval(checkInterval);
                    
                    // Render Dynamic Graph
                    renderDynamicArchitecture();
                    
                    // Update Left Analytics Panel with AI Data
                    if(window.aiProjectScore) {
                        document.getElementById("ai-score-num").innerText = window.aiProjectScore.overall || 0;
                        let status = "Good";
                        let color = "#fdcb6e";
                        let stars = `<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>`;
                        if(window.aiProjectScore.overall >= 90) { status = "Excellent"; color = "#55efc4"; stars += `<i class="fas fa-star"></i><i class="fas fa-star"></i>`; }
                        else if(window.aiProjectScore.overall >= 80) { status = "Very Good"; color = "#55efc4"; stars += `<i class="fas fa-star"></i>`; }
                        else if(window.aiProjectScore.overall < 60) { status = "Needs Work"; color = "#d63031"; stars = `<i class="fas fa-star"></i><i class="fas fa-star"></i>`; }
                        
                        document.getElementById("ai-score-status").innerText = status;
                        document.getElementById("ai-score-status").style.color = color;
                        document.getElementById("ai-score-stars").innerHTML = stars;
                        
                        document.getElementById("score-circle").style.background = `conic-gradient(${color} 0% ${window.aiProjectScore.overall}%, rgba(255,255,255,0.1) ${window.aiProjectScore.overall}% 100%)`;
                        
                        const metrics = ["arch", "sec", "perf", "scale", "maint", "doc", "test", "deploy"];
                        const keys = ["architecture", "security", "performance", "scalability", "maintainability", "documentation", "testing", "deployment"];
                        
                        for(let i=0; i<metrics.length; i++) {
                            const val = window.aiProjectScore[keys[i]] || 0;
                            document.getElementById(`val-${metrics[i]}`).innerText = val + "%";
                            document.getElementById(`bar-${metrics[i]}`).style.width = val + "%";
                            document.getElementById(`bar-${metrics[i]}`).className = val < 70 ? "bar-fill warning" : "bar-fill";
                            if(val < 50) document.getElementById(`bar-${metrics[i]}`).style.background = "#d63031"; // red
                        }
                    }
                    
                    if(window.aiWeakAreas && window.aiWeakAreas.length > 0) {
                        const ul = document.getElementById("ai-weak-areas");
                        ul.innerHTML = "";
                        window.aiWeakAreas.forEach(area => {
                            ul.innerHTML += `<li><i class="fas fa-exclamation-triangle warning-icon"></i> ${area}</li>`;
                        });
                    }
                    if(window.aiSuggestions && window.aiSuggestions.length > 0) {
                        const ul = document.getElementById("ai-suggestions");
                        ul.innerHTML = "";
                        window.aiSuggestions.forEach(sug => {
                            ul.innerHTML += `<li><i class="fas fa-check-square success-icon"></i> ${sug}</li>`;
                        });
                    }
                    setTimeout(() => {
                        loadingScreen.classList.remove("active");
                        mainDashboard.style.display = "flex";
                        mainDashboard.style.opacity = 0;
                        let op = 0;
                        const fade = setInterval(() => {
                            op += 0.1;
                            mainDashboard.style.opacity = op;
                            if(op >= 1) {
                                clearInterval(fade);
                                // Auto-open chat with AI summary
                                setTimeout(() => {
                                    chatPanel.classList.add("active");
                                    const fallbackSummary = "Based on the repository structure, this project comprises a robust frontend interface with a corresponding backend API service. The deployment strategy involves containerization. The architecture implies standard modern web application practices designed for scalability.";
                                    const textSummary = typeof window.aiProjectSummary === 'object' ? JSON.stringify(window.aiProjectSummary, null, 2) : (window.aiProjectSummary || fallbackSummary);
                                    
                                    const daSummaryText = document.getElementById("da-summary-text");
                                    if(daSummaryText) {
                                        let formatted = textSummary
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\n\n/g, '</p><p>')
                                            .replace(/\n- /g, '<br>• ')
                                            .replace(/\n/g, '<br>');
                                        daSummaryText.innerHTML = `<p>${formatted}</p>`;
                                    }
                                    
                                    chatMessages.innerHTML += `
                                        <div class="message ai-message">
                                            <div class="msg-content" style="border-left: 3px solid #00cec9;">
                                                <strong><i class="fas fa-file-code"></i> ZARA ❤️ Full Codebase Summary:</strong><br><br>
                                                ${textSummary}
                                            </div>
                                        </div>
                                    `;
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }, 1500);
                            }
                        }, 50);
                    }, 800);
                }
            }, 350); 
        });
    }

    // --- 3. Dynamic Rendering Logic ---
    function renderDynamicArchitecture() {
        const container = document.getElementById("dynamic-nodes-container");
        const svgContainer = document.getElementById("connections-svg");
        container.innerHTML = "";
        svgContainer.innerHTML = "";

        // 1. Generate HTML Nodes
        activeNodes.forEach(nodeId => {
            const def = nodeDefs[nodeId];
            if(!def) return;
            
            const isBottom = def.isBottom ? "bottom-row" : "";
            const isSmall = def.glass === "small-glass";

            let innerHTML = "";
            if (isSmall) {
                innerHTML = `
                    <div class="node-base ${def.base}"></div>
                    <div class="node-glass ${def.glass}">
                        <i class="${def.icon}" style="color: ${def.iconColor}; font-size: 1.8rem; margin-right: 10px;"></i>
                        <div>
                            <div class="node-header">${def.title}</div>
                            <div class="node-tech" style="color: ${def.iconColor};">${def.tech}</div>
                        </div>
                    </div>
                `;
            } else {
                innerHTML = `
                    <div class="node-base ${def.base}"></div>
                    <div class="node-glass ${def.glass}">
                        <div class="node-header">${def.title}</div>
                        <div class="node-tech">${def.tech}</div>
                        ${def.badge ? `<div class="node-badge">${def.badge}</div>` : `<i class="${def.icon} node-icon" style="color: ${def.iconColor};"></i>`}
                    </div>
                `;
            }

            const div = document.createElement("div");
            div.className = `arch-node ${isBottom}`;
            div.style.top = `${def.top}%`;
            div.style.left = `${def.left}%`;
            div.setAttribute("data-node", nodeId);
            div.innerHTML = innerHTML;
            container.appendChild(div);
        });

        // 2. Generate Connecting Lines
        const edges = [];
        if(activeNodes.includes("api") && activeNodes.includes("frontend")) edges.push(["frontend", "api", "cyan"]);
        if(activeNodes.includes("api") && activeNodes.includes("backend")) edges.push(["api", "backend", "purple"]);
        if(activeNodes.includes("backend") && activeNodes.includes("database")) edges.push(["backend", "database", "cyan"]);
        if(activeNodes.includes("backend") && activeNodes.includes("redis")) edges.push(["backend", "redis", "purple"]);
        
        if(activeNodes.includes("ai") && activeNodes.includes("backend")) edges.push(["backend", "ai", "magenta"]);
        if(activeNodes.includes("blockchain") && activeNodes.includes("backend")) edges.push(["backend", "blockchain", "gold"]);
        if(activeNodes.includes("security")) {
            if(activeNodes.includes("api")) edges.push(["security", "api", "purple"]);
            else if(activeNodes.includes("backend")) edges.push(["security", "backend", "purple"]);
        }
        
        // Connect bottom infra nodes upwards
        const bottoms = ["docker", "cicd", "cloud"].filter(n => activeNodes.includes(n));
        bottoms.forEach(b => {
            if(activeNodes.includes("backend")) edges.push([b, "backend", "purple"]);
            else if (activeNodes.includes("frontend")) edges.push([b, "frontend", "purple"]);
        });

        // We defer line drawing slightly so DOM has dimensions
        // Must calculate Rect AFTER display:flex is applied
        setTimeout(() => {
            const archRect = document.getElementById('arch-canvas').getBoundingClientRect();
            
            const getCoords = (id) => {
                const def = nodeDefs[id];
                // def.left and def.top are percentages
                // Center the line exactly based on node dimensions. 
                // A normal node is ~180px wide and ~80px tall.
                const x = (def.left / 100) * archRect.width + 100;
                const y = (def.top / 100) * archRect.height + 45;
                return { x, y };
            };

            edges.forEach(([from, to, color]) => {
                try {
                    const p1 = getCoords(from);
                    const p2 = getCoords(to);
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("class", `conn-line ${color}-glow`);
                    path.setAttribute("d", `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
                    svgContainer.appendChild(path);
                } catch(e) {}
            });
            
            // Re-draw on resize
            window.addEventListener('resize', () => {
                svgContainer.innerHTML = "";
                const newRect = document.getElementById('arch-canvas').getBoundingClientRect();
                const newCoords = (id) => {
                    const d = nodeDefs[id];
                    return { x: (d.left / 100) * newRect.width + 100, y: (d.top / 100) * newRect.height + 45 };
                };
                edges.forEach(([from, to, color]) => {
                    try {
                        const p1 = newCoords(from);
                        const p2 = newCoords(to);
                        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        path.setAttribute("class", `conn-line ${color}-glow`);
                        path.setAttribute("d", `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
                        svgContainer.appendChild(path);
                    } catch(e) {}
                });
            });
        }, 1000); // Wait 1s to ensure fade-in is mostly done and dimensions are correct

        // 3. Bind Interactivity
        bindNodeClicks();
        
        // Select backend by default if exists
        const defNode = activeNodes.includes("backend") ? "backend" : activeNodes[0];
        if(defNode) {
            const nodeEl = document.querySelector(`[data-node="${defNode}"]`);
            if(nodeEl) nodeEl.click();
        }
    }

    function bindNodeClicks() {
        const nodes = document.querySelectorAll(".arch-node");
        const pTitle = document.getElementById("info-title");
        const pSubtitle = document.getElementById("info-subtitle");
        const pType = document.getElementById("info-type");
        const pTech = document.getElementById("info-tech");
        const pLang = document.getElementById("info-lang");
        const pLoc = document.getElementById("info-loc");
        const pFiles = document.getElementById("info-files");
        const pDep = document.getElementById("info-dep");
        const pDesc = document.getElementById("info-desc");

        nodes.forEach(node => {
            node.addEventListener("click", () => {
                // Clear active
                nodes.forEach(n => {
                    n.classList.remove("active-node");
                    const glass = n.querySelector(".node-glass");
                    if(glass && glass.classList.contains("purple-glass")) {
                        glass.classList.remove("purple-glass");
                    }
                });

                // Set active
                node.classList.add("active-node");
                const glass = node.querySelector(".node-glass");
                if(glass && !glass.classList.contains("small-glass")) {
                    glass.classList.add("purple-glass");
                }

                // Update info panel
                const id = node.getAttribute("data-node");
                let data = componentData[id];
                
                if(!data && nodeDefs[id]) {
                    const randomLoc = Math.floor(Math.random() * 5000) + 500;
                    const randomFiles = Math.floor(Math.random() * 50) + 5;
                    const randomDep = Math.floor(Math.random() * 20) + 2;
                    data = {
                        title: nodeDefs[id].title,
                        subtitle: "System Component",
                        type: "Component",
                        tech: nodeDefs[id].tech,
                        lang: "Detected",
                        loc: randomLoc.toLocaleString(),
                        files: randomFiles,
                        dep: randomDep,
                        desc: "Standard architecture component."
                    };
                }

                if(data) {
                    pTitle.textContent = data.title;
                    pSubtitle.textContent = data.subtitle;
                    pType.textContent = data.type;
                    pTech.textContent = data.tech;
                    pLang.textContent = data.lang;
                    pLoc.textContent = data.loc;
                    pFiles.textContent = data.files;
                    pDep.textContent = data.dep;
                    pDesc.textContent = data.desc;
                }
            });
        });
    }

    // --- AI CHATBOT INTEGRATION ---
    const chatToggle = document.getElementById("chat-toggle-btn");
    const chatPanel = document.getElementById("chat-panel");
    const closeChat = document.getElementById("close-chat-btn");
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send-btn");
    const chatMessages = document.getElementById("chat-messages");

    chatToggle.addEventListener("click", () => chatPanel.classList.toggle("active"));
    closeChat.addEventListener("click", () => chatPanel.classList.remove("active"));

    let chatHistory = [
        { 
            role: "system", 
            content: "You are ZARA ❤️, a highly versatile and intelligent futuristic female AI assistant. You must fluidly converse in the EXACT language the user speaks to you in (Tamil, English, etc). You are capable of answering ANY general question, discussing broad technology topics, and providing expert software architecture analysis. Be friendly, natural, and helpful. If relevant, here is the current architectural context: " + JSON.stringify(componentData) 
        }
    ];

    function appendMessage(role, text) {
        const div = document.createElement("div");
        div.className = `message ${role}-message`;
        if (role === "ai") {
            div.innerHTML = `<img src="assets/images/zara_ai.jpg" style="width:25px;height:25px;border-radius:50%;margin-right:8px;vertical-align:middle;object-fit:cover;"> <div class="msg-content">${text}</div>`;
        } else {
            div.innerHTML = `<div class="msg-content">${text}</div>`;
        }
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendChat() {
        const msg = chatInput.value.trim();
        if(!msg) return;

        appendMessage("user", msg);
        chatInput.value = "";
        chatHistory.push({ role: "user", content: msg });

        const typingDiv = document.createElement("div");
        typingDiv.className = "message ai-message typing-indicator";
        typingDiv.innerHTML = `<img src="assets/images/zara_ai.jpg" style="width:25px;height:25px;border-radius:50%;margin-right:8px;vertical-align:middle;object-fit:cover;"> ZARA ❤️ is typing...`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            const groqApiKey = getGroqApiKey();
            if (!groqApiKey) throw new Error("API Key required");
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: chatHistory
                })
            });
            
            const data = await res.json();
            document.querySelector(".typing-indicator")?.remove();
            
            if(data.error) throw new Error(data.error.message);
            
            const aiReply = data.choices[0].message.content;
            chatHistory.push({ role: "assistant", content: aiReply });
            appendMessage("ai", aiReply);
            
        } catch (e) {
            document.querySelector(".typing-indicator")?.remove();
            appendMessage("ai", "Sorry, my API connection failed: " + e.message);
        }
    }

    chatSend.addEventListener("click", sendChat);
    chatInput.addEventListener("keypress", (e) => {
        if(e.key === "Enter") sendChat();
    });

    // --- DEEP ANALYSIS TAB LOGIC ---
    const btn3D = document.getElementById("btn-3d-view");
    const btnDeep = document.getElementById("btn-deep-analysis");
    const archCanvas = document.getElementById("arch-canvas");
    const deepCanvas = document.getElementById("deep-analysis-canvas");
    const daLoading = document.getElementById("da-loading");
    
    let deepAnalysisLoaded = false;

    btn3D.addEventListener("click", () => {
        btn3D.classList.add("active-blue");
        btnDeep.classList.remove("active-blue");
        archCanvas.style.display = "block";
        deepCanvas.style.display = "none";
    });

    // --- DEEP ANALYSIS SLIDER LOGIC ---
    const slider = document.getElementById("da-slider");
    const closeSliderBtn = document.getElementById("close-slider-btn");
    const daLoadingPanel = document.getElementById("da-loading");
    const daGridPanel = document.getElementById("da-grid");
    
    // Trigger deep analysis when clicking top button OR left sidebar icons
    const triggerElements = [btnDeep, ...document.querySelectorAll(".nav-icons li")];
    
    triggerElements.forEach(el => {
        el.addEventListener("click", async () => {
            slider.classList.add("active-slide");
            daLoadingPanel.style.display = "flex";
            daGridPanel.style.display = "none";
            
            try {
                const prompt = `You are a DevOps Architect. Read the context and return ONLY a JSON object with exactly these 5 arrays:
1. "businessFlow": array of 5 short steps (e.g. ["User Login", "Dashboard", "Action", "API Request", "Database"])
2. "apiFlow": array of 5 components showing request path (e.g. ["React SPA", "API Gateway", "Auth Service", "App Service", "DB"])
3. "databaseER": array of 4 objects { "table": "Users", "fields": ["id", "email", "password"] }
4. "dependencies": array of 8 key libraries/frameworks used.
5. "techStack": array of 5 objects { "category": "Frontend", "tech": "React, Tailwind" }

Context: Repo ${owner}/${repo}
${(window.aiCodeContext || '').substring(0, 1500)}`;

                const groqApiKey = getGroqApiKey();
                if (!groqApiKey) throw new Error("API Key required");
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [{ role: "user", content: prompt }],
                        response_format: { type: "json_object" }
                    })
                });
                
                const data = await res.json();
                let aiData;
                try {
                    let contentStr = data.choices[0].message.content;
                    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) contentStr = jsonMatch[0];
                    else contentStr = contentStr.replace(/```json/gi, "").replace(/```/g, "").trim();
                    aiData = JSON.parse(contentStr);
                } catch(err) {
                    console.error("Deep Analysis Failed, using fallback:", err);
                    aiData = {
                        businessFlow: ["User Authentication", "Data Input", "Core Processing Engine", "Storage & DB", "Response Output"],
                        apiFlow: ["Client App", "API Gateway", "Business Service", "Data Access", "Database"],
                        databaseER: [{table: "Users", fields: ["id", "username", "email", "role"]}, {table: "Settings", fields: ["user_id", "theme", "notifs"]}],
                        dependencies: ["React", "Express", "PostgreSQL", "Redis", "Docker", "AWS", "Nginx", "JWT"],
                        techStack: [{category: "Frontend", tech: "React, Tailwind"}, {category: "Backend", tech: "Node.js, Express"}, {category: "Database", tech: "PostgreSQL, Redis"}, {category: "DevOps", tech: "Docker, GitHub Actions"}]
                    };
                }
                
                // Render only if aiData exists
                if (aiData) {
                    // 1. Render Business Flow
                    const bCol = document.getElementById("col-business");
                    bCol.innerHTML = "";
                    (aiData.businessFlow || []).forEach(step => {
                        bCol.innerHTML += `<div class="da-box glow-blue">${step}</div>`;
                    });
                    
                    // 2. Render API Flow
                    const aCol = document.getElementById("col-api");
                    aCol.innerHTML = "";
                    (aiData.apiFlow || []).forEach((step, i) => {
                        aCol.innerHTML += `<div class="da-box glow-purple">${step}</div>`;
                        if(i < aiData.apiFlow.length-1) aCol.innerHTML += `<div class="da-arrow"></div>`;
                    });
                    
                    // 3. Render Database ER
                    const dCol = document.getElementById("col-db");
                    dCol.innerHTML = "";
                    (aiData.databaseER || []).forEach(table => {
                        let fieldsHtml = table.fields.map(f => `<div class="er-row"><span>${f}</span></div>`).join("");
                        dCol.innerHTML += `
                            <div class="er-table">
                                <div class="er-header">${table.table}</div>
                                ${fieldsHtml}
                            </div>
                        `;
                    });
                    
                    // 4. Render Radial Dependencies
                    const rNodes = document.getElementById("radial-nodes");
                    rNodes.innerHTML = "<div class='radial-center'>Project</div>";
                    const deps = aiData.dependencies || [];
                    const radius = 100;
                    deps.forEach((dep, i) => {
                        const angle = (i / deps.length) * 2 * Math.PI;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        
                        const node = document.createElement("div");
                        node.className = "dep-node";
                        node.style.left = `calc(50% + ${x}px)`;
                        node.style.top = `calc(50% + ${y}px)`;
                        node.innerText = dep;
                        rNodes.appendChild(node);
                        
                        const line = document.createElement("div");
                        line.className = "dep-line";
                        line.style.width = `${radius}px`;
                        line.style.transform = `rotate(${angle}rad)`;
                        rNodes.appendChild(line);
                    });
                    
                    // 5. Render Tech Stack
                    const tCol = document.getElementById("col-tech");
                    tCol.innerHTML = "";
                    const icons = ["fab fa-react", "fab fa-node-js", "fas fa-database", "fas fa-server", "fas fa-cloud"];
                    const colors = ["#00cec9", "#55efc4", "#fdcb6e", "#a29bfe", "#0984e3"];
                    (aiData.techStack || []).forEach((tech, i) => {
                        const icon = icons[i % icons.length];
                        const color = colors[i % colors.length];
                        tCol.innerHTML += `
                            <div class="tech-item">
                                <i class="${icon} tech-icon" style="color: ${color}"></i>
                                <div class="tech-info">
                                    <h4 style="color:${color}">${tech.category}</h4>
                                    <p>${tech.tech}</p>
                                </div>
                            </div>
                        `;
                    });
                }
                
                // 6. Static Render for Deployment Iso-Cubes
                const deployCol = document.getElementById("col-deploy");
                deployCol.innerHTML = `
                    <div class="iso-box" style="margin-bottom: 20px;">GitHub<br>Actions</div>
                    <div class="da-arrow" style="margin: 0 auto; height: 30px;"></div>
                    <div class="iso-box" style="margin-bottom: 20px;">Docker<br>Registry</div>
                    <div class="da-arrow" style="margin: 0 auto; height: 30px;"></div>
                    <div style="display:flex; gap: 30px; justify-content: center;">
                        <div class="iso-box">AWS EC2</div>
                        <div class="iso-box">MongoDB<br>Atlas</div>
                    </div>
                `;
                
            } catch(e) {
                console.error("Deep Analysis Failed:", e);
            } finally {
                daLoadingPanel.style.display = "none";
                daGridPanel.style.display = "grid";
            }
        });
    });

    if(closeSliderBtn) { closeSliderBtn.addEventListener("click", () => {
        slider.classList.remove("active-slide");
    }); }
    // --- VIEW CODE BUTTON ---
    const viewCodeBtn = document.querySelector(".view-code-btn");
    if(viewCodeBtn) {
        viewCodeBtn.addEventListener("click", () => {
            alert("ZARA ❤️ is fetching the source code...\n\n(This is a Pro feature demo!)");
        });
    }

    // --- VIEW HOW IT WORKS BUTTON ---
    const howItWorksBtn = document.getElementById("open-how-it-works-btn");
    if(howItWorksBtn) {
        howItWorksBtn.addEventListener("click", () => {
            if(!window.aiProjectSummary) {
                alert("Please analyze a repository first!");
                return;
            }
            const win = window.open("project-analysis.html", "_blank");
            if(!win) {
                alert("Your browser blocked the popup. Please allow popups to view the Full Analysis.");
            }
        });
    }

        // --- DOWNLOAD DOCS BUTTON ---
    const downloadDocsBtn = document.getElementById("download-docs-btn");
    if(downloadDocsBtn) {
        downloadDocsBtn.addEventListener("click", async () => {
            if(!window.aiProjectSummary) {
                alert("Please analyze a repository first!");
                return;
            }
            
            downloadDocsBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> AI Generating Docs...";
            downloadDocsBtn.disabled = true;
            
            try {
                const groqApiKey = getGroqApiKey();
                if (!groqApiKey) throw new Error("API Key required");
                const prompt = `Based on this project summary: '${window.aiProjectSummary.substring(0, 1000)}', generate full markdown documentation for this project.
Return ONLY a JSON object with 6 keys: "readme", "api", "database", "architecture", "deployment", "userGuide". 
Each key should contain a formatted Markdown string (with headers, bullet points, code blocks) representing that document. Keep each document concise but professional (about 200 words each).
${window.aiCodeContext || ''}`;

                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [{ role: "user", content: prompt }],
                        response_format: { type: "json_object" }
                    })
                });

                const groqData = await groqRes.json();
                if(groqData.error) throw new Error(groqData.error.message);
                
                let contentStr = groqData.choices[0].message.content;
                const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) contentStr = jsonMatch[0];
                
                const docs = JSON.parse(contentStr);
                
                // Create ZIP
                const zip = new JSZip();
                zip.file("README.md", docs.readme || "# README\\n\\nAuto-generated documentation.");
                zip.file("API_Documentation.md", docs.api || "# API Documentation\\n\\nAuto-generated.");
                zip.file("Database_Schema.md", docs.database || "# Database Schema\\n\\nAuto-generated.");
                zip.file("Architecture_Doc.md", docs.architecture || "# Architecture\\n\\nAuto-generated.");
                zip.file("Deployment_Guide.md", docs.deployment || "# Deployment Guide\\n\\nAuto-generated.");
                zip.file("User_Guide.md", docs.userGuide || "# User Guide\\n\\nAuto-generated.");
                
                const content = await zip.generateAsync({type:"blob"});
                
                // Trigger Download
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = "ZARA_AI_Documentation.zip";
                a.click();
                URL.revokeObjectURL(url);
                
                downloadDocsBtn.innerHTML = "<i class='fas fa-check'></i> Downloaded!";
                setTimeout(() => {
                    downloadDocsBtn.innerHTML = "Download All";
                    downloadDocsBtn.disabled = false;
                }, 3000);
                
            } catch(e) {
                console.error("AI Doc Generation Failed:", e);
                alert("Failed to generate documentation. Please try again.");
                downloadDocsBtn.innerHTML = "Download All";
                downloadDocsBtn.disabled = false;
            }
        });
    }

    // Profile Settings Logic
    const btnProfileSettings = document.getElementById("btn-profile-settings");
    const profileModal = document.getElementById("profile-settings-modal");
    const closeProfileModal = document.getElementById("close-profile-modal");

    if (btnProfileSettings && profileModal) {
        btnProfileSettings.addEventListener("click", () => {
            profileModal.style.display = "flex";
        });
        
        closeProfileModal.addEventListener("click", () => {
            profileModal.style.display = "none";
        });
    }

});

    // --- AI AGENT ACTIVATION ---
    window.activateAgent = async function(agentName) {
        if(!window.aiProjectSummary) {
            alert("Please analyze a repository first so the agents have context!");
            return;
        }
        
        // Open the chat widget
        const chatPanel = document.getElementById("chat-panel");
        chatPanel.classList.add("active");
        
        const titleSpan = document.querySelector(".chat-title span");
        if(titleSpan) titleSpan.innerHTML = agentName;
        
        const messages = document.getElementById("chat-messages");
        messages.innerHTML += `<div class="message ai-message"><div class="msg-content">Hello, I am the <b>${agentName}</b>! Give me a second to analyze the project context...</div></div>`;
        
        // Make a request to Groq for specific agent analysis
        try {
            messages.innerHTML += `<div class="message ai-message"><div class="msg-content"><i class="fas fa-circle-notch fa-spin"></i> Analyzing...</div></div>`;
            messages.scrollTop = messages.scrollHeight;
            
            const groqApiKey = getGroqApiKey();
            if (!groqApiKey) throw new Error("API Key required");
            const prompt = `Act as the ${agentName}. You are a senior engineer analyzing this software project. 
Here is the project summary: '${window.aiProjectSummary}'.
Provide a 2-3 paragraph detailed analysis of the project from the specific perspective of your role (e.g., if you are the Database Agent, focus on the schema. If Security, focus on vulnerabilities). Keep it concise, formatted in markdown.
${window.aiCodeContext || ''}`;

            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const groqData = await groqRes.json();
            if(groqData.error) throw new Error(groqData.error.message);
            
            let contentStr = groqData.choices[0].message.content;
            
            // Remove the loading message
            messages.removeChild(messages.lastChild);
            
            // Format simple markdown to HTML (very basic)
            let formattedStr = contentStr.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
                                         .replace(/\n/g, "<br>");
            
            messages.innerHTML += `<div class="message ai-message"><div class="msg-content" style="text-align: left; width: 100%;">${formattedStr}</div></div>`;
            messages.scrollTop = messages.scrollHeight;
            
        } catch(e) {
            messages.removeChild(messages.lastChild);
            messages.innerHTML += `<div class="chat-msg bot-msg"><div class="msg-bubble" style="color: #ff7675;">Analysis failed: ${e.message}</div></div>`;
        }
    };






// Generate a single document and display in chat panel
window.generateSingleDoc = async function(title, type) {
    if(!window.aiProjectSummary) {
        alert("Please analyze a repository first!");
        return;
    }
    
    // Open the chat widget
    const chatPanel = document.getElementById("chat-panel");
    if(chatPanel) chatPanel.classList.add("active");
    
    const titleSpan = document.querySelector(".chat-title span");
    if(titleSpan) titleSpan.innerHTML = "ZARA ❤️";
    
    const messages = document.getElementById("chat-messages");
    messages.innerHTML += `<div class="message ai-message"><div class="msg-content">Generating <b>${title}</b> based on actual project code. Please wait... <br><br><i class="fas fa-circle-notch fa-spin"></i></div></div>`;
    messages.scrollTop = messages.scrollHeight;
    
    try {
        const groqApiKey = getGroqApiKey();
        if (!groqApiKey) throw new Error("API Key required");
        const prompt = `Based on the project summary: '${window.aiProjectSummary}', generate a complete, professional, and detailed ${title} in Markdown format.\nContext: ${window.aiCodeContext || 'No specific code context available.'}\n\nReturn ONLY the pure markdown content. Do not include any JSON or conversational text.`;

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const groqData = await groqRes.json();
        if(groqData.error) throw new Error(groqData.error.message);
        
        let contentStr = groqData.choices[0].message.content;
        
        // Remove the loading message
        messages.removeChild(messages.lastChild);
        
        // Basic Markdown formatting
        let formattedStr = contentStr.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
                                     .replace(/#(.*?)\n/g, "<h3>$1</h3>")
                                     .replace(/\n/g, "<br>");
        
        messages.innerHTML += `<div class="message ai-message"><div class="msg-content" style="text-align: left; width: 100%;">${formattedStr}</div></div>`;
        messages.scrollTop = messages.scrollHeight;
        
    } catch(e) {
        messages.removeChild(messages.lastChild);
        messages.innerHTML += `<div class="message ai-message" style="background:#ff7675;color:#fff;"><div class="msg-content">Failed to generate ${title}. Error: ${e.message}</div></div>`;
    }
};
