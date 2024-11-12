// Gestion de l'interface utilisateur
const UI = {
    // États de l'interface
    states: {
        isAnimating: false,
        currentScreen: 'login',
        notifications: [],
    },

    // Initialisation
    init() {
        this.initializeAnimations();
        this.setupEventListeners();
    },

    // Configuration des écouteurs d'événements
    setupEventListeners() {
        // Transitions entre écrans
        document.getElementById('loginScreen').addEventListener('animationend', () => {
            this.states.isAnimating = false;
        });

        // Gestion responsive
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Easter egg : double-clic sur le logo
        document.querySelector('header').addEventListener('dblclick', () => {
            this.triggerEasterEgg();
        });
    },

    // Transitions entre écrans
    switchScreen(from, to) {
        if (this.states.isAnimating) return;
        this.states.isAnimating = true;

        const fromScreen = document.getElementById(`${from}Screen`);
        const toScreen = document.getElementById(`${to}Screen`);

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

    // Notifications stylées
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification animate__animated animate__slideInRight ${type}`;
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${icon}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animation de sortie
        setTimeout(() => {
            notification.classList.remove('animate__slideInRight');
            notification.classList.add('animate__slideOutRight');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    },

    // Icônes pour les notifications
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || icons.info;
    },

    // Animation du timer
    updateTimer(timeLeft, totalTime = 120) {
        const timerElement = document.getElementById('timer');
        if (!timerElement) return;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const percentage = (timeLeft / totalTime) * 100;

        // Mise à jour du texte
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Animation du cercle
        const circle = document.querySelector('.timer-circle-progress');
        if (circle) {
            const circumference = 2 * Math.PI * 27; // rayon de 27
            circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
        }

        // Animations selon le temps restant
        if (timeLeft <= 10) {
            timerElement.classList.add('text-red-500', 'animate__animated', 'animate__pulse');
        } else {
            timerElement.classList.remove('text-red-500', 'animate__animated', 'animate__pulse');
        }
    },

    // Animation des scores
    updateScore(element, newScore, oldScore) {
        if (!element) return;

        const scoreBadge = element.querySelector('.score-badge');
        if (!scoreBadge) return;

        if (newScore > oldScore) {
            scoreBadge.classList.add('animate__animated', 'animate__bounceIn');
            setTimeout(() => {
                scoreBadge.classList.remove('animate__animated', 'animate__bounceIn');
            }, 1000);
        }
        
        scoreBadge.textContent = newScore;
    },

    // Animation du Joker
    animateJokerUse(targetPlayer) {
        const jokerButton = document.getElementById('useJoker');
        jokerButton.classList.add('animate__animated', 'animate__rubberBand');
        
        this.showNotification(`Joker utilisé sur ${targetPlayer} !`, 'success');
        
        setTimeout(() => {
            jokerButton.classList.remove('animate__animated', 'animate__rubberBand');
            jokerButton.disabled = true;
            jokerButton.classList.add('opacity-50');
        }, 1000);
    },

    // Animation de la mission
    showMission(mission) {
        const missionElement = document.getElementById('currentMission');
        missionElement.classList.add('animate__animated', 'animate__fadeInDown');
        
        document.getElementById('missionText').textContent = mission.task;
        document.getElementById('suggestionText').textContent = mission.suggestion;
        
        setTimeout(() => {
            missionElement.classList.remove('animate__animated', 'animate__fadeInDown');
        }, 1000);
    },

    // Gestion responsive
    handleResize() {
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('is-mobile', isMobile);
        
        // Ajuster l'interface selon la taille
        if (isMobile) {
            this.adjustForMobile();
        } else {
            this.adjustForDesktop();
        }
    },

    // Ajustements mobile
    adjustForMobile() {
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.classList.add('mobile-layout');
        }
    },

    // Ajustements desktop
    adjustForDesktop() {
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen) {
            gameScreen.classList.remove('mobile-layout');
        }
    },

    // Easter egg
    triggerEasterEgg() {
        document.body.classList.add('rainbow-mode');
        setTimeout(() => {
            document.body.classList.remove('rainbow-mode');
        }, 3000);
    },

    // Animation de victoire
    celebrateWin(playerName) {
        // Confetti
        const colors = ['#9333ea', '#4f46e5', '#f472b6'];
        
        for (let i = 0; i < 100; i++) {
            this.createConfetti(colors[Math.floor(Math.random() * colors.length)]);
        }

        this.showNotification(`🎉 ${playerName} remporte la partie !`, 'success');
    },

    // Création de confetti
    createConfetti(color) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.backgroundColor = color;
        confetti.style.left = Math.random() * 100 + 'vw';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});

// Export pour utilisation dans d'autres fichiers
window.UI = UI;