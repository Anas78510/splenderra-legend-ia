// Connexion socket.io
const socket = io();

// État du jeu
const gameState = {
    player: {
        id: null,
        name: '',
        level: 1,
        points: 1,
        score: 0,
        hasJoker: true,
        isArbiter: false
    },
    game: {
        code: null,
        status: 'waiting',
        currentPlayer: null,
        regenCount: 3
    }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupSocketListeners();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Boutons connexion
    document.getElementById('joinBtn').addEventListener('click', handleJoin);
    document.getElementById('createBtn').addEventListener('click', handleJoin);

    // Boutons jeu
    document.getElementById('voteBtn')?.addEventListener('click', handleVote);
    document.getElementById('arbiterValidate')?.addEventListener('click', () => handleArbiterVote(true));
    document.getElementById('arbiterInvalidate')?.addEventListener('click', () => handleArbiterVote(false));
    document.getElementById('jokerBtn')?.addEventListener('click', handleJoker);
    document.getElementById('regenBtn')?.addEventListener('click', handleRegen);

    // Stats
    document.getElementById('closeStats')?.addEventListener('click', () => {
        document.getElementById('statsScreen').classList.add('hidden');
    });
}

// Configuration des écouteurs socket
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur');
    });

    socket.on('gameUpdated', handleGameUpdate);
    socket.on('turnStarted', handleTurnStart);
    socket.on('timerUpdate', updateTimer);
    socket.on('turnCompleted', handleTurnEnd);
    socket.on('voteRegistered', handleVoteRegistered);
    socket.on('jokerUsed', handleJokerUsed);
    socket.on('missionRegenerated', handleMissionRegen);
    socket.on('playerDisconnected', handlePlayerDisconnect);
    socket.on('error', handleError);
}

// Gestion connexion
function handleJoin() {
    const code = document.getElementById('gameCode').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim();

    if (!name) {
        showNotification('Entre un pseudo', 'error');
        return;
    }

    // Connexion admin
    if (code === 'MASTER-ASCENSION-2024') {
        socket.emit('createGame', { name });
        return;
    }

    // Connexion normale
    if (!code) {
        showNotification('Entre un code de partie', 'error');
        return;
    }

    gameState.player.name = name;
    socket.emit('joinGame', { code, name });
}

// Mise à jour du jeu
function handleGameUpdate(data) {
    const { game, newPlayer } = data;
    
    gameState.game.code = game.code;
    gameState.game.status = game.status;
    
    if (newPlayer?.name === gameState.player.name) {
        gameState.player.id = newPlayer.id;
        gameState.player.isArbiter = newPlayer.isArbiter;
        showGameScreen();
    }

    updatePlayersList(game.players);
    updatePlayerStatus();
}

// Démarrage d'un tour
function handleTurnStart(data) {
    const { player, mission } = data;
    
    gameState.game.currentPlayer = player.id;
    document.getElementById('missionText').textContent = mission.task;
    document.getElementById('suggestionText').textContent = mission.suggestion;
    document.getElementById('regenCount').textContent = `${mission.regenerationsLeft} régénérations`;

    // Mise à jour contrôles
    if (player.id === gameState.player.id) {
        showPerformerControls();
    } else if (gameState.player.isArbiter) {
        showArbiterControls();
    } else {
        showVoterControls();
    }

    // Animation de la mission
    const missionCard = document.getElementById('missionCard');
    missionCard.classList.add('animate__animated', 'animate__fadeIn');
    setTimeout(() => {
        missionCard.classList.remove('animate__animated', 'animate__fadeIn');
    }, 1000);
}

// Vote normal
function handleVote() {
    if (gameState.player.points < 1) {
        showNotification('Plus de points disponibles', 'error');
        return;
    }

    socket.emit('vote', {
        gameCode: gameState.game.code,
        voterId: gameState.player.id,
        targetId: gameState.game.currentPlayer,
        isArbiter: false
    });
}

// Vote arbitre
function handleArbiterVote(isValid) {
    if (!gameState.player.isArbiter) return;

    socket.emit('vote', {
        gameCode: gameState.game.code,
        voterId: gameState.player.id,
        targetId: gameState.game.currentPlayer,
        isArbiter: true,
        success: isValid
    });
}

// Utilisation joker
function handleJoker() {
    if (!gameState.player.hasJoker) {
        showNotification('Joker déjà utilisé', 'error');
        return;
    }

    const targetId = document.getElementById('jokerTarget').value;
    if (!targetId) {
        showNotification('Choisis un joueur', 'error');
        return;
    }

    socket.emit('useJoker', {
        gameCode: gameState.game.code,
        playerId: gameState.player.id,
        targetId: targetId
    });
}

// Régénération mission
function handleRegen() {
    if (gameState.game.regenCount < 1) {
        showNotification('Plus de régénérations disponibles', 'error');
        return;
    }

    socket.emit('regenerateMission', {
        gameCode: gameState.game.code,
        playerId: gameState.player.id
    });
}

// Mise à jour timer
function updateTimer(timeLeft) {
    const timer = document.getElementById('gameTimer');
    if (!timer) return;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 30) {
        timer.classList.add('text-yellow-400');
    }
    if (timeLeft <= 10) {
        timer.classList.remove('text-yellow-400');
        timer.classList.add('text-red-400', 'animate__animated', 'animate__pulse');
    }
}

// Gestion vote enregistré
function handleVoteRegistered(data) {
    const { target, voter, pointsAdded } = data;

    if (voter.id === gameState.player.id) {
        gameState.player.points--;
        updatePlayerStatus();
    }

    if (target.id === gameState.player.id) {
        gameState.player.score += pointsAdded;
        showNotification(`+${pointsAdded} points !`, 'success');
    }

    updatePlayersList(data.players);
}

// Gestion joker utilisé
function handleJokerUsed(data) {
    const { player, target } = data;

    if (player.id === gameState.player.id) {
        gameState.player.hasJoker = false;
        document.getElementById('jokerBtn').classList.add('opacity-50');
    }

    showNotification(
        `${player.name} utilise son Joker sur ${target.name}`, 
        'info'
    );
}

// Gestion régénération mission
function handleMissionRegen(data) {
    const { mission, regenerationsLeft } = data;

    document.getElementById('missionText').textContent = mission.task;
    document.getElementById('suggestionText').textContent = mission.suggestion;
    document.getElementById('regenCount').textContent = `${regenerationsLeft} régénérations`;
    gameState.game.regenCount = regenerationsLeft;

    // Animation
    const missionCard = document.getElementById('missionCard');
    missionCard.classList.add('animate__animated', 'animate__fadeIn');
    setTimeout(() => {
        missionCard.classList.remove('animate__animated', 'animate__fadeIn');
    }, 1000);
}

// Mise à jour liste joueurs
function updatePlayersList(players) {
    const container = document.getElementById('playersList');
    if (!container) return;

    container.innerHTML = '';
    
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-3 rounded-lg bg-gray-700 bg-opacity-50
            ${player.id === gameState.game.currentPlayer ? 'border-l-4 border-purple-500' : ''}`;

        div.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="font-medium">
                    ${player.name}
                    ${player.isArbiter ? '👑' : ''}
                    ${player.hasJoker ? '🃏' : ''}
                </span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="bg-blue-600 px-2 py-1 rounded-full text-sm">
                    Niv. ${player.level}
                </span>
                <span class="bg-purple-600 px-2 py-1 rounded-full">
                    ${player.score}
                </span>
            </div>
        `;

        container.appendChild(div);
    });

    // Mise à jour liste joker
    updateJokerTargets(players);
}

// Mise à jour cibles joker
function updateJokerTargets(players) {
    const select = document.getElementById('jokerTarget');
    if (!select) return;

    select.innerHTML = '<option value="">Choisir un joueur</option>';
    
    players
        .filter(p => p.id !== gameState.player.id)
        .forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);
        });
}

// Mise à jour statut joueur
function updatePlayerStatus() {
    const playerName = document.getElementById('playerName');
    const playerLevel = document.getElementById('playerLevel');
    const playerPoints = document.getElementById('playerPoints');
    const pointsLeft = document.getElementById('pointsLeft');

    if (playerName) playerName.textContent = gameState.player.name;
    if (playerLevel) playerLevel.textContent = `Niveau ${gameState.player.level}`;
    if (playerPoints) playerPoints.textContent = `Score: ${gameState.player.score}`;
    if (pointsLeft) pointsLeft.textContent = gameState.player.points;

    document.getElementById('playerStatus').classList.remove('hidden');
}

// Affichage contrôles performer
function showPerformerControls() {
    document.getElementById('voteSection')?.classList.add('hidden');
    document.getElementById('arbiterSection')?.classList.add('hidden');
    
    if (gameState.player.hasJoker) {
        document.getElementById('jokerSection')?.classList.remove('hidden');
    }
    
    document.getElementById('missionControls')?.classList.remove('hidden');
}

// Affichage contrôles arbitre
function showArbiterControls() {
    document.getElementById('voteSection')?.classList.add('hidden');
    document.getElementById('jokerSection')?.classList.add('hidden');
    document.getElementById('missionControls')?.classList.add('hidden');
    document.getElementById('arbiterSection')?.classList.remove('hidden');
}

// Affichage contrôles votant
function showVoterControls() {
    document.getElementById('arbiterSection')?.classList.add('hidden');
    document.getElementById('jokerSection')?.classList.add('hidden');
    document.getElementById('missionControls')?.classList.add('hidden');
    document.getElementById('voteSection')?.classList.remove('hidden');
}

// Affichage notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg animate__animated animate__fadeInRight
        ${type === 'error' ? 'bg-red-600' : 
          type === 'success' ? 'bg-green-600' : 
          'bg-blue-600'}`;

    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('animate__fadeInRight');
        notification.classList.add('animate__fadeOutRight');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Affichage écran jeu
function showGameScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    updatePlayerStatus();
}

// Gestion erreurs
function handleError(message) {
    showNotification(message, 'error');
}

// Gestion déconnexion joueur
function handlePlayerDisconnect(player) {
    showNotification(`${player.name} s'est déconnecté`, 'info');
}