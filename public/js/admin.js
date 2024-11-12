// Gestion de l'interface admin
const Admin = {
    // États admin
    state: {
        isLoggedIn: false,
        stats: {
            activeGames: 0,
            connectedPlayers: 0,
            totalCodes: 0
        },
        activeGames: new Map()
    },

    // Initialisation
    init() {
        this.setupEventListeners();
        this.initializeAdminPanel();
    },

    // Configuration des écouteurs
    setupEventListeners() {
        // Login admin
        document.getElementById('adminLogin').addEventListener('click', () => {
            this.login();
        });

        // Génération de codes
        document.getElementById('generateCodes')?.addEventListener('click', () => {
            this.generateCodes();
        });

        // Stats en temps réel
        socket.on('adminStats', (stats) => {
            this.updateStats(stats);
        });

        // Mise à jour des parties actives
        socket.on('activeGamesUpdate', (games) => {
            this.updateActiveGames(games);
        });
    },

    // Connexion admin
    async login() {
        const adminCode = document.getElementById('adminCodeInput').value;
        if (!adminCode) {
            UI.showNotification('Entrez le code admin', 'error');
            return;
        }

        try {
            const response = await fetch('/admin/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-code': adminCode
                }
            });

            if (response.ok) {
                this.state.isLoggedIn = true;
                UI.switchScreen('login', 'admin');
                this.initializeAdminPanel();
                UI.showNotification('Connecté comme administrateur', 'success');
                this.startRealTimeUpdates();
            } else {
                UI.showNotification('Code admin invalide', 'error');
            }
        } catch (error) {
            UI.showNotification('Erreur de connexion', 'error');
            console.error('Erreur login admin:', error);
        }
    },

    // Génération de codes
    async generateCodes() {
        const count = parseInt(document.getElementById('codeCount').value) || 100;
        const prefix = document.getElementById('codePrefix').value || 'ASC';

        try {
            const response = await fetch('/admin/generate-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-code': document.getElementById('adminCodeInput').value
                },
                body: JSON.stringify({ count, prefix })
            });

            const data = await response.json();
            
            if (data.success) {
                this.displayGeneratedCodes(data.codes);
                UI.showNotification(`${count} codes générés avec succès`, 'success');
                this.updateStats({ ...this.state.stats, totalCodes: this.state.stats.totalCodes + count });
            } else {
                UI.showNotification('Erreur lors de la génération des codes', 'error');
            }
        } catch (error) {
            UI.showNotification('Erreur serveur', 'error');
            console.error('Erreur génération codes:', error);
        }
    },

    // Affichage des codes générés
    displayGeneratedCodes(codes) {
        const container = document.getElementById('generatedCodes');
        container.innerHTML = '';

        const list = document.createElement('div');
        list.className = 'space-y-2';

        codes.forEach(code => {
            const codeElement = document.createElement('div');
            codeElement.className = 'flex justify-between items-center bg-gray-700 p-2 rounded';
            codeElement.innerHTML = `
                <span class="font-mono">${code}</span>
                <button class="text-sm bg-gray-600 px-2 py-1 rounded hover:bg-gray-500" 
                    onclick="Admin.copyToClipboard('${code}')">
                    Copier
                </button>
            `;
            list.appendChild(codeElement);
        });

        container.appendChild(list);
    },

    // Copie dans le presse-papier
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            UI.showNotification('Code copié !', 'success');
        } catch (error) {
            UI.showNotification('Erreur de copie', 'error');
        }
    },

    // Mise à jour des statistiques
    updateStats(stats) {
        this.state.stats = stats;
        
        // Mise à jour de l'affichage
        document.getElementById('activeGames').textContent = stats.activeGames;
        document.getElementById('connectedPlayers').textContent = stats.connectedPlayers;
        document.getElementById('totalCodes').textContent = stats.totalCodes;

        // Animation des changements
        ['activeGames', 'connectedPlayers', 'totalCodes'].forEach(id => {
            const element = document.getElementById(id);
            element.classList.add('animate__animated', 'animate__pulse');
            setTimeout(() => {
                element.classList.remove('animate__animated', 'animate__pulse');
            }, 1000);
        });
    },

    // Mise à jour des parties actives
    updateActiveGames(games) {
        const container = document.getElementById('activeGamesList');
        container.innerHTML = '';

        games.forEach(game => {
            const gameElement = document.createElement('div');
            gameElement.className = 'bg-gray-700 p-4 rounded-lg';
            gameElement.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold">Partie ${game.code}</span>
                    <span class="text-sm text-gray-400">
                        ${new Date(game.startTime).toLocaleTimeString()}
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="text-sm text-gray-400">Joueurs</span>
                        <p class="font-bold">${game.players.length}</p>
                    </div>
                    <div>
                        <span class="text-sm text-gray-400">Status</span>
                        <p class="font-bold">${game.status}</p>
                    </div>
                </div>
                <div class="mt-2">
                    <button class="text-sm bg-red-600 px-3 py-1 rounded hover:bg-red-700"
                        onclick="Admin.endGame('${game.code}')">
                        Terminer
                    </button>
                </div>
            `;
            container.appendChild(gameElement);
        });
    },

    // Terminer une partie
    async endGame(gameCode) {
        try {
            const response = await fetch(`/admin/end-game/${gameCode}`, {
                method: 'POST',
                headers: {
                    'x-admin-code': document.getElementById('adminCodeInput').value
                }
            });

            if (response.ok) {
                UI.showNotification(`Partie ${gameCode} terminée`, 'success');
            } else {
                UI.showNotification('Erreur lors de la terminaison de la partie', 'error');
            }
        } catch (error) {
            UI.showNotification('Erreur serveur', 'error');
        }
    },

    // Démarrage des mises à jour en temps réel
    startRealTimeUpdates() {
        socket.emit('adminConnect', document.getElementById('adminCodeInput').value);
        
        // Mise à jour toutes les 30 secondes
        setInterval(() => {
            if (this.state.isLoggedIn) {
                socket.emit('requestStats');
            }
        }, 30000);
    },

    // Export des statistiques
    async exportStats() {
        try {
            const response = await fetch('/admin/export-stats', {
                headers: {
                    'x-admin-code': document.getElementById('adminCodeInput').value
                }
            });

            const data = await response.json();
            
            // Création du fichier CSV
            const csvContent = this.convertToCSV(data);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            
            // Téléchargement
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `splenderra-stats-${new Date().toISOString().split('T')[0]}.csv`);
            a.click();
            window.URL.revokeObjectURL(url);

            UI.showNotification('Statistiques exportées', 'success');
        } catch (error) {
            UI.showNotification('Erreur lors de l\'export', 'error');
        }
    },

    // Conversion en CSV
    convertToCSV(data) {
        const headers = Object.keys(data[0]);
        const rows = data.map(obj => headers.map(header => obj[header]));
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});

// Export pour utilisation globale
window.Admin = Admin;