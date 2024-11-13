// Gestion du jeu Splenderra
const gameState = {
    // État joueur
    player: {
        id: null,
        name: '',
        isAdmin: false,
        credibilityPoints: 1,
        hasJoker: true,
        score: 0
    },

    // État partie
    game: {
        code: null,
        theme: 'humour',
        players: [],
        currentPlayer: null,
        status: 'waiting',
        currentMission: null,
        regenerationsLeft: 3
    }
};

// Initialisation Socket.IO
const socket = io();

// Initialisation du jeu
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initialisation Splenderra');
    setupEventListeners();
    setupSocketListeners();
    checkAdminAccess();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Connexion et création de partie
    document.getElementById('joinGame').addEventListener('click', handleJoinGame);
    document.getElementById('createGame').addEventListener('click', handleCreateGame);

    // Boutons de jeu
    document.getElementById('voteButton')?.addEventListener('click', handleVote);
    document.getElementById('useJoker')?.addEventListener('click', handleJokerUse);
    document.getElementById('regenerateMission')?.addEventListener('click', handleRegenerateMission);
}

// Configuration Socket.IO
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur');
        UI.showNotification('Connecté au serveur', 'success');
    });

    socket.on('gameState', handleGameState);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('turnStarted', handleTurnStart);
    socket.on('timerUpdate', UI.updateTimer);
    socket.on('turnEnded', handleTurnEnd);
    socket.on('scoreUpdate', handleScoreUpdate);
    socket.on('jokerUsed', handleJokerUsed);
    socket.on('missionRegenerated', handleMissionRegenerated);
    socket.on('error', handleError);
}

// Vérification accès admin
async function checkAdminAccess() {
    const credentials = localStorage.getItem('adminCredentials');
    if (credentials) {
        const { email, code } = JSON.parse(credentials);
        if (email === 'splenderra@gmail.com' && code === 'MASTER-ASCENSION-2024') {
            gameState.player.isAdmin = true;
            console.log('🔐 Accès admin activé');
        }
    }
}

// Gestion connexion/création
async function handleJoinGame() {
    const code = document.getElementById('gameCode').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim();
    const adminPass = code === 'MASTER-ASCENSION-2024';

    if (adminPass) {
        handleAdminLogin(name);
        return;
    }

    if (!code || !name) {
        UI.showNotification('Remplis tous les champs', 'error');
        return;
    }

    gameState.player.name = name;
    socket.emit('joinGame', { gameCode: code, playerName: name });
}

async function handleCreateGame() {
    if (!gameState.player.isAdmin) {
        UI.showNotification('Action non autorisée', 'error');
        return;
    }

    try {
        const response = await fetch('/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                theme: gameState.game.theme,
                settings: { 
                    voiceEnabled: true, 
                    soundEnabled: true 
                }
            })
        });

        const data = await response.json();
        if (data.success) {
            gameState.game.code = data.gameCode;
            UI.showGameScreen();
            UI.showNotification(`Partie créée ! Code : ${data.gameCode}`, 'success');
        }
    } catch (error) {
        UI.showNotification('Erreur création partie', 'error');
    }
}

async function handleAdminLogin(name) {
    const credentials = {
        email: 'splenderra@gmail.com',
        code: 'MASTER-ASCENSION-2024'
    };
    localStorage.setItem('adminCredentials', JSON.stringify(credentials));
    gameState.player.isAdmin = true;
    gameState.player.name = name;
    UI.showNotification('Connecté comme admin', 'success');
    UI.showGameScreen();
}

// Gestion des événements de jeu
function handleGameState(state) {
    gameState.game = { ...gameState.game, ...state };
    gameState.game.players = state.players;
    UI.updateGameDisplay(state);
}

function handlePlayerJoined(player) {
    if (!gameState.game.players.find(p => p.id === player.id)) {
        gameState.game.players.push(player);
    }
    UI.updatePlayersList(gameState.game.players);
    UI.showNotification(`${player.name} a rejoint la partie`, 'info');
}

function handleTurnStart(data) {
    gameState.game.currentPlayer = data.currentPlayer;
    gameState.game.currentMission = data.mission;
    UI.updateMission(data.mission);
    UI.updatePlayerStatus();

    if (data.currentPlayer === gameState.player.id) {
        UI.showPerformerControls();
        document.getElementById('regenerateMission').style.display = 
            gameState.game.regenerationsLeft > 0 ? 'block' : 'none';
    } else {
        UI.showVoterControls();
    }
}

function handleTurnEnd(playerId) {
    if (playerId === gameState.player.id) {
        UI.showNotification('Ton tour est terminé', 'info');
    }
    UI.hideMissionControls();
}

function handleScoreUpdate(data) {
    gameState.game.players = data.players;
    const player = data.players.find(p => p.id === gameState.player.id);
    if (player) {
        gameState.player.score = player.score;
        gameState.player.credibilityPoints = player.credibilityPoints;
    }
    UI.updateScores();
}

// Gestion des actions joueur
function handleVote() {
    if (gameState.player.credibilityPoints < 1) {
        UI.showNotification('Plus de points de crédibilité', 'error');
        return;
    }

    socket.emit('vote', {
        gameCode: gameState.game.code,
        voterId: gameState.player.id,
        targetId: gameState.game.currentPlayer
    });
}

function handleJokerUse() {
    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        UI.showNotification('Choisis un joueur', 'error');
        return;
    }

    if (!gameState.player.hasJoker) {
        UI.showNotification('Joker déjà utilisé', 'error');
        return;
    }

    socket.emit('useJoker', {
        gameCode: gameState.game.code,
        playerId: gameState.player.id,
        targetId
    });
}

function handleJokerUsed(data) {
    if (data.playerId === gameState.player.id) {
        gameState.player.hasJoker = false;
        UI.updateJokerStatus();
    }
    UI.showNotification(`${data.playerName} utilise son Joker sur ${data.targetName}`, 'info');
}

function handleRegenerateMission() {
    if (gameState.game.regenerationsLeft <= 0) {
        UI.showNotification('Plus de régénérations disponibles', 'error');
        return;
    }

    socket.emit('regenerateMission', {
        gameCode: gameState.game.code,
        playerId: gameState.player.id,
        level: gameState.game.currentMission.level
    });

    gameState.game.regenerationsLeft--;
    UI.updateRegenerationsLeft();
}

function handleMissionRegenerated(mission) {
    gameState.game.currentMission = mission;
    UI.updateMission(mission);
    UI.showNotification('Nouvelle mission générée', 'success');
}

function handleError(message) {
    UI.showNotification(message, 'error');
}

// Export pour utilisation globale
window.gameState = gameState;