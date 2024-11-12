// SPLENDERRA : LEGEND IA
// Configuration principale
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
        origin: '*', // Sera restreint plus tard à ton domaine Shopify
        methods: ['GET', 'POST']
    }
});

// Configuration middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration OpenAI
console.log('Configuration OpenAI...');
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
    createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', {
    code: String,
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    arbiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    activeRound: { type: Number, default: 0 },
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    startTime: Date,
    status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    currentMission: {
        task: String,
        suggestion: String,
        level: Number,
        category: String
    },
    createdAt: { type: Date, default: Date.now }
});

// Connexion MongoDB avec debug détaillé
console.log('Tentative de connexion à MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connecté avec succès');
        const maskedUri = process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@');
        console.log('📌 URL de connexion:', maskedUri);
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB:', err);
        console.error('🔍 Détails de l\'erreur:', {
            message: err.message,
            code: err.code,
            name: err.name
        });
        console.error('📝 Vérifiez:');
        console.error('   - Les variables d\'environnement');
        console.error('   - La connexion réseau');
        console.error('   - Le mot de passe MongoDB');
    });

// Routes principales avec logs détaillés
app.get('/', (req, res) => {
    console.log('📍 Accès à la route principale');
    res.redirect('/central/');
});

app.get('/central/', (req, res) => {
    console.log('📍 Accès à l\'interface centrale');
    res.sendFile(path.join(__dirname, 'public', 'central', 'index.html'));
});

app.get('/player/', (req, res) => {
    console.log('📍 Accès à l\'interface joueur');
    res.sendFile(path.join(__dirname, 'public', 'player', 'index.html'));
});

// Route de création de partie avec debug complet
app.post('/game/create', async (req, res) => {
    console.log('🎮 Tentative de création de partie');
    try {
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('📝 Code généré:', gameCode);
        
        const game = new Game({
            code: gameCode,
            players: [],
            activeRound: 0,
            startTime: new Date(),
            status: 'waiting'
        });
        
        console.log('💾 Tentative de sauvegarde de la partie...');
        await game.save();
        console.log('✅ Partie sauvegardée avec succès');
        console.log('📊 Détails:', {
            id: game._id,
            code: game.code,
            status: game.status
        });
        
        res.json({ 
            success: true,
            gameCode: gameCode,
            message: 'Partie créée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur création partie:', error);
        console.error('🔍 Détails:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({ 
            success: false,
            error: 'Erreur lors de la création de la partie',
            details: error.message
        });
    }
});

// Route de vérification de partie
app.get('/game/:code', async (req, res) => {
    console.log('🔍 Vérification de partie:', req.params.code);
    try {
        const game = await Game.findOne({ code: req.params.code })
            .populate('players')
            .populate('currentPlayer')
            .populate('arbiter');
        
        if (!game) {
            console.log('❌ Partie non trouvée:', req.params.code);
            return res.status(404).json({ error: 'Partie non trouvée' });
        }

        console.log('✅ Partie trouvée:', game.code);
        res.json(game);
    } catch (error) {
        console.error('❌ Erreur vérification partie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route admin pour générer des codes
app.post('/admin/generate-codes', async (req, res) => {
    console.log('🎲 Tentative de génération de codes');
    try {
        const { count = 100, prefix = 'ASC' } = req.body;
        const adminCode = req.headers['x-admin-code'];
        
        if (adminCode !== process.env.ADMIN_CODE) {
            console.error('❌ Code admin invalide');
            return res.status(401).json({ error: 'Code admin invalide' });
        }

        console.log('📝 Génération de', count, 'codes avec préfixe', prefix);
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

        console.log('💾 Sauvegarde des codes...');
        await GameCode.insertMany(codes);
        console.log('✅ Codes générés avec succès');
        
        res.json({ 
            success: true,
            message: `${count} codes générés`,
            codes: codes.map(c => c.code)
        });
    } catch (error) {
        console.error('❌ Erreur génération codes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// WebSocket - Gestion temps réel
io.on('connection', (socket) => {
    console.log('🔌 Nouvelle connexion socket:', socket.id);

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
            
            console.log('✅ Partie trouvée, création du joueur');
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
            console.log('✅ Joueur ajouté:', player.name);
            
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

    // Démarrer le tour d'un joueur
    socket.on('startTurn', async (gameCode, playerId, level) => {
        console.log('🎮 Démarrage du tour:', { gameCode, playerId, level });
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) {
                console.log('❌ Partie non trouvée pour startTurn');
                return;
            }

            if (level > 3) {
                console.log('🎲 Génération d\'une nouvelle mission niveau', level);
                const mission = await generateMission(level);
                game.currentMission = mission;
            }

            game.currentPlayer = playerId;
            game.status = 'playing';
            await game.save();
            console.log('✅ Tour démarré pour le joueur:', playerId);

            io.to(gameCode).emit('turnStarted', {
                currentPlayer: playerId,
                mission: game.currentMission,
                level: level
            });

            let timeLeft = 120;
            const timer = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    console.log('⏰ Temps écoulé pour le joueur:', playerId);
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

    // Voter pour une performance
    socket.on('vote', async (gameCode, voterId, performerId) => {
        console.log('🗳️ Nouveau vote:', { gameCode, voterId, performerId });
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) {
                console.log('❌ Partie non trouvée pour le vote');
                return;
            }
            
            const voter = game.players.find(p => p._id.toString() === voterId);
            if (!voter || voter.credibilityPoints < 1) {
                console.log('❌ Vote impossible:', { voter: !!voter, points: voter?.credibilityPoints });
                socket.emit('error', 'Vote impossible');
                return;
            }
            
            voter.credibilityPoints--;
            await voter.save();
            console.log('✅ Point de crédibilité utilisé par:', voter.name);

            const performer = game.players.find(p => p._id.toString() === performerId);
            if (performer) {
                performer.score++;
                await performer.save();
                console.log('✅ Point attribué à:', performer.name);
            }
            
            const topPlayer = game.players.reduce((max, p) => p.score > max.score ? p : max);
            game.arbiter = topPlayer._id;
            await game.save();
            console.log('👑 Nouvel arbitre:', topPlayer.name);
            
            io.to(gameCode).emit('scoreUpdate', {
                players: game.players,
                arbiter: game.arbiter
            });
            
        } catch (error) {
            console.error('❌ Erreur vote:', error);
        }
    });

    // Utiliser son Joker
    socket.on('useJoker', async (gameCode, playerId, targetId) => {
        console.log('🃏 Utilisation du Joker:', { gameCode, playerId, targetId });
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) {
                console.log('❌ Partie non trouvée pour le Joker');
                return;
            }
            
            const player = game.players.find(p => p._id.toString() === playerId);
            if (!player || !player.hasJoker) {
                console.log('❌ Joker non disponible');
                socket.emit('error', 'Joker non disponible');
                return;
            }
            
            player.hasJoker = false;
            await player.save();
            console.log('✅ Joker utilisé par:', player.name);
            
            io.to(gameCode).emit('jokerUsed', {
                playerId,
                targetId,
                playerName: player.name
            });
            
        } catch (error) {
            console.error('❌ Erreur Joker:', error);
        }
    });

    // Déconnexion
    socket.on('disconnect', async () => {
        console.log('👋 Déconnexion:', socket.id);
        try {
            const player = await Player.findOne({ socketId: socket.id });
            if (player) {
                player.isConnected = false;
                await player.save();
                console.log('✅ Joueur marqué comme déconnecté:', player.name);

                const game = await Game.findOne({ players: player._id });
                if (game) {
                    io.to(game.code).emit('playerDisconnected', player._id);
                }
            }
        } catch (error) {
            console.error('❌ Erreur disconnect:', error);
        }
    });
});

// Générateur de missions
async function generateMission(level) {
    console.log('🎲 Génération de mission niveau:', level);
    try {
        if (level <= 3) {
            throw new Error('Niveaux 1-3 sur cartes physiques');
        }

        const categories = {
            4: ['sketch', 'présentation'],
            5: ['impro', 'analyse'],
            6: ['sketch', 'performance'],
            7: ['présentation', 'analyse'],
            8: ['dialogue', 'absurde'],
            9: ['performance', 'dialogue'],
            10: ['absurde', 'performance']
        };

        const availableCategories = categories[level] || ['performance'];
        const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        console.log('📋 Catégorie choisie:', category);

        console.log('🤖 Appel à OpenAI...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Générateur de missions Splenderra : Legend IA - Niveau ${level}/10, catégorie ${category}. Les missions doivent être réalisables en 2 minutes maximum.`
                },
                {
                    role: "user",
                    content: `Génère une mission de ${category} niveau ${level}/10.

TYPES DE PERFORMANCES :

SKETCH HUMORISTIQUE :
- Mini-scène comique (2 minutes max)
- Situation drôle et punchy
- Impact immédiat
Exemple :
VOTRE MISSION : Improvisez un sketch sur une situation quotidienne qui dérape
SUGGESTION : Situation claire, punch final, rythme rapide

PRÉSENTATION :
- Point de vue à défendre (2 minutes)
- Opinion décalée mais crédible
- Arguments surprenants
Exemple :
VOTRE MISSION : Présentez une théorie improbable sur un fait du quotidien
SUGGESTION : Arguments simples, exemples concrets, conviction totale

PERFORMANCE :
- Mini-spectacle express
- Impact fort et direct
- Participation du public
Exemple :
VOTRE MISSION : Transformez une situation banale en moment épique
SUGGESTION : Énergie maximale, public impliqué, final mémorable

DIALOGUE :
- Conversation à deux voix
- Situation décalée
- Humour et rythme
Exemple :
VOTRE MISSION : Jouez les deux côtés d'une dispute absurde
SUGGESTION : Changements de voix clairs, montée en intensité

RÈGLES ESSENTIELLES :

1. TEMPS SERRÉ
- 2 minutes maximum
- Rythme soutenu
- Impact rapide

2. PARTICIPATION
- Public impliqué
- Réactions encouragées
- Moment collectif

FORMAT :
**VOTRE MISSION**
[Mission claire et directe]
**SUGGESTION**
[Conseils pratiques]`
                }
            ],
            temperature: 0.9,
            max_tokens: 300,
            presence_penalty: 0.7,
            frequency_penalty: 0.9
        });

        const response = completion.choices[0].message.content;
        console.log('✅ Mission générée par OpenAI');
        
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
        if (error.message === 'Niveaux 1-3 sur cartes physiques') {
            console.log('ℹ️ Tentative de générer une mission de niveau 1-3');
            throw error;
        }
        throw error;
    }
}

// Routes pour les missions
app.get('/mission/:level', async (req, res) => {
    console.log('🎮 Demande de mission niveau:', req.params.level);
    try {
        const level = parseInt(req.params.level);
        const mission = await generateMission(level);
        console.log('✅ Mission générée avec succès');
        res.json(mission);
    } catch (error) {
        if (error.message === 'Niveaux 1-3 sur cartes physiques') {
            console.log('ℹ️ Niveau 1-3 demandé');
            res.status(400).json({ error: 'Utilisez les cartes physiques pour les niveaux 1-3' });
        } else {
            console.error('❌ Erreur mission:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 Serveur Splenderra : Legend IA en ligne sur le port', PORT);
    console.log('📌 URLs disponibles:');
    console.log('   - Interface centrale: /central/');
    console.log('   - Interface joueur: /player/');
});

module.exports = { app, io, generateMission };