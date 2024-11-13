// État global du jeu
const gameState = {
    // Informations utilisateur
    player: {
        id: null,
        name: '',
        type: null, // 'host' ou 'player'
        credibilityPoints: 1,
        hasJoker: true,
        isArbiter: false
    },
    
    // État de la partie
    game: {
        code: null,
        theme: null,
        status: 'waiting',
        currentPlayer: null,
        players: [],
        round: 0,
        settings: {
            voiceEnabled: false,
            soundEnabled: false
        }
    },

    // Timers et missions
    timer: null,
    currentMission: null
};

// Initialisation Socket.IO
const socket = io();

// Initialisation du jeu
function initializeGame() {
    console.log('🎮 Initialisation Splenderra : Legend IA');
    setupSocketListeners();
    setupEventListeners();
}

// Configuration des écouteurs Socket.IO
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur');
        UI.showNotification('Connecté au serveur', 'success');
    });

    // Gestion connexion joueur
    socket.on('playerConnected', (data) => {
        console.log('👤 Joueur connecté:', data);
        handlePlayerConnection(data);
    });

    // Mise à jour état partie
    socket.on('gameState', (state) => {
        console.log('🔄 Mise à jour état:', state);
        updateGameState(state);
    });

    // Démarrage tour
    socket.on('turnStarted', (data) => {
        console.log('🎯 Tour démarré:', data);
        handleTurnStart(data);
    });

    // Timer
    socket.on('timerUpdate', (timeLeft) => {
        UI.updateTimer(timeLeft);
    });

    // Votes et scores
    socket.on('voteRegistered', (data) => {
        console.log('🗳️ Vote enregistré:', data);
        handleVoteRegistration(data);
    });

    socket.on('scoreUpdate', (data) => {
        console.log('📊 Scores mis à jour:', data);
        updateScores(data);
    });

    // Joker
    socket.on('jokerUsed', (data) => {
        console.log('🃏 Joker utilisé:', data);
        handleJokerUsed(data);
    });

    // Arbitre
    socket.on('arbiterAssigned', (data) => {
        console.log('👑 Nouvel arbitre:', data);
        handleArbiterAssignment(data);
    });

    // Erreurs
    socket.on('error', (message) => {
        console.error('❌ Erreur:', message);
        UI.showNotification(message, 'error');
    });
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Connexion hôte
    document.getElementById('hostLogin')?.addEventListener('click', () => {
        const email = document.getElementById('hostEmail').value;
        const key = document.getElementById('activationKey').value;
        loginAsHost(email, key);
    });

    // Connexion joueur
    document.getElementById('playerJoin')?.addEventListener('click', () => {
        const code = document.getElementById('inviteCode').value;
        const name = document.getElementById('playerName').value;
        joinGame(code, name);
    });

    // Création partie (hôte)
    document.getElementById('createGame')?.addEventListener('click', createGame);

    // Vote
    document.getElementById('voteButton')?.addEventListener('click', vote);
    document.getElementById('arbiterVoteYes')?.addEventListener('click', () => arbiterVote(true));
    document.getElementById('arbiterVoteNo')?.addEventListener('click', () => arbiterVote(false));

    // Joker
    document.getElementById('useJoker')?.addEventListener('click', useJoker);
}

// Connexion en tant qu'hôte
async function loginAsHost(email, key) {
    console.log('🔑 Tentative connexion hôte...');
    try {
        const response = await fetch('/host/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, key })
        });

        const data = await response.json();
        if (data.success) {
            gameState.player.type = 'host';
            gameState.player.id = data.hostId;
            UI.showHostConfig();
            UI.showNotification('Connecté en tant qu\'hôte', 'success');
        } else {
            UI.showNotification('Clé d\'activation invalide', 'error');
        }
    } catch (error) {
        console.error('❌ Erreur connexion hôte:', error);
        UI.showNotification('Erreur de connexion', 'error');
    }
}

// Rejoindre une partie
function joinGame(code, name) {
    if (!code || !name) {
        UI.showNotification('Code et pseudo requis', 'error');
        return;
    }

    console.log('🎮 Tentative de connexion:', { code, name });
    gameState.player.name = name;
    socket.emit('joinGame', { code, name });
}

// Création de partie (hôte)
async function createGame() {
    if (gameState.player.type !== 'host') return;

    const theme = document.getElementById('gameTheme').value;
    const settings = {
        voiceEnabled: document.getElementById('voiceEnabled').checked,
        soundEnabled: document.getElementById('soundEnabled').checked
    };

    console.log('🎲 Création partie:', { theme, settings });
    
    try {
        const response = await fetch('/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme, settings })
        });

        const data = await response.json();
        if (data.success) {
            gameState.game.code = data.gameCode;
            UI.showInviteCode(data.gameCode);
            UI.showNotification('Partie créée avec succès', 'success');
            socket.emit('hostGame', data.gameCode);
        }
    } catch (error) {
        console.error('❌ Erreur création partie:', error);
        UI.showNotification('Erreur lors de la création', 'error');
    }
}

// Gestion des tours
function handleTurnStart(data) {
    gameState.currentMission = data.mission;
    gameState.game.currentPlayer = data.playerId;
    
    UI.updateMission(data.mission);
    UI.updatePlayerStatus(data.playerId);

    // Activation des contrôles selon le rôle
    if (data.playerId === gameState.player.id) {
        UI.showPerformerControls();
        if (gameState.player.hasJoker) UI.showJokerSection();
    } else if (gameState.player.isArbiter) {
        UI.showArbiterControls();
    } else {
        UI.showVoterControls();
    }

    // Synthèse vocale si activée
    if (gameState.game.settings.voiceEnabled) {
        speakMission(data.mission);
    }
}

// Système de vote
function vote() {
    if (!gameState.game.currentPlayer || gameState.player.credibilityPoints < 1) return;
    
    console.log('🗳️ Vote pour:', gameState.game.currentPlayer);
    socket.emit('vote', {
        gameCode: gameState.game.code,
        voterId: gameState.player.id,
        targetId: gameState.game.currentPlayer
    });
}

// Vote de l'arbitre
function arbiterVote(isPositive) {
    if (!gameState.player.isArbiter) return;
    
    console.log('👑 Vote arbitre:', isPositive);
    socket.emit('arbiterVote', {
        gameCode: gameState.game.code,
        isPositive
    });
}

// Utilisation du Joker
function useJoker() {
    if (!gameState.player.hasJoker) return;
    
    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        UI.showNotification('Sélectionne un joueur', 'error');
        return;
    }

    console.log('🃏 Utilisation Joker sur:', targetId);
    socket.emit('useJoker', {
        gameCode: gameState.game.code,
        targetId
    });
}

// Mise à jour de l'état du jeu
function updateGameState(state) {
    gameState.game = { ...gameState.game, ...state };
    UI.updateGameDisplay(state);
    updatePlayersList();
}

// Mise à jour de la liste des joueurs
function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;

    playersList.innerHTML = '';
    gameState.game.players.forEach(player => {
        const playerCard = UI.createPlayerCard(player);
        playersList.appendChild(playerCard);
    });

    // Mise à jour liste Joker
    if (gameState.player.hasJoker) {
        updateJokerTargetList();
    }
}

// Synthèse vocale pour les missions
function speakMission(mission) {
    if (!gameState.game.settings.voiceEnabled) return;
    
    const speech = new SpeechSynthesisUtterance();
    speech.text = mission.task;
    speech.lang = 'fr-FR';
    window.speechSynthesis.speak(speech);
}

// Export pour utilisation globale
window.gameState = gameState;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initializeGame);