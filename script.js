// --- 3D Background with Three.js ---

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030305, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Create Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 4000;
const posArray = new Float32Array(particlesCount * 3);
const colorsArray = new Float32Array(particlesCount * 3);

const color1 = new THREE.Color(0x6c5ce7); // Purple
const color2 = new THREE.Color(0x00cec9); // Cyan
const color3 = new THREE.Color(0xa29bfe); // Light Purple

for(let i = 0; i < particlesCount * 3; i+=3) {
    // Position
    posArray[i] = (Math.random() - 0.5) * 120; // x
    posArray[i+1] = (Math.random() - 0.5) * 120; // y
    posArray[i+2] = (Math.random() - 0.5) * 120; // z
    
    // Color
    let mixedColor;
    const rand = Math.random();
    if(rand < 0.33) {
        mixedColor = color1.clone().lerp(color2, Math.random());
    } else if (rand < 0.66) {
        mixedColor = color2.clone().lerp(color3, Math.random());
    } else {
        mixedColor = color3.clone().lerp(color1, Math.random());
    }
    
    colorsArray[i] = mixedColor.r;
    colorsArray[i+1] = mixedColor.g;
    colorsArray[i+2] = mixedColor.b;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

// Create a glowing particle material
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// Add 3D Geometric Objects floating in the background
const geometries = [];
const group = new THREE.Group();
scene.add(group);

const material = new THREE.MeshPhysicalMaterial({
    color: 0x6c5ce7,
    metalness: 0.2,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.5,
    envMapIntensity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.6,
    wireframe: true
});

// Central TorusKnot
const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(8, 2.5, 120, 32),
    material
);
group.add(torusKnot);

// Floating shapes
for(let i=0; i<10; i++) {
    const geo = new THREE.IcosahedronGeometry(Math.random() * 2 + 1);
    const mesh = new THREE.Mesh(geo, material);
    
    mesh.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40 - 20
    );
    
    mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    // Custom properties for animation
    mesh.userData = {
        rotSpeed: {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        },
        floatSpeed: Math.random() * 0.01 + 0.005,
        startY: mesh.position.y
    };
    
    group.add(mesh);
}


// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x6c5ce7, 2, 100);
pointLight.position.set(20, 20, 20);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0x00cec9, 2, 100);
pointLight2.position.set(-20, -20, 20);
scene.add(pointLight2);

// Mouse Interaction
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX) * 0.001;
    mouseY = (event.clientY - windowHalfY) * 0.001;
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Smooth mouse follow (Parallax effect)
    targetX = mouseX * 0.5;
    targetY = mouseY * 0.5;
    
    // Rotate particle system slowly
    particlesMesh.rotation.y += 0.0005;
    particlesMesh.rotation.x += 0.0002;
    
    // Animate geometries
    torusKnot.rotation.y = 0.15 * elapsedTime;
    torusKnot.rotation.x = 0.08 * elapsedTime;
    
    group.children.forEach(child => {
        if(child !== torusKnot) {
            child.rotation.x += child.userData.rotSpeed.x;
            child.rotation.y += child.userData.rotSpeed.y;
            child.rotation.z += child.userData.rotSpeed.z;
            
            // Floating effect
            child.position.y = child.userData.startY + Math.sin(elapsedTime * child.userData.floatSpeed * 50) * 5;
        }
    });
    
    // Move group slightly with mouse
    group.rotation.x += (mouseY * 0.5 - group.rotation.x) * 0.05;
    group.rotation.y += (mouseX * 0.5 - group.rotation.y) * 0.05;

    // Parallax effect on camera
    camera.position.x += (mouseX * 10 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 10 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}
animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- Glass Panel 3D Tilt Effect ---
const glassPanel = document.querySelector('.glass-panel');

// The user requested to disable the 3D tilt effect so the panel stays straight.
// document.addEventListener('mousemove', (e) => {
//     const xAxis = (window.innerWidth / 2 - e.pageX) / 20;
//     const yAxis = (window.innerHeight / 2 - e.pageY) / 20;
//     glassPanel.style.transform = `perspective(1000px) rotateY(${xAxis}deg) rotateX(${yAxis}deg) translateZ(10px)`;
// });
// document.addEventListener('mouseleave', () => {
//     glassPanel.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0)`;
// });

// --- Signup / Login Logic ---
let isSignUpMode = false;
const toggleSignupBtn = document.getElementById('toggle-signup');
const formTitle = document.querySelector('.glass-panel h2');
const formSubtitle = document.querySelector('.glass-panel p');
const submitBtnSpan = document.querySelector('.login-btn span');

if(toggleSignupBtn) {
    toggleSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;
        
        if(isSignUpMode) {
            formTitle.textContent = "Create Account";
            formSubtitle.textContent = "Sign up to DevScope AI";
            submitBtnSpan.textContent = "Sign Up";
            document.querySelector('.signup-text').innerHTML = `Already have an account? <a href="#" id="toggle-signup">Login</a>`;
        } else {
            formTitle.textContent = "DevScope AI";
            formSubtitle.textContent = "Enter your details to proceed";
            submitBtnSpan.textContent = "Login";
            document.querySelector('.signup-text').innerHTML = `Don't have an account? <a href="#" id="toggle-signup">Sign up</a>`;
        }
        
        // Re-attach listener to new link
        document.getElementById('toggle-signup').addEventListener('click', arguments.callee);
    });
}

// Form submission effect
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.querySelector('.login-btn');
    
    // Capture username and password
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if(isSignUpMode) {
        // Handle Sign Up
        localStorage.setItem(`user_${username}`, password);
        alert("Account created successfully! Please login now.");
        
        // Switch back to login mode automatically
        document.getElementById('toggle-signup').click();
        document.getElementById('password').value = "";
        return;
    } else {
        // Handle Login Validation
        const savedPassword = localStorage.getItem(`user_${username}`);
        if(!savedPassword) {
            alert("User not found! Please sign up first.");
            return;
        }
        if(savedPassword !== password) {
            alert("Incorrect password!");
            return;
        }
    }
    
    // Successful login effect
    sessionStorage.setItem('devscope_username', username);
    btn.innerHTML = '<span>Authenticating...</span>';
    btn.style.transform = 'translateZ(25px) scale(0.95)';
    
    setTimeout(() => {
        btn.innerHTML = '<span>Success!</span>';
        btn.style.background = 'linear-gradient(135deg, #00b894, #55efc4)';
        
        // Add a burst effect to particles
        const burstSpeed = 0.05;
        const animateBurst = () => {
            particlesMesh.scale.x += burstSpeed;
            particlesMesh.scale.y += burstSpeed;
            particlesMesh.scale.z += burstSpeed;
            particlesMaterial.opacity -= 0.01;
            
            if(particlesMaterial.opacity > 0) {
                requestAnimationFrame(animateBurst);
            }
        };
        animateBurst();
        
        setTimeout(() => {
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        }, 1500);
    }, 1500);
});

// --- Social Login Logic ---
document.querySelectorAll('.social-icon').forEach(icon => {
    icon.addEventListener('click', (e) => {
        e.preventDefault();
        const socialName = icon.getAttribute('data-social') || 'Social';
        const btn = document.querySelector('.login-btn');
        
        sessionStorage.setItem('devscope_username', `${socialName} User`);
        btn.innerHTML = `<span>Authenticating with ${socialName}...</span>`;
        btn.style.transform = 'translateZ(25px) scale(0.95)';
        
        setTimeout(() => {
            btn.innerHTML = '<span>Success!</span>';
            btn.style.background = 'linear-gradient(135deg, #00b894, #55efc4)';
            
            // Add a burst effect to particles
            const burstSpeed = 0.05;
            const animateBurst = () => {
                particlesMesh.scale.x += burstSpeed;
                particlesMesh.scale.y += burstSpeed;
                particlesMesh.scale.z += burstSpeed;
                particlesMaterial.opacity -= 0.01;
                
                if(particlesMaterial.opacity > 0) {
                    requestAnimationFrame(animateBurst);
                }
            };
            animateBurst();
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        }, 1500);
    });
});
