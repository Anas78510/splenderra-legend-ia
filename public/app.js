// Connexion socket
const socket = io();

// État du jeu
const gameState = {
    code: null,
    playerId: null,
    playerName: '',
    hasJoker: true
};

// Au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Boutons login
    document.getElementById('joinBtn').addEventListener('click', joinGame);
    document.getElementById('createBtn').addEventListener('click', createGame);
    
    // Boutons jeu
    document.getElementById('voteBtn').addEventListener('click', vote);
    document.getElementById('jokerBtn').addEventListener('click', useJoker);
});

// Création partie
function createGame() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        alert('Entre un pseudo');
        return;
    }
    gameState.playerName = name;
    socket.emit('createGame');
}

// Rejoindre partie
function joinGame() {
    const code = document.getElementById('gameCode').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim();
    
    if (!code || !name) {
        alert('Remplis tous les champs');
        return;
    }

    // Admin login
    if (code === 'MASTER-ASCENSION-2024') {
        createGame();
        return;
    }

    gameState.playerName = name;
    socket.emit('joinGame', { code, name });
}

// Vote
function vote() {
    if (!gameState.code) return;
    socket.emit('vote', {
        gameCode: gameState.code,
        targetId: gameState.currentPlayer
    });
}

// Joker
function useJoker() {
    if (!gameState.hasJoker || !gameState.code) return;
    socket.emit('useJoker', { gameCode: gameState.code });
    gameState.hasJoker = false;
    document.getElementById('jokerBtn').disabled = true;
}

// Gestion des événements socket
socket.on('gameCreated', (data) => {
    gameState.code = data.code;
    showGameScreen();
    document.getElementById('missionText').textContent = 
        `Code partie : ${data.code}`;
});

socket.on('playerJoined', (data) => {
    updatePlayerList(data.players);
    if (data.newPlayer.name === gameState.playerName) {
        showGameScreen();
    }
});

socket.on('missionReceived', (mission) => {
    document.getElementById('missionText').textContent = mission.task;
});

socket.on('scoreUpdated', (players) => {
    updatePlayerList(players);
});

socket.on('error', (message) => {
    alert(message);
});

// Fonctions d'interface
function showGameScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
}

function updatePlayerList(players) {
    const list = document.getElementById('playerList');
    list.innerHTML = '';
    
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-700 p-3 rounded';
        div.innerHTML = `
            <span>${player.name}</span>
            <span class="bg-purple-600 px-3 py-1 rounded">${player.score}</span>
        `;
        list.appendChild(div);
    });
}