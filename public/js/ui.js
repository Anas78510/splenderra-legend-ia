const UI = {
    // Mise à jour liste des joueurs
    updatePlayersList(players) {
        const container = document.getElementById('playersList');
        if (!container) return;

        container.innerHTML = '';
        players.forEach(player => {
            const div = document.createElement('div');
            div.className = `bg-gray-700 bg-opacity-50 rounded-lg p-3 flex justify-between items-center
                ${player.id === gameState.game.currentPlayer ? 'border-l-4 border-purple-500' : ''}`;

            div.innerHTML = `
                <div class="flex items-center">
                    <span class="font-medium">${player.name}</span>
                    ${player.hasJoker ? '<span class="ml-2">🃏</span>' : ''}
                </div>
                <span class="bg-purple-600 px-3 py-1 rounded-full">${player.score}</span>
            `;

            container.appendChild(div);
        });

        // Mise à jour liste joker
        this.updateJokerTargets(players);
    },

    // Mise à jour cibles du joker
    updateJokerTargets(players) {
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
    },

    // Mise à jour affichage du jeu
    updateGameDisplay(state) {
        // Score du joueur
        const scoreElement = document.getElementById('yourScore');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${gameState.player.score}`;
        }

        // Mission actuelle
        if (state.currentMission) {
            document.getElementById('missionText').textContent = state.currentMission.task;
            document.getElementById('suggestionText').textContent = state.currentMission.suggestion;
        }

        // Contrôles selon le rôle
        this.updateControls(state);
    },

    // Mise à jour des contrôles
    updateControls(state) {
        const voteSection = document.getElementById('voteSection');
        const jokerSection = document.getElementById('jokerSection');
        const regenSection = document.getElementById('regenSection');

        // Si c'est notre tour
        if (state.currentPlayer === gameState.player.id) {
            if (voteSection) voteSection.classList.add('hidden');
            if (jokerSection && gameState.player.hasJoker) jokerSection.classList.remove('hidden');
            if (regenSection) regenSection.classList.remove('hidden');
        } 
        // Si c'est le tour d'un autre
        else {
            if (voteSection) voteSection.classList.remove('hidden');
            if (jokerSection) jokerSection.classList.add('hidden');
            if (regenSection) regenSection.classList.add('hidden');
        }
    },

    // Mise à jour points
    updatePoints() {
        const voteButton = document.getElementById('voteButton');
        if (voteButton) {
            voteButton.textContent = `Voter (${gameState.player.points} point${gameState.player.points !== 1 ? 's' : ''})`;
            voteButton.disabled = gameState.player.points < 1;
            voteButton.classList.toggle('opacity-50', gameState.player.points < 1);
        }
    },

    // Mise à jour statut joker
    updateJokerStatus() {
        const jokerSection = document.getElementById('jokerSection');
        const jokerButton = document.getElementById('jokerButton');
        
        if (jokerSection) {
            jokerSection.classList.toggle('hidden', !gameState.player.hasJoker);
        }
        if (jokerButton) {
            jokerButton.disabled = !gameState.player.hasJoker;
            jokerButton.classList.toggle('opacity-50', !gameState.player.hasJoker);
        }
    },

    // Notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg
            ${type === 'error' ? 'bg-red-900' : 'bg-gray-800'}`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${type === 'error' ? '❌' : '✅'}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Animation mission
    animateMission() {
        const mission = document.getElementById('missionText');
        if (!mission) return;

        mission.style.opacity = '0';
        setTimeout(() => {
            mission.style.opacity = '1';
            mission.style.transform = 'scale(1.05)';
            setTimeout(() => {
                mission.style.transform = 'scale(1)';
            }, 200);
        }, 300);
    },

    // Animation vote
    animateVote() {
        const score = document.getElementById('yourScore');
        if (!score) return;

        score.classList.add('scale-125');
        setTimeout(() => score.classList.remove('scale-125'), 300);
    },

    // Animation joker
    animateJoker() {
        const jokerButton = document.getElementById('jokerButton');
        if (!jokerButton) return;

        jokerButton.classList.add('rotate-12');
        setTimeout(() => jokerButton.classList.remove('rotate-12'), 300);
    }
};

// Export pour utilisation globale
window.UI = UI;