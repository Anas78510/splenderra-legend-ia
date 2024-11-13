// Gestionnaire d'interface Splenderra
const UI = {
    // États
    state: {
        currentScreen: 'login',
        isAnimating: false,
        notifications: []
    },

    // Initialisation
    init() {
        console.log('🎨 Initialisation interface Splenderra');
        this.setupAnimations();
    },

    // Configuration animations
    setupAnimations() {
        document.querySelectorAll('.animate__animated').forEach(element => {
            element.addEventListener('animationend', () => {
                element.classList.remove('animate__animated');
            });
        });
    },

    // Changement d'écran
    showGameScreen() {
        this.switchScreen('login', 'game');
        this.updateGameStatus();
    },

    switchScreen(from, to) {
        if (this.state.isAnimating) return;
        this.state.isAnimating = true;

        const fromScreen = document.getElementById(`${from}Screen`);
        const toScreen = document.getElementById(`${to}Screen`);

        fromScreen.classList.add('animate__animated', 'animate__fadeOut');
        
        setTimeout(() => {
            fromScreen.classList.add('hidden');
            fromScreen.classList.remove('animate__animated', 'animate__fadeOut');
            
            toScreen.classList.remove('hidden');
            toScreen.classList.add('animate__animated', 'animate__fadeIn');
            
            this.state.currentScreen = to;
            this.state.isAnimating = false;
        }, 500);
    },

    // Mise à jour mission
    updateMission(mission) {
        const missionSection = document.getElementById('missionSection');
        const missionText = document.getElementById('missionText');
        const suggestionText = document.getElementById('suggestionText');

        if (!missionSection || !missionText || !suggestionText) return;

        missionSection.classList.add('animate__animated', 'animate__fadeInDown');
        
        missionText.textContent = mission.task;
        suggestionText.textContent = mission.suggestion;

        setTimeout(() => {
            missionSection.classList.remove('animate__animated', 'animate__fadeInDown');
        }, 1000);
    },

    // Gestion timer
    updateTimer(timeLeft) {
        const timerElement = document.getElementById('timer');
        if (!timerElement) return;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 30) {
            timerElement.classList.add('timer-warning');
        }
        if (timeLeft <= 10) {
            timerElement.classList.remove('timer-warning');
            timerElement.classList.add('timer-danger');
        }
    },

    // Mise à jour joueurs
    updatePlayersList(players) {
        const container = document.getElementById('playersList');
        if (!container) return;

        container.innerHTML = '';
        players.forEach(player => {
            container.appendChild(this.createPlayerCard(player));
        });

        this.updateJokerTargetList(players);
    },

    createPlayerCard(player) {
        const div = document.createElement('div');
        div.className = `player-card ${
            player.id === gameState.game.currentPlayer ? 'player-active' : ''
        }`;

        div.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="font-medium">${player.name}</span>
                ${player.hasJoker ? '<span class="text-blue-400">🃏</span>' : ''}
            </div>
            <div class="flex items-center space-x-3">
                <span class="level-badge">Niveau ${player.level || 1}</span>
                <span class="score-badge">${player.score}</span>
            </div>
        `;

        return div;
    },

    // Mise à jour contrôles
    showPerformerControls() {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const missionControls = document.getElementById('missionControls');

        if (voteSection) voteSection.classList.add('hidden');
        if (jokerSection && gameState.player.hasJoker) {
            jokerSection.classList.remove('hidden');
        }
        if (missionControls) missionControls.classList.remove('hidden');
    },

    showVoterControls() {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const missionControls = document.getElementById('missionControls');

        if (voteSection) voteSection.classList.remove('hidden');
        if (jokerSection) jokerSection.classList.add('hidden');
        if (missionControls) missionControls.classList.add('hidden');
    },

    hideMissionControls() {
        const missionControls = document.getElementById('missionControls');
        if (missionControls) missionControls.classList.add('hidden');
    },

    // Mise à jour Joker
    updateJokerTargetList(players) {
        const select = document.getElementById('jokerTarget');
        if (!select) return;

        select.innerHTML = '<option value="">Choisir un joueur</option>';
        
        players
            .filter(p => p.id !== gameState.player.id && p.isConnected)
            .forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                option.textContent = player.name;
                select.appendChild(option);
            });
    },

    updateJokerStatus() {
        const jokerButton = document.getElementById('useJoker');
        const jokerSection = document.getElementById('jokerSection');

        if (jokerButton) {
            jokerButton.disabled = !gameState.player.hasJoker;
            jokerButton.classList.toggle('opacity-50', !gameState.player.hasJoker);
        }

        if (jokerSection) {
            jokerSection.classList.toggle('hidden', !gameState.player.hasJoker);
        }
    },

    // Mise à jour régénérations
    updateRegenerationsLeft() {
        const counter = document.getElementById('regenerationsLeft');
        if (counter) {
            counter.textContent = gameState.game.regenerationsLeft;
            if (gameState.game.regenerationsLeft <= 0) {
                document.getElementById('regenerateMission')?.classList.add('hidden');
            }
        }
    },

    // Mise à jour scores
    updateScores() {
        const playerScore = document.getElementById('playerScore');
        const credibilityPoints = document.getElementById('credibilityPoints');

        if (playerScore) {
            playerScore.textContent = `Score: ${gameState.player.score}`;
        }

        if (credibilityPoints) {
            credibilityPoints.textContent = gameState.player.credibilityPoints;
        }

        this.updatePlayersList(gameState.game.players);
    },

    // Mise à jour statut joueur
    updatePlayerStatus() {
        const playerInfo = document.getElementById('playerInfo');
        const playerName = document.getElementById('playerName');

        if (playerInfo) playerInfo.classList.remove('hidden');
        if (playerName) playerName.textContent = gameState.player.name;

        this.updateScores();
        this.updateJokerStatus();
    },

    // Mise à jour affichage jeu
    updateGameDisplay(state) {
        if (state.currentMission) {
            this.updateMission(state.currentMission);
        }
        this.updatePlayersList(state.players);
        this.updatePlayerStatus();
    },

    // Notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate__animated animate__slideInRight`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${icons[type]}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('animate__slideInRight');
            notification.classList.add('animate__slideOutRight');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});

// Export pour utilisation globale
window.UI = UI;