// SPLENDERRA : LEGEND IA - Système unifié
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

// Initialisation du serveur
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Configuration middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration OpenAI
console.log('🤖 Configuration OpenAI...');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Modèles MongoDB améliorés
const GameCode = mongoose.model('GameCode', {
    code: String,
    isActivated: Boolean,
    email: String,
    deviceId: String,
    type: String,
    usageStats: {
        totalGames: { type: Number, default: 0 },
        lastUsed: Date
    },
    dailyUsage: [{
        date: Date,
        count: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

const Player = mongoose.model('Player', {
    name: String,
    socketId: String,
    credibilityPoints: { type: Number, default: 1 },
    hasJoker: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
    isConnected: { type: Boolean, default: true },
    gameHistory: [{
        gameId: mongoose.Schema.Types.ObjectId,
        score: Number,
        date: Date
    }],
    createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', {
    code: String,
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    arbiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    activeRound: { type: Number, default: 0 },
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    startTime: Date,
    endTime: Date,
    status: { 
        type: String, 
        enum: ['waiting', 'playing', 'finished'],
        default: 'waiting'
    },
    currentMission: {
        task: String,
        suggestion: String,
        level: Number,
        category: String
    },
    rounds: [{
        player: mongoose.Schema.Types.ObjectId,
        mission: {
            task: String,
            level: Number
        },
        votes: Number,
        jokerUsed: Boolean,
        timeSpent: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

// Connexion MongoDB avec logs détaillés
console.log('🔌 Tentative de connexion à MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connecté avec succès');
        const maskedUri = process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@');
        console.log('📌 URL de connexion:', maskedUri);
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB:', err);
        console.error('🔍 Détails:', {
            message: err.message,
            code: err.code,
            name: err.name
        });
    });

// Route principale - Interface unifiée
app.get('/', (req, res) => {
    console.log('📱 Accès à l\'interface principale');
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// API Routes
app.post('/game/create', async (req, res) => {
    console.log('🎮 Création d\'une nouvelle partie');
    try {
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('🎲 Code généré:', gameCode);
        
        const game = new Game({
            code: gameCode,
            players: [],
            startTime: new Date(),
            status: 'waiting'
        });
        
        console.log('💾 Sauvegarde de la partie...');
        await game.save();
        console.log('✅ Partie créée:', game._id);
        
        res.json({ 
            success: true,
            gameCode: gameCode,
            message: 'Partie créée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur création partie:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erreur de création',
            details: error.message
        });
    }
});

// Vérification de partie
app.get('/game/:code', async (req, res) => {
    console.log('🔍 Vérification partie:', req.params.code);
    try {
        const game = await Game.findOne({ code: req.params.code })
            .populate('players')
            .populate('currentPlayer')
            .populate('arbiter');
        
        if (!game) {
            console.log('❌ Partie non trouvée:', req.params.code);
            return res.status(404).json({ error: 'Partie non trouvée' });
        }

        res.json(game);
    } catch (error) {
        console.error('❌ Erreur vérification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes Admin améliorées
app.post('/admin/verify', async (req, res) => {
    const adminCode = req.headers['x-admin-code'];
    
    if (adminCode !== process.env.ADMIN_CODE) {
        console.log('❌ Tentative de connexion admin invalide');
        return res.status(401).json({ error: 'Code admin invalide' });
    }

    res.json({ success: true });
});

app.post('/admin/generate-codes', async (req, res) => {
    console.log('🎲 Génération de codes demandée');
    try {
        const { count = 100, prefix = 'ASC' } = req.body;
        const adminCode = req.headers['x-admin-code'];
        
        if (adminCode !== process.env.ADMIN_CODE) {
            console.error('❌ Code admin invalide');
            return res.status(401).json({ error: 'Code admin invalide' });
        }

        const codes = [];
        for (let i = 0; i < count; i++) {
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            const code = `${prefix}-${randomStr}`;
            codes.push(new GameCode({
                code,
                isActivated: false,
                type: 'standard'
            }));
        }

        await GameCode.insertMany(codes);
        console.log('✅ Codes générés:', count);
        
        res.json({ 
            success: true,
            message: `${count} codes générés`,
            codes: codes.map(c => c.code)
        });
    } catch (error) {
        console.error('❌ Erreur génération:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Stats Admin
app.get('/admin/stats', async (req, res) => {
    const adminCode = req.headers['x-admin-code'];
    
    if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(401).json({ error: 'Code admin invalide' });
    }

    try {
        const stats = {
            activeGames: await Game.countDocuments({ status: 'playing' }),
            totalGames: await Game.countDocuments(),
            totalPlayers: await Player.countDocuments(),
            totalCodes: await GameCode.countDocuments(),
            activeCodes: await GameCode.countDocuments({ isActivated: true })
        };
        
        res.json(stats);
    } catch (error) {
        console.error('❌ Erreur stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});// WebSocket - Gestion temps réel améliorée
io.on('connection', (socket) => {
    console.log('🔌 Nouvelle connexion socket:', socket.id);

    // Connexion Admin
    socket.on('adminConnect', (adminCode) => {
        if (adminCode === process.env.ADMIN_CODE) {
            socket.join('admin-room');
            sendAdminStats(socket);
        }
    });

    // Rejoindre une partie
    socket.on('joinGame', async (gameCode, playerName) => {
        console.log('👋 Tentative de connexion:', { gameCode, playerName });
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) {
                console.log('❌ Partie non trouvée:', gameCode);
                socket.emit('error', 'Partie non trouvée');
                return;
            }
            
            console.log('✅ Création joueur:', playerName);
            const player = new Player({
                name: playerName,
                socketId: socket.id,
                credibilityPoints: 1,
                hasJoker: true,
                score: 0,
                isConnected: true
            });
            
            await player.save();
            game.players.push(player);
            await game.save();
            
            socket.join(gameCode);
            console.log('✅ Joueur ajouté à la partie:', player.name);
            
            io.to(gameCode).emit('playerJoined', {
                id: player._id,
                name: player.name,
                score: player.score,
                hasJoker: player.hasJoker,
                isConnected: true
            });

            const fullGame = await Game.findOne({ code: gameCode }).populate('players');
            socket.emit('gameState', {
                players: fullGame.players,
                currentPlayer: fullGame.currentPlayer,
                arbiter: fullGame.arbiter,
                status: fullGame.status,
                currentMission: fullGame.currentMission
            });
            
            // Mise à jour stats admin
            sendAdminStats();
            
        } catch (error) {
            console.error('❌ Erreur joinGame:', error);
            socket.emit('error', 'Erreur de connexion');
        }
    });

    // Démarrer un tour
    socket.on('startTurn', async (gameCode, playerId, level) => {
        console.log('🎮 Démarrage tour:', { gameCode, playerId, level });
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const mission = await generateMission(level);
            game.currentMission = mission;
            game.currentPlayer = playerId;
            game.status = 'playing';
            await game.save();

            console.log('✅ Mission générée niveau:', level);

            io.to(gameCode).emit('turnStarted', {
                currentPlayer: playerId,
                mission: game.currentMission,
                level: level
            });

            // Timer avec checkpoints
            let timeLeft = 120;
            const timer = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    io.to(gameCode).emit('turnEnded', playerId);
                    return;
                }

                // Alertes spéciales
                if (timeLeft === 30) {
                    io.to(gameCode).emit('timeWarning', '30 secondes restantes !');
                } else if (timeLeft === 10) {
                    io.to(gameCode).emit('timeWarning', 'Plus que 10 secondes !');
                }

                io.to(gameCode).emit('timerUpdate', timeLeft);
                timeLeft--;
            }, 1000);

        } catch (error) {
            console.error('❌ Erreur startTurn:', error);
        }
    });

    // Système de vote amélioré
    socket.on('vote', async (gameCode, voterId, performerId) => {
        console.log('🗳️ Vote reçu:', { gameCode, voterId, performerId });
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) return;
            
            const voter = game.players.find(p => p._id.toString() === voterId);
            if (!voter || voter.credibilityPoints < 1) {
                socket.emit('error', 'Vote impossible');
                return;
            }
            
            voter.credibilityPoints--;
            await voter.save();
            console.log('✅ Point de crédibilité utilisé');

            const performer = game.players.find(p => p._id.toString() === performerId);
            if (performer) {
                performer.score++;
                await performer.save();
                console.log('✅ Point attribué à:', performer.name);
            }
            
            // Mise à jour Arbitre
            const topPlayer = game.players.reduce((max, p) => p.score > max.score ? p : max);
            game.arbiter = topPlayer._id;
            await game.save();
            
            io.to(gameCode).emit('scoreUpdate', {
                players: game.players,
                arbiter: game.arbiter
            });
            
        } catch (error) {
            console.error('❌ Erreur vote:', error);
        }
    });

    // Système Joker amélioré
    socket.on('useJoker', async (gameCode, playerId, targetId) => {
        console.log('🃏 Utilisation Joker:', { gameCode, playerId, targetId });
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) return;
            
            const player = game.players.find(p => p._id.toString() === playerId);
            if (!player || !player.hasJoker) {
                socket.emit('error', 'Joker non disponible');
                return;
            }
            
            player.hasJoker = false;
            await player.save();
            console.log('✅ Joker utilisé par:', player.name);
            
            // Notification spéciale pour le joueur ciblé
            const target = game.players.find(p => p._id.toString() === targetId);
            io.to(game.code).emit('jokerUsed', {
                playerId,
                targetId,
                playerName: player.name,
                targetName: target?.name
            });
            
        } catch (error) {
            console.error('❌ Erreur Joker:', error);
        }
    });

    // Gestion déconnexion améliorée
    socket.on('disconnect', async () => {
        console.log('👋 Déconnexion:', socket.id);
        try {
            const player = await Player.findOne({ socketId: socket.id });
            if (player) {
                player.isConnected = false;
                await player.save();

                const game = await Game.findOne({ players: player._id });
                if (game) {
                    io.to(game.code).emit('playerDisconnected', {
                        playerId: player._id,
                        playerName: player.name
                    });

                    // Vérification fin de partie
                    const connectedPlayers = await Player.countDocuments({
                        _id: { $in: game.players },
                        isConnected: true
                    });

                    if (connectedPlayers === 0) {
                        game.status = 'finished';
                        game.endTime = new Date();
                        await game.save();
                        console.log('🏁 Partie terminée (tous déconnectés):', game.code);
                    }
                }

                // Mise à jour stats admin
                sendAdminStats();
            }
        } catch (error) {
            console.error('❌ Erreur disconnect:', error);
        }
    });
});

// Générateur de missions amélioré
async function generateMission(level) {
    console.log('🎲 Génération mission niveau:', level);
    try {
        const categories = {
            1: ['introduction', 'simple'],
            2: ['narration', 'description'],
            3: ['présentation', 'analyse'],
            4: ['sketch', 'présentation'],
            5: ['impro', 'analyse'],
            6: ['sketch', 'performance'],
            7: ['présentation', 'analyse'],
            8: ['dialogue', 'absurde'],
            9: ['performance', 'complexe'],
            10: ['challenge', 'final']
        };

        const availableCategories = categories[level] || ['performance'];
        const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        console.log('📋 Catégorie choisie:', category);

        console.log('🤖 Génération via OpenAI...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Tu es le créateur de missions pour Splenderra : Legend IA. Génère une mission de ${category} pour le niveau ${level}/10. La mission doit être réalisable en 2 minutes maximum.`
                },
                {
                    role: "user",
                    content: `Crée une mission de ${category} niveau ${level}/10.

TYPES DE PERFORMANCES :

SKETCH :
- Mini-scène humoristique
- Impact immédiat
- Punch final
Exemple :
VOTRE MISSION : Improvisez un sketch sur une situation qui dérape
SUGGESTION : Situation claire, punch final, rythme rapide

PRÉSENTATION :
- Point de vue original
- Arguments surprenants
- Conviction totale
Exemple :
VOTRE MISSION : Défendez une théorie improbable sur la vie quotidienne
SUGGESTION : Arguments simples, exemples concrets, conviction totale

PERFORMANCE :
- Impact maximum
- Public impliqué
- Final mémorable
Exemple :
VOTRE MISSION : Transformez un moment banal en événement épique
SUGGESTION : Énergie maximale, public impliqué, final grandiose

RÈGLES :
- 2 minutes max
- Rythme soutenu
- Impact garanti
- Public impliqué

FORMAT :
**VOTRE MISSION**
[Mission claire et directe]
**SUGGESTION**
[Guide pratique]`
                }
            ],
            temperature: 0.9,
            max_tokens: 300,
            presence_penalty: 0.7,
            frequency_penalty: 0.9
        });

        const response = completion.choices[0].message.content;
        console.log('✅ Mission générée');
        
        const mission = response.split('**VOTRE MISSION**')[1].split('**SUGGESTION**')[0].trim();
        const suggestion = response.split('**SUGGESTION**')[1].trim();

        return {
            task: mission,
            suggestion,
            level,
            category
        };
    } catch (error) {
        console.error('❌ Erreur génération mission:', error);
        throw error;
    }
}

// Fonction pour envoyer les stats admin
async function sendAdminStats(socket = null) {
    try {
        const stats = {
            activeGames: await Game.countDocuments({ status: 'playing' }),
            connectedPlayers: await Player.countDocuments({ isConnected: true }),
            totalCodes: await GameCode.countDocuments()
        };

        if (socket) {
            socket.emit('adminStats', stats);
        } else {
            io.to('admin-room').emit('adminStats', stats);
        }
    } catch (error) {
        console.error('❌ Erreur stats admin:', error);
    }
}

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
🚀 Splenderra : Legend IA en ligne sur le port ${PORT}
📱 Interface unifiée disponible sur: http://localhost:${PORT}
✨ Système prêt pour le jeu !
    `);
});

module.exports = { app, io, generateMission };