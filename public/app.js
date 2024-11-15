// Connexion socket
const socket = io();

// Éléments DOM
const gameForm = document.getElementById('gameForm');
const codeInput = document.getElementById('gameCode');
const nameInput = document.getElementById('playerName');
const gameArea = document.getElementById('gameArea');
const playersList = document.getElementById('playersList');
const missionDisplay = document.getElementById('missionDisplay');

// État du jeu
let isAdmin = false;
let gameState = {
    players: [],
    currentMission: null,
    timeLeft: 120
};

// Gestion du formulaire
gameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value;
    const name = nameInput.value;

    if (!code || !name) {
        alert('Code et nom requis');
        return;
    }

    // Vérification admin
    if (code === 'MASTER-ASCENSION-2024') {
        isAdmin = true;
        socket.emit('createGame', { name });
    } else {
        socket.emit('joinGame', { code, name });
    }
});

// Événements socket
socket.on('gameCreated', ({ code }) => {
    alert(`Partie créée ! Code: ${code}`);
    showGameArea();
});

socket.on('joinedGame', () => {
    showGameArea();
});

socket.on('gameError', ({ message }) => {
    alert(message);
});

socket.on('updateGame', (newState) => {
    gameState = newState;
    updateUI();
});

// Fonctions UI
function showGameArea() {
    gameForm.style.display = 'none';
    gameArea.style.display = 'block';
}

function updateUI() {
    // Mise à jour liste joueurs
    playersList.innerHTML = gameState.players
        .map(p => `<div>${p.name} - ${p.score}pts</div>`)
        .join('');

    // Affichage mission
    if (gameState.currentMission) {
        missionDisplay.innerHTML = `
            <h3>Mission Niveau ${gameState.currentMission.level}</h3>
            <p>${gameState.currentMission.task}</p>
            <p><em>Suggestion: ${gameState.currentMission.suggestion}</em></p>
        `;
    }
}

// Gestion des erreurs socket
socket.on('connect_error', (error) => {
    console.error('Erreur connexion:', error);
    alert('Erreur de connexion au serveur');
});// Connexion socket
const socket = io();

// Éléments DOM
const gameForm = document.getElementById('gameForm');
const codeInput = document.getElementById('gameCode');
const nameInput = document.getElementById('playerName');
const gameArea = document.getElementById('gameArea');
const playersList = document.getElementById('playersList');
const missionDisplay = document.getElementById('missionDisplay');

// État du jeu
let isAdmin = false;
let gameState = {
    players: [],
    currentMission: null,
    timeLeft: 120
};

// Gestion du formulaire
gameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value;
    const name = nameInput.value;

    if (!code || !name) {
        alert('Code et nom requis');
        return;
    }

    // Vérification admin
    if (code === 'MASTER-ASCENSION-2024') {
        isAdmin = true;
        socket.emit('createGame', { name });
    } else {
        socket.emit('joinGame', { code, name });
    }
});

// Événements socket
socket.on('gameCreated', ({ code }) => {
    alert(`Partie créée ! Code: ${code}`);
    showGameArea();
});

socket.on('joinedGame', () => {
    showGameArea();
});

socket.on('gameError', ({ message }) => {
    alert(message);
});

socket.on('updateGame', (newState) => {
    gameState = newState;
    updateUI();
});

// Fonctions UI
function showGameArea() {
    gameForm.style.display = 'none';
    gameArea.style.display = 'block';
}

function updateUI() {
    // Mise à jour liste joueurs
    playersList.innerHTML = gameState.players
        .map(p => `<div>${p.name} - ${p.score}pts</div>`)
        .join('');

    // Affichage mission
    if (gameState.currentMission) {
        missionDisplay.innerHTML = `
            <h3>Mission Niveau ${gameState.currentMission.level}</h3>
            <p>${gameState.currentMission.task}</p>
            <p><em>Suggestion: ${gameState.currentMission.suggestion}</em></p>
        `;
    }
}

// Gestion des erreurs socket
socket.on('connect_error', (error) => {
    console.error('Erreur connexion:', error);
    alert('Erreur de connexion au serveur');
});