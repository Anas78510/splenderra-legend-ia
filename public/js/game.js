// Initialisation Socket.IO et variables globales
const socket = io();
let gameState = {
    currentPlayer: null,
    players: [],
    gameCode: null,
    hasJoker: true,
    credibilityPoints: 1,
    isPlaying: false,
    timer: null
};

// Gestion des événements au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initialisation du jeu...');
    initializeGame();
});

function initializeGame() {
    // Boutons principaux
    const createGameBtn = document.getElementById('createGame');
    const joinGameBtn = document.getElementById('joinGame');
    const voteButton = document.getElementById('voteButton');
    const useJokerBtn = document.getElementById('useJoker');

    console.log('🔄 Configuration des boutons...');
    
    // Événement création de partie
    if (createGameBtn) {
        createGameBtn.addEventListener('click', async () => {
            console.log('👆 Clic sur Créer une partie');
            createGameBtn.disabled = true; // Éviter double-clic
            try {
                console.log('🎲 Envoi requête création...');
                const response = await fetch('/game/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('📥 Réponse reçue:', response);
                
                const data = await response.json();
                console.log('📦 Données reçues:', data);
                
                if (data.success) {
                    gameState.gameCode = data.gameCode;
                    console.log('✅ Partie créée:', gameState.gameCode);
                    UI.showNotification(`Partie créée ! Code : ${data.gameCode}`, 'success');
                    showGameScreen();
                    updateGameCodeDisplay();
                } else {
                    console.error('❌ Erreur création:', data.error);
                    UI.showNotification(data.error || 'Erreur lors de la création', 'error');
                }
            } catch (error) {
                console.error('❌ Erreur création partie:', error);
                UI.showNotification('Erreur serveur', 'error');
            } finally {
                createGameBtn.disabled = false;
            }
        });
    }

    // Événement rejoindre partie
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', () => {
            console.log('👆 Clic sur Rejoindre partie');
            const gameCode = document.getElementById('gameCodeInput').value.trim().toUpperCase();
            const playerName = document.getElementById('playerNameInput').value.trim();
            
            if (!gameCode || !playerName) {
                UI.showNotification('Remplis tous les champs', 'error');
                return;
            }
            
            console.log('🎮 Tentative connexion:', { gameCode, playerName });
            gameState.gameCode = gameCode;
            socket.emit('joinGame', gameCode, playerName);
        });
    }

    // Événements de vote et Joker
    if (voteButton) voteButton.addEventListener('click', vote);
    if (useJokerBtn) useJokerBtn.addEventListener('click', useJoker);

    // Événements Socket.IO
    initializeSocketEvents();
}

function initializeSocketEvents() {
    console.log('🔌 Configuration Socket.IO...');

    socket.on('connect', () => {
        console.log('✅ Connecté au serveur');
        UI.showNotification('Connecté au serveur', 'success');
    });

    socket.on('gameCreated', (data) => {
        console.log('🎮 Partie créée:', data);
        handleGameCreated(data);
    });

    socket.on('playerJoined', (player) => {
        console.log('👋 Joueur rejoint:', player);
        handlePlayerJoined(player);
    });

    socket.on('gameState', (state) => {
        console.log('🔄 Mise à jour état:', state);
        handleGameState(state);
    });

    socket.on('turnStarted', (data) => {
        console.log('🎯 Tour commencé:', data);
        handleTurnStarted(data);
    });

    socket.on('timerUpdate', (timeLeft) => {
        updateTimer(timeLeft);
    });

    socket.on('turnEnded', (playerId) => {
        console.log('🏁 Tour terminé:', playerId);
        handleTurnEnded(playerId);
    });

    socket.on('scoreUpdate', (data) => {
        console.log('📊 Scores mis à jour:', data);
        updateScores(data);
    });

    socket.on('jokerUsed', (data) => {
        console.log('🃏 Joker utilisé:', data);
        handleJokerUsed(data);
    });

    socket.on('error', (message) => {
        console.error('❌ Erreur socket:', message);
        UI.showNotification(message, 'error');
    });
}

// Fonctions de gestion du jeu
function showGameScreen() {
    console.log('📱 Affichage écran de jeu');
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('gameScreen')?.classList.remove('hidden');
}

function updateGameCodeDisplay() {
    const gameCodeElement = document.getElementById('gameCode');
    if (gameCodeElement) {
        gameCodeElement.textContent = `Code: ${gameState.gameCode}`;
    }
}

function handleGameCreated(data) {
    console.log('🎮 Traitement création partie:', data);
    gameState.gameCode = data.gameCode;
    showGameScreen();
    updateGameCodeDisplay();
}

function handlePlayerJoined(player) {
    console.log('👥 Ajout joueur:', player);
    gameState.players.push(player);
    updatePlayersList();
    UI.showNotification(`${player.name} a rejoint la partie !`, 'info');
}

function handleGameState(state) {
    console.log('🔄 Mise à jour état du jeu:', state);
    gameState.players = state.players;
    gameState.currentPlayer = state.currentPlayer;
    updatePlayersList();
    updateGameStatus();
}

function handleTurnStarted(data) {
    console.log('🎯 Début du tour:', data);
    const { currentPlayer, mission, level } = data;
    gameState.currentPlayer = currentPlayer;
    
    if (document.getElementById('missionText')) {
        document.getElementById('missionText').textContent = mission.task;
    }
    if (document.getElementById('suggestionText')) {
        document.getElementById('suggestionText').textContent = mission.suggestion;
    }

    updatePlayerStatus();
    showMissionSection();

    if (currentPlayer === socket.id) {
        console.log('🎭 C\'est mon tour !');
        enablePerformanceControls();
    } else {
        console.log('👀 Tour d\'un autre joueur');
        enableVotingControls();
    }
}

function updateTimer(timeLeft) {
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay) return;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 10) {
        timerDisplay.classList.add('text-red-500', 'animate__animated', 'animate__pulse');
    }
}

function vote() {
    console.log('🗳️ Tentative de vote');
    if (gameState.credibilityPoints < 1) {
        UI.showNotification('Tu n\'as plus de points de crédibilité', 'error');
        return;
    }
    
    socket.emit('vote', gameState.gameCode, socket.id, gameState.currentPlayer);
    document.getElementById('voteButton').disabled = true;
}

function useJoker() {
    console.log('🃏 Tentative utilisation Joker');
    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        UI.showNotification('Choisis un joueur', 'error');
        return;
    }
    
    if (!gameState.hasJoker) {
        UI.showNotification('Tu as déjà utilisé ton Joker', 'error');
        return;
    }
    
    socket.emit('useJoker', gameState.gameCode, socket.id, targetId);
    gameState.hasJoker = false;
    updateJokerStatus();
}

function updateScores(data) {
    console.log('📊 Mise à jour scores:', data);
    gameState.players = data.players;
    updatePlayersList();
    updatePlayerScore();
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    if (!container) return;

    console.log('👥 Mise à jour liste joueurs');
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `flex justify-between items-center p-3 rounded-lg transition-all ${
            player._id === gameState.currentPlayer ? 'player-active bg-purple-900 bg-opacity-50' : ''
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
    
    updateJokerTargetList();
}

function updateJokerTargetList() {
    const select = document.getElementById('jokerTarget');
    if (!select) return;

    console.log('🃏 Mise à jour liste Joker');
    select.innerHTML = '<option value="">Choisir un joueur</option>';
    
    gameState.players
        .filter(p => p._id !== socket.id && p.isConnected)
        .forEach(player => {
            const option = document.createElement('option');
            option.value = player._id;
            option.textContent = player.name;
            select.appendChild(option);
        });
}

function updatePlayerStatus() {
    const currentPlayerElement = document.getElementById('currentPlayer');
    if (currentPlayerElement) {
        const player = gameState.players.find(p => p._id === gameState.currentPlayer);
        if (player) {
            currentPlayerElement.textContent = `Au tour de : ${player.name}`;
        }
    }
}

function showMissionSection() {
    const missionSection = document.getElementById('currentMission');
    if (missionSection) {
        missionSection.classList.remove('hidden');
    }
}

function enablePerformanceControls() {
    const voteSection = document.getElementById('voteSection');
    if (voteSection) voteSection.classList.add('hidden');
    
    const jokerSection = document.getElementById('jokerSection');
    if (jokerSection && gameState.hasJoker) jokerSection.classList.remove('hidden');
}

function enableVotingControls() {
    const voteSection = document.getElementById('voteSection');
    if (voteSection) voteSection.classList.remove('hidden');
    
    const jokerSection = document.getElementById('jokerSection');
    if (jokerSection) jokerSection.classList.add('hidden');
}

function updateJokerStatus() {
    const jokerButton = document.getElementById('useJoker');
    if (jokerButton) {
        jokerButton.disabled = !gameState.hasJoker;
        jokerButton.classList.toggle('opacity-50', !gameState.hasJoker);
    }
}

function updatePlayerScore() {
    const scoreElement = document.getElementById('playerScore');
    if (scoreElement) {
        const player = gameState.players.find(p => p._id === socket.id);
        if (player) {
            scoreElement.textContent = `Score: ${player.score}`;
        }
    }
}

function updateGameStatus() {
    const statusElement = document.getElementById('gameStatus');
    if (statusElement) {
        statusElement.textContent = `Partie ${gameState.gameCode} - ${gameState.players.length} joueurs`;
    }
}

// Export pour utilisation globale
window.gameState = gameState;