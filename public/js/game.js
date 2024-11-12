// Initialisation Socket.IO et variables globales
const socket = io();
const gameState = {
    currentPlayer: null,
    players: [],
    gameCode: null,
    hasJoker: true,
    credibilityPoints: 1,
    isPlaying: false,
    timer: null
};

// Gestionnaire de connexion au jeu
function initializeGame() {
    // Écouteurs d'événements pour connexion joueur
    document.getElementById('joinGame').addEventListener('click', joinExistingGame);
    document.getElementById('createGame').addEventListener('click', createNewGame);
    document.getElementById('voteButton').addEventListener('click', vote);
    document.getElementById('useJoker').addEventListener('click', useJoker);
    
    // Gestion timer
    let countdown;
    
    // Écouteurs Socket.IO
    socket.on('connect', () => {
        showNotification('Connecté au serveur', 'success');
    });

    socket.on('gameCreated', handleGameCreated);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('gameState', handleGameState);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('timerUpdate', updateTimer);
    socket.on('turnEnded', handleTurnEnded);
    socket.on('scoreUpdate', updateScores);
    socket.on('jokerUsed', handleJokerUsed);
    socket.on('error', handleError);
}

// Fonctions de gestion du jeu
async function createNewGame() {
    try {
        const response = await fetch('/game/create', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            gameState.gameCode = data.gameCode;
            showGameScreen();
            showNotification(`Partie créée ! Code : ${data.gameCode}`, 'success');
            updateGameCodeDisplay();
        }
    } catch (error) {
        showNotification('Erreur lors de la création de la partie', 'error');
    }
}

async function joinExistingGame() {
    const gameCode = document.getElementById('gameCodeInput').value.trim().toUpperCase();
    const playerName = document.getElementById('playerNameInput').value.trim();
    
    if (!gameCode || !playerName) {
        showNotification('Remplis tous les champs', 'error');
        return;
    }
    
    gameState.gameCode = gameCode;
    socket.emit('joinGame', gameCode, playerName);
}

function handleGameCreated(data) {
    gameState.gameCode = data.gameCode;
    showGameScreen();
    updateGameCodeDisplay();
}

function handlePlayerJoined(player) {
    gameState.players.push(player);
    updatePlayersList();
    showNotification(`${player.name} a rejoint la partie !`, 'info');
}

function handleGameState(state) {
    gameState.players = state.players;
    gameState.currentPlayer = state.currentPlayer;
    updatePlayersList();
    updateGameStatus();
}

function handleTurnStarted(data) {
    const { currentPlayer, mission, level } = data;
    gameState.currentPlayer = currentPlayer;
    
    // Afficher la mission
    document.getElementById('missionText').textContent = mission.task;
    document.getElementById('suggestionText').textContent = mission.suggestion;
    
    // Mettre à jour l'interface
    updatePlayerStatus();
    showMissionSection();
    
    // Activer/désactiver les contrôles selon le joueur actif
    if (currentPlayer === socket.id) {
        enablePerformanceControls();
    } else {
        enableVotingControls();
    }
}

function updateTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerDisplay = document.getElementById('timer');
    
    // Animation du timer
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Animation selon le temps restant
    if (timeLeft <= 10) {
        timerDisplay.classList.add('text-red-500', 'animate-pulse');
    }
}

function vote() {
    if (gameState.credibilityPoints < 1) {
        showNotification('Tu n\'as plus de points de crédibilité', 'error');
        return;
    }
    
    socket.emit('vote', gameState.gameCode, socket.id, gameState.currentPlayer);
    document.getElementById('voteButton').disabled = true;
}

function useJoker() {
    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        showNotification('Choisis un joueur', 'error');
        return;
    }
    
    if (!gameState.hasJoker) {
        showNotification('Tu as déjà utilisé ton Joker', 'error');
        return;
    }
    
    socket.emit('useJoker', gameState.gameCode, socket.id, targetId);
    gameState.hasJoker = false;
    updateJokerStatus();
}

function updateScores(data) {
    gameState.players = data.players;
    updatePlayersList();
    updatePlayerScore();
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `flex justify-between items-center p-3 rounded-lg transition-all ${
            player.id === gameState.currentPlayer ? 'player-active' : ''
        }`;
        
        playerDiv.innerHTML = `
            <div class="flex items-center">
                <span class="font-medium ${player.isConnected ? '' : 'text-gray-500'}">${player.name}</span>
                ${player.hasJoker ? '<span class="ml-2 text-blue-400">🃏</span>' : ''}
            </div>
            <span class="score-badge">${player.score}</span>
        `;
        
        container.appendChild(playerDiv);
    });
    
    // Mise à jour liste Joker
    updateJokerTargetList();
}

function updateJokerTargetList() {
    const select = document.getElementById('jokerTarget');
    select.innerHTML = '<option value="">Choisir un joueur</option>';
    
    gameState.players
        .filter(p => p.id !== socket.id && p.isConnected)
        .forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);
        });
}

function handleError(message) {
    showNotification(message, 'error');
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initializeGame);