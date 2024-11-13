// Configuration et imports
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

// Modèles MongoDB
const GameCode = mongoose.model('GameCode', {
    code: String,
    isActivated: Boolean,
    email: String,
    deviceId: String,
    type: String,
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
    theme: String,
    status: { 
        type: String, 
        enum: ['waiting', 'playing', 'finished'],
        default: 'waiting'
    },
    settings: {
        voiceEnabled: Boolean,
        soundEnabled: Boolean
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

const MissionHistory = mongoose.model('MissionHistory', {
    playerId: mongoose.Schema.Types.ObjectId,
    gameId: mongoose.Schema.Types.ObjectId,
    level: Number,
    mission: {
        task: String,
        suggestion: String,
        theme: String,
        category: String,
        regenerationsLeft: { type: Number, default: 3 }
    },
    performance: {
        votes: Number,
        arbiterValidation: Boolean,
        jokerUsed: Boolean,
        timeSpent: Number
    },
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
    // GÉNÉRATEUR DE MISSIONS COMPLET
async function generateMission(level, theme, playerId, gameId, isRegeneration = false) {
    console.log('🎲 Génération mission:', { level, theme, isRegeneration });

    // Vérifier les régénérations
    if (isRegeneration) {
        const currentMission = await MissionHistory.findOne({ 
            playerId, 
            gameId,
            'mission.regenerationsLeft': { $gt: 0 } 
        }).sort({ createdAt: -1 });

        if (!currentMission) {
            throw new Error('Plus de régénérations disponibles pour ce niveau');
        }
        currentMission.mission.regenerationsLeft--;
        await currentMission.save();
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Générateur de missions Splenderra : Legend IA
                    Niveau: ${level}/10
                    Thème: ${theme}
                    Type: ${getMissionType(level)}
                    Les missions doivent être réalisables en 2 minutes maximum.`
                },
                {
                    role: "user",
                    content: getMissionPrompt(level, theme)
                }
            ],
            temperature: 0.9,
            max_tokens: 400,
            presence_penalty: 0.7,
            frequency_penalty: 0.9
        });

        const response = completion.choices[0].message.content;
        const mission = parseMissionResponse(response);

        // Sauvegarder dans l'historique
        const missionHistory = new MissionHistory({
            playerId,
            gameId,
            level,
            mission: {
                ...mission,
                theme,
                regenerationsLeft: isRegeneration ? 2 : 3
            }
        });
        await missionHistory.save();

        return mission;
    } catch (error) {
        console.error('❌ Erreur génération mission:', error);
        throw error;
    }
}

// Types de mission selon niveau
function getMissionType(level) {
    const types = {
        1: ['présentation simple', 'mini-sketch', 'observation'],
        2: ['dialogue simple', 'description', 'narration'],
        3: ['analyse basique', 'situation quotidienne', 'mini-performance'],
        4: ['sketch humoristique', 'présentation créative', 'analyse groupe'],
        5: ['performance dynamique', 'improvisation', 'critique constructive'],
        6: ['situation complexe', 'débat animé', 'sketch élaboré'],
        7: ['performance avancée', 'analyse approfondie', 'histoire interactive'],
        8: ['performance complexe', 'multi-personnages', 'situation absurde'],
        9: ['improvisation avancée', 'performance dramatique', 'analyse expert'],
        10: ['performance maître', 'situation épique', 'grand final']
    };
    return types[level] || types[10];
}

// Construction du prompt
function getMissionPrompt(level, theme) {
    return `Crée une mission de niveau ${level} pour le thème "${theme}".

STRUCTURE MISSION :
Pour un niveau ${level}/10, la mission doit être :
- Adaptée à l'intensité
- Réalisable en 2 minutes
- Claire et directe
- Immersive et engageante

THÈMES :
- Humour et légèreté : missions fun et décontractées
- Défis sérieux : missions de prise de parole et argumentation
- Coaching collectif : missions de développement et collaboration
- Improvisation créative : missions théâtrales et artistiques

FORMAT :
**VOTRE MISSION**
[Mission claire et directe]
**SUGGESTION**
[Guide pratique pour réussir]`;
}

// Parser réponse IA
function parseMissionResponse(response) {
    const mission = response.split('**VOTRE MISSION**')[1].split('**SUGGESTION**')[0].trim();
    const suggestion = response.split('**SUGGESTION**')[1].trim();
    return { task: mission, suggestion };
}

// ROUTES DU JEU
// Route principale
app.get('/', (req, res) => {
    console.log('📱 Accès à l\'interface principale');
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Création de partie
app.post('/game/create', async (req, res) => {
    console.log('🎮 Création nouvelle partie');
    try {
        const { theme, settings } = req.body;
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const game = new Game({
            code: gameCode,
            theme,
            settings,
            startTime: new Date(),
            status: 'waiting'
        });
        
        await game.save();
        res.json({ 
            success: true,
            gameCode,
            message: 'Partie créée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur création:', error);
        res.status(500).json({ error: 'Erreur serveur' });
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
            return res.status(404).json({ error: 'Partie non trouvée' });
        }
        res.json(game);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Historique des missions
app.get('/mission/history/:playerId', async (req, res) => {
    try {
        const history = await MissionHistory.find({ playerId: req.params.playerId })
            .sort('-createdAt')
            .limit(50);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Régénération de mission
app.post('/mission/regenerate', async (req, res) => {
    try {
        const { playerId, gameId, level, theme } = req.body;
        const mission = await generateMission(level, theme, playerId, gameId, true);
        res.json(mission);
    } catch (error) {
        if (error.message.includes('régénérations')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// SYSTÈME TEMPS RÉEL (WEBSOCKET)
io.on('connection', (socket) => {
    console.log('🔌 Nouvelle connexion socket:', socket.id);

    // Rejoindre une partie
    socket.on('joinGame', async (data) => {
        const { gameCode, playerName } = data;
        console.log('👋 Tentative connexion:', { gameCode, playerName });
        
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) {
                socket.emit('error', 'Partie non trouvée');
                return;
            }
            
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
            
        } catch (error) {
            console.error('❌ Erreur joinGame:', error);
            socket.emit('error', 'Erreur de connexion');
        }
    });

    // Démarrer un tour
    socket.on('startTurn', async (data) => {
        const { gameCode, playerId, level } = data;
        console.log('🎯 Démarrage tour:', { gameCode, playerId, level });
        
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const mission = await generateMission(level, game.theme, playerId, game._id);
            game.currentMission = mission;
            game.currentPlayer = playerId;
            game.status = 'playing';
            await game.save();

            io.to(gameCode).emit('turnStarted', {
                currentPlayer: playerId,
                mission,
                level
            });

            let timeLeft = 120; // 2 minutes
            const timer = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    io.to(gameCode).emit('turnEnded', playerId);
                    return;
                }
                io.to(gameCode).emit('timerUpdate', timeLeft);
                timeLeft--;
            }, 1000);

        } catch (error) {
            console.error('❌ Erreur startTurn:', error);
        }
    });

    // Voter
    socket.on('vote', async (data) => {
        const { gameCode, voterId, targetId } = data;
        console.log('🗳️ Vote:', { gameCode, voterId, targetId });
        
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

            const performer = game.players.find(p => p._id.toString() === targetId);
            if (performer) {
                performer.score++;
                await performer.save();
            }
            
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

    // Utiliser Joker
    socket.on('useJoker', async (data) => {
        const { gameCode, playerId, targetId } = data;
        console.log('🃏 Joker:', { gameCode, playerId, targetId });
        
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
            
            const target = game.players.find(p => p._id.toString() === targetId);
            io.to(gameCode).emit('jokerUsed', {
                playerId,
                targetId,
                playerName: player.name,
                targetName: target?.name
            });
            
        } catch (error) {
            console.error('❌ Erreur Joker:', error);
        }
    });

    // Déconnexion
    socket.on('disconnect', async () => {
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
                }
            }
        } catch (error) {
            console.error('❌ Erreur disconnect:', error);
        }
    });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
🚀 Splenderra : Legend IA en ligne sur le port ${PORT}
✨ Système prêt pour le jeu !
    `);
});

module.exports = { app, io, generateMission };