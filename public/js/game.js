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
    console.log('🎮 Initialisation du jeu');
    initializeGame();
});

// Initialisation du jeu
function initializeGame() {
    // Boutons écran login
    const joinButton = document.getElementById('joinButton');
    const createButton = document.getElementById('createButton');

    if (joinButton) {
        joinButton.addEventListener('click', () => {
            console.log('👆 Clic sur Rejoindre');
            handleJoin();
        });
    }

    if (createButton) {
        createButton.addEventListener('click', () => {
            console.log('👆 Clic sur Créer');
            handleJoin(); // On utilise handleJoin pour tout
        });
    }

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
        console.log('✅ Connecté au serveur');
    });

    socket.on('gameCreated', (data) => {
        console.log('🎮 Partie créée:', data);
        gameState.game.code = data.code;
        showGameScreen();
        UI.showNotification(`Partie créée ! Code : ${data.code}`);
    });

    socket.on('playerJoined', (data) => {
        console.log('👥 Joueur rejoint:', data);
        UI.updatePlayersList(data.players);
        UI.showNotification(`${data.playerName} a rejoint la partie`);
    });

    socket.on('gameState', (state) => {
        console.log('🔄 Mise à jour état:', state);
        updateGameState(state);
    });

    socket.on('missionUpdated', (mission) => {
        console.log('📜 Nouvelle mission:', mission);
        document.getElementById('missionText').textContent = mission.task;
        document.getElementById('suggestionText').textContent = mission.suggestion;
    });

    socket.on('timerUpdate', (time) => {
        updateTimer(time);
    });

    socket.on('error', (message) => {
        console.error('❌ Erreur:', message);
        UI.showNotification(message, 'error');
    });
}

// Gestion connexion - CORRIGÉ
function handleJoin() {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    const name = document.getElementById('joinName').value.trim();

    console.log('🔑 Tentative connexion:', { code, name });

    if (!name) {
        UI.showNotification('Entre un pseudo', 'error');
        return;
    }

    // Code admin spécial
    if (code === 'MASTER-ASCENSION-2024') {
        console.log('👑 Connexion admin');
        gameState.player.isAdmin = true;
        gameState.player.name = name;
        socket.emit('createGame');
        return;
    }

    // Si c'est un clic sur "Nouvelle partie" sans code
    if (!code && gameState.player.isAdmin) {
        console.log('🎲 Création nouvelle partie');
        socket.emit('createGame');
        return;
    }

    // Connexion normale avec code
    if (!code) {
        UI.showNotification('Entre un code de partie', 'error');
        return;
    }

    console.log('👤 Connexion joueur normale');
    gameState.player.name = name;
    socket.emit('joinGame', { code, name });
}

// Vote
function handleVote() {
    if (gameState.player.points < 1) {
        UI.showNotification('Plus de points disponibles', 'error');
        return;
    }

    console.log('🗳️ Vote pour le joueur actuel');
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

    console.log('🃏 Utilisation Joker sur:', targetId);
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

    console.log('🎲 Régénération mission');
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
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('gameTimer').textContent = display;
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