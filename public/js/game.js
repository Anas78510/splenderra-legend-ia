// Initialisation socket.io
const socket = io();

// État du jeu
const gameState = {
    player: {
        name: '',
        isAdmin: false,
        points: 1,
        hasJoker: true,
        score: 0
    },
    game: {
        code: null,
        status: 'waiting',
        currentPlayer: null,
        regenCount: 3
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

// Initialisation du jeu
function initializeGame() {
    // Boutons écran login
    document.getElementById('joinButton').addEventListener('click', handleJoin);
    document.getElementById('createButton').addEventListener('click', handleCreate);

    // Boutons de jeu
    document.getElementById('voteButton')?.addEventListener('click', handleVote);
    document.getElementById('jokerButton')?.addEventListener('click', handleJoker);
    document.getElementById('regenButton')?.addEventListener('click', handleRegen);

    // Socket listeners
    setupSocketListeners();
}

// Gestion des événements socket
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connecté au serveur');
    });

    socket.on('gameCreated', (data) => {
        gameState.game.code = data.code;
        showGameScreen();
        UI.showNotification(`Partie créée ! Code : ${data.code}`);
    });

    socket.on('playerJoined', (data) => {
        UI.updatePlayersList(data.players);
        UI.showNotification(`${data.playerName} a rejoint la partie`);
    });

    socket.on('gameState', (state) => {
        updateGameState(state);
    });

    socket.on('missionUpdated', (mission) => {
        document.getElementById('missionText').textContent = mission.task;
        document.getElementById('suggestionText').textContent = mission.suggestion;
    });

    socket.on('timerUpdate', (time) => {
        updateTimer(time);
    });

    socket.on('error', (message) => {
        UI.showNotification(message, 'error');
    });
}

// Gestion connexion
function handleJoin() {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    const name = document.getElementById('joinName').value.trim();

    if (!code || !name) {
        UI.showNotification('Remplis tous les champs', 'error');
        return;
    }

    // Check admin login
    if (code === 'MASTER-ASCENSION-2024') {
        handleAdminLogin(name);
        return;
    }

    // Regular join
    gameState.player.name = name;
    socket.emit('joinGame', { code, name });
}

// Création de partie
function handleCreate() {
    if (!gameState.player.isAdmin) {
        UI.showNotification('Accès non autorisé', 'error');
        return;
    }

    socket.emit('createGame');
}

// Login admin
function handleAdminLogin(name) {
    gameState.player.name = name;
    gameState.player.isAdmin = true;
    UI.showNotification('Connecté comme admin');
    showGameScreen();
}

// Vote
function handleVote() {
    if (gameState.player.points < 1) {
        UI.showNotification('Plus de points disponibles', 'error');
        return;
    }

    socket.emit('vote', {
        gameCode: gameState.game.code,
        targetId: gameState.game.currentPlayer
    });

    gameState.player.points--;
    UI.updatePoints();
}

// Joker
function handleJoker() {
    if (!gameState.player.hasJoker) {
        UI.showNotification('Joker déjà utilisé', 'error');
        return;
    }

    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        UI.showNotification('Sélectionne un joueur', 'error');
        return;
    }

    socket.emit('useJoker', {
        gameCode: gameState.game.code,
        targetId: targetId
    });

    gameState.player.hasJoker = false;
    UI.updateJokerStatus();
}

// Régénération de mission
function handleRegen() {
    if (gameState.game.regenCount < 1) {
        UI.showNotification('Plus de régénérations disponibles', 'error');
        return;
    }

    socket.emit('regenerateMission', {
        gameCode: gameState.game.code
    });

    gameState.game.regenCount--;
    document.getElementById('regenCount').textContent = gameState.game.regenCount;
}

// Mise à jour timer
function updateTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('gameTimer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Mise à jour état du jeu
function updateGameState(state) {
    gameState.game = { ...gameState.game, ...state };
    UI.updateGameDisplay(state);
}

// Affichage écran de jeu
function showGameScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
}

// Export pour utilisation globale
window.gameState = gameState;