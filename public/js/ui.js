// Gestionnaire d'interface utilisateur
const UI = {
    // États et constantes
    states: {
        currentScreen: 'login',
        isAnimating: false,
        notifications: []
    },

    // Initialisation
    init() {
        console.log('🎨 Initialisation interface Splenderra');
        this.setupTheme();
        this.bindAnimations();
    },

    // Configuration du thème
    setupTheme() {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        }
    },

    // Transitions entre écrans
    switchScreen(from, to) {
        if (this.states.isAnimating) return;
        this.states.isAnimating = true;

        const fromScreen = document.getElementById(`${from}Screen`);
        const toScreen = document.getElementById(`${to}Screen`);

        if (!fromScreen || !toScreen) {
            console.error('❌ Écran non trouvé:', { from, to });
            return;
        }

        // Animation de sortie
        fromScreen.classList.add('animate__animated', 'animate__fadeOut');
        setTimeout(() => {
            fromScreen.classList.add('hidden');
            fromScreen.classList.remove('animate__animated', 'animate__fadeOut');

            // Animation d'entrée
            toScreen.classList.remove('hidden');
            toScreen.classList.add('animate__animated', 'animate__fadeIn');

            this.states.currentScreen = to;
            this.states.isAnimating = false;
        }, 500);
    },

    // Affichage host
    showHostConfig() {
        this.switchScreen('login', 'hostConfig');
    },

    // Affichage écran de jeu
    showGameScreen() {
        this.switchScreen(this.states.currentScreen, 'game');
    },

    // Mise à jour mission
    updateMission(mission) {
        const missionText = document.getElementById('missionText');
        const suggestionText = document.getElementById('missionSuggestion');
        const missionSection = document.getElementById('currentMission');

        if (!missionSection) return;

        missionSection.classList.add('animate__animated', 'animate__fadeInDown');
        
        if (missionText) missionText.textContent = mission.task;
        if (suggestionText) suggestionText.textContent = mission.suggestion;

        setTimeout(() => {
            missionSection.classList.remove('animate__animated', 'animate__fadeInDown');
        }, 1000);
    },

    // Mise à jour timer
    updateTimer(timeLeft) {
        const timerElement = document.getElementById('timer');
        if (!timerElement) return;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Animation selon le temps restant
        if (timeLeft <= 30) {
            timerElement.classList.add('timer-warning');
        }
        if (timeLeft <= 10) {
            timerElement.classList.remove('timer-warning');
            timerElement.classList.add('timer-danger');
        }
    },

    // Création carte joueur
    createPlayerCard(player) {
        const div = document.createElement('div');
        div.className = `player-card flex justify-between items-center ${
            player.id === gameState.game.currentPlayer ? 'player-active' : ''
        } ${player.isArbiter ? 'player-arbiter' : ''}`;

        div.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="font-medium">${player.name}</span>
                ${player.isArbiter ? '<span class="text-yellow-400">👑</span>' : ''}
                ${player.hasJoker ? '<span class="text-blue-400">🃏</span>' : ''}
            </div>
            <div class="flex items-center space-x-3">
                <span class="level-badge">Niveau ${player.level}</span>
                <span class="score-badge">${player.score}</span>
            </div>
        `;

        return div;
    },

    // Affichage contrôles performer
    showPerformerControls() {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const arbiterSection = document.getElementById('arbiterSection');

        if (voteSection) voteSection.classList.add('hidden');
        if (arbiterSection) arbiterSection.classList.add('hidden');
        if (jokerSection && gameState.player.hasJoker) {
            jokerSection.classList.remove('hidden');
        }
    },

    // Affichage contrôles votant
    showVoterControls() {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const arbiterSection = document.getElementById('arbiterSection');

        if (voteSection) voteSection.classList.remove('hidden');
        if (jokerSection) jokerSection.classList.add('hidden');
        if (arbiterSection) arbiterSection.classList.add('hidden');
    },

    // Affichage contrôles arbitre
    showArbiterControls() {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const arbiterSection = document.getElementById('arbiterSection');

        if (voteSection) voteSection.classList.add('hidden');
        if (jokerSection) jokerSection.classList.add('hidden');
        if (arbiterSection) arbiterSection.classList.remove('hidden');
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
    },

    // Mise à jour affichage jeu
    updateGameDisplay(state) {
        // Mise à jour statut joueur
        const userStatus = document.getElementById('userStatus');
        const userName = document.getElementById('userName');
        const userScore = document.getElementById('userScore');

        if (userStatus) userStatus.classList.remove('hidden');
        if (userName) userName.textContent = gameState.player.name;
        if (userScore) {
            const player = state.players.find(p => p.id === gameState.player.id);
            if (player) userScore.textContent = `Score: ${player.score}`;
        }

        // Mise à jour liste joueurs
        this.updatePlayersList(state.players);

        // Mise à jour contrôles selon rôle
        if (state.currentPlayer === gameState.player.id) {
            this.showPerformerControls();
        } else if (gameState.player.isArbiter) {
            this.showArbiterControls();
        } else {
            this.showVoterControls();
        }
    },

    // Mise à jour liste joueurs
    updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;

        playersList.innerHTML = '';
        players.forEach(player => {
            playersList.appendChild(this.createPlayerCard(player));
        });

        this.updateJokerTargetList(players);
    },

    // Mise à jour liste cibles Joker
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

    // Animation utilisation Joker
    animateJokerUse(targetName) {
        const jokerButton = document.getElementById('useJoker');
        if (!jokerButton) return;

        jokerButton.classList.add('animate__animated', 'animate__rubberBand');
        this.showNotification(`Joker utilisé sur ${targetName} !`, 'success');

        setTimeout(() => {
            jokerButton.classList.remove('animate__animated', 'animate__rubberBand');
            jokerButton.disabled = true;
            jokerButton.classList.add('opacity-50');
        }, 1000);
    },

    // Sons d'ambiance et effets
    playSoundEffect(type) {
        if (!gameState.game.settings.soundEnabled) return;

        const sounds = {
            success: new Audio('/sounds/success.mp3'),
            vote: new Audio('/sounds/vote.mp3'),
            timer: new Audio('/sounds/timer.mp3'),
            joker: new Audio('/sounds/joker.mp3')
        };

        const sound = sounds[type];
        if (sound) sound.play();
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});

// Export pour utilisation globale
window.UI = UI;