// Gestionnaire Hôte et Admin
const Host = {
    // États
    state: {
        isHost: false,
        isAdmin: false,
        currentGame: null,
        adminEmail: 'splenderra@gmail.com',
        gameSettings: {
            theme: 'humour',
            voiceEnabled: false,
            soundEnabled: false
        }
    },

    // Initialisation
    init() {
        this.setupHostListeners();
        this.checkAdminAccess();
    },

    // Vérification accès administrateur
    async checkAdminAccess() {
        const credentials = localStorage.getItem('adminCredentials');
        if (credentials) {
            const { email, key } = JSON.parse(credentials);
            if (email === this.state.adminEmail) {
                this.state.isAdmin = true;
                console.log('🔐 Accès admin activé');
                this.loadAdminFeatures();
            }
        }
    },

    // Configuration écouteurs
    setupHostListeners() {
        // Création partie
        document.getElementById('createGame')?.addEventListener('click', () => {
            this.createGame();
        });

        // Paramètres de jeu
        document.getElementById('gameTheme')?.addEventListener('change', (e) => {
            this.state.gameSettings.theme = e.target.value;
        });

        document.getElementById('voiceEnabled')?.addEventListener('change', (e) => {
            this.state.gameSettings.voiceEnabled = e.checked;
        });

        document.getElementById('soundEnabled')?.addEventListener('change', (e) => {
            this.state.gameSettings.soundEnabled = e.checked;
        });
    },

    // Création de partie
    async createGame() {
        console.log('🎲 Création nouvelle partie...');
        try {
            const response = await fetch('/game/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.state.gameSettings)
            });

            const data = await response.json();
            if (data.success) {
                this.state.currentGame = data.gameCode;
                this.showGameControls(data.gameCode);
                UI.showNotification('Partie créée !', 'success');
            }
        } catch (error) {
            console.error('❌ Erreur création:', error);
            UI.showNotification('Erreur serveur', 'error');
        }
    },

    // Affichage contrôles de partie
    showGameControls(gameCode) {
        const inviteSection = document.getElementById('inviteSection');
        const codeDisplay = document.getElementById('inviteCodeDisplay');
        
        if (inviteSection && codeDisplay) {
            inviteSection.classList.remove('hidden');
            codeDisplay.textContent = gameCode;
        }
    },

    // Fonctions Admin
    loadAdminFeatures() {
        if (!this.state.isAdmin) return;
        
        console.log('⚙️ Chargement fonctions admin...');
        
        // Stats des parties
        this.loadGameStats();
        
        // Gestion des codes
        this.loadCodeManagement();
    },

    // Chargement stats
    async loadGameStats() {
        try {
            const response = await fetch('/admin/stats', {
                headers: {
                    'X-Admin-Email': this.state.adminEmail
                }
            });
            
            const stats = await response.json();
            this.updateStatsDisplay(stats);
        } catch (error) {
            console.error('❌ Erreur stats:', error);
        }
    },

    // Gestion des codes d'accès
    async loadCodeManagement() {
        try {
            const response = await fetch('/admin/codes', {
                headers: {
                    'X-Admin-Email': this.state.adminEmail
                }
            });
            
            const codes = await response.json();
            this.updateCodesDisplay(codes);
        } catch (error) {
            console.error('❌ Erreur codes:', error);
        }
    },

    // Mise à jour affichage stats
    updateStatsDisplay(stats) {
        if (!this.state.isAdmin) return;
        
        const statsContainer = document.getElementById('adminStats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="stat-card">
                        <h3>Parties actives</h3>
                        <p>${stats.activeGames}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Joueurs connectés</h3>
                        <p>${stats.connectedPlayers}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Codes générés</h3>
                        <p>${stats.totalCodes}</p>
                    </div>
                </div>
            `;
        }
    },

    // Mise à jour affichage codes
    updateCodesDisplay(codes) {
        if (!this.state.isAdmin) return;
        
        const codesContainer = document.getElementById('adminCodes');
        if (codesContainer) {
            codesContainer.innerHTML = `
                <div class="codes-list">
                    ${codes.map(code => `
                        <div class="code-item">
                            <span>${code.code}</span>
                            <span>${code.isActivated ? '✅' : '❌'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    },

    // Génération de nouveaux codes
    async generateCodes(count = 100, prefix = 'ASC') {
        if (!this.state.isAdmin) return;

        try {
            const response = await fetch('/admin/generate-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Email': this.state.adminEmail
                },
                body: JSON.stringify({ count, prefix })
            });

            const result = await response.json();
            if (result.success) {
                UI.showNotification(`${count} codes générés`, 'success');
                this.loadCodeManagement();
            }
        } catch (error) {
            console.error('❌ Erreur génération:', error);
            UI.showNotification('Erreur génération codes', 'error');
        }
    },

    // Export CSV des stats
    exportStats() {
        if (!this.state.isAdmin) return;
        
        fetch('/admin/export-stats', {
            headers: {
                'X-Admin-Email': this.state.adminEmail
            }
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `splenderra-stats-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        })
        .catch(error => {
            console.error('❌ Erreur export:', error);
            UI.showNotification('Erreur export stats', 'error');
        });
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    Host.init();
});

// Export pour utilisation globale
window.Host = Host;