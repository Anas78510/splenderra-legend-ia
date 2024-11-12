// SPLENDERRA : LEGEND IA
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
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
    }]
});

const Player = mongoose.model('Player', {
    name: String,
    socketId: String,
    credibilityPoints: { type: Number, default: 1 },
    hasJoker: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
    isConnected: { type: Boolean, default: true }
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
    }
});

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connecté'))
    .catch(err => console.error('Erreur MongoDB:', err));

// Routes principales
app.get('/', (req, res) => {
    res.redirect('/central/');
});

app.get('/central/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'central', 'index.html'));
});

app.get('/player/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player', 'index.html'));
});

// Route de création de partie
app.post('/game/create', async (req, res) => {
    try {
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new Game({
            code: gameCode,
            players: [],
            activeRound: 0,
            startTime: new Date(),
            status: 'waiting'
        });
        
        await game.save();
        res.json({ 
            gameCode,
            message: 'Partagez ce code avec les joueurs'
        });
    } catch (error) {
        console.error('Erreur création partie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route de vérification de partie
app.get('/game/:code', async (req, res) => {
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
        console.error('Erreur vérification partie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route admin pour générer des codes
app.post('/admin/generate-codes', async (req, res) => {
    try {
        const { count = 100, prefix = 'ASC' } = req.body;
        const adminCode = req.headers['x-admin-code'];
        
        if (adminCode !== process.env.ADMIN_CODE) {
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
        res.json({ message: `${count} codes générés`, codes: codes.map(c => c.code) });
    } catch (error) {
        console.error('Erreur génération codes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});// WebSocket - Gestion temps réel
io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    // Rejoindre une partie
    socket.on('joinGame', async (gameCode, playerName) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) {
                socket.emit('error', 'Partie non trouvée');
                return;
            }
            
            // Créer nouveau joueur
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
            
            // Rejoindre la room socket
            socket.join(gameCode);
            
            // Informer tout le monde
            io.to(gameCode).emit('playerJoined', {
                id: player._id,
                name: player.name,
                score: player.score,
                hasJoker: player.hasJoker,
                isConnected: true
            });

            // Envoyer la liste complète des joueurs au nouveau joueur
            const fullGame = await Game.findOne({ code: gameCode }).populate('players');
            socket.emit('gameState', {
                players: fullGame.players,
                currentPlayer: fullGame.currentPlayer,
                arbiter: fullGame.arbiter,
                status: fullGame.status,
                currentMission: fullGame.currentMission
            });
            
        } catch (error) {
            console.error('Erreur joinGame:', error);
            socket.emit('error', 'Erreur de connexion');
        }
    });

    // Démarrer le tour d'un joueur
    socket.on('startTurn', async (gameCode, playerId, level) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            // Générer nouvelle mission si niveau > 3
            if (level > 3) {
                const mission = await generateMission(level);
                game.currentMission = mission;
            }

            game.currentPlayer = playerId;
            game.status = 'playing';
            await game.save();

            io.to(gameCode).emit('turnStarted', {
                currentPlayer: playerId,
                mission: game.currentMission,
                level: level
            });

            // Démarrer le chrono
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
            console.error('Erreur startTurn:', error);
        }
    });

    // Voter pour une performance
    socket.on('vote', async (gameCode, voterId, performerId) => {
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) return;
            
            // Trouver le votant
            const voter = game.players.find(p => p._id.toString() === voterId);
            if (!voter || voter.credibilityPoints < 1) {
                socket.emit('error', 'Vote impossible');
                return;
            }
            
            // Appliquer le vote
            voter.credibilityPoints--;
            await voter.save();

            // Ajouter point au performer
            const performer = game.players.find(p => p._id.toString() === performerId);
            if (performer) {
                performer.score++;
                await performer.save();
            }
            
            // Mettre à jour l'Arbitre
            const topPlayer = game.players.reduce((max, p) => p.score > max.score ? p : max);
            game.arbiter = topPlayer._id;
            await game.save();
            
            // Informer tout le monde
            io.to(gameCode).emit('scoreUpdate', {
                players: game.players,
                arbiter: game.arbiter
            });
            
        } catch (error) {
            console.error('Erreur vote:', error);
        }
    });

    // Utiliser son Joker
    socket.on('useJoker', async (gameCode, playerId, targetId) => {
        try {
            const game = await Game.findOne({ code: gameCode }).populate('players');
            if (!game) return;
            
            const player = game.players.find(p => p._id.toString() === playerId);
            if (!player || !player.hasJoker) {
                socket.emit('error', 'Joker non disponible');
                return;
            }
            
            // Utiliser le Joker
            player.hasJoker = false;
            await player.save();
            
            // Informer tout le monde
            io.to(gameCode).emit('jokerUsed', {
                playerId,
                targetId,
                playerName: player.name
            });
            
        } catch (error) {
            console.error('Erreur Joker:', error);
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
                    io.to(game.code).emit('playerDisconnected', player._id);
                }
            }
        } catch (error) {
            console.error('Erreur disconnect:', error);
        }
    });
});

// Générateur de missions
async function generateMission(level) {
    try {
        // Les niveaux 1-3 sont sur les cartes physiques
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
        
        const mission = response.split('**VOTRE MISSION**')[1].split('**SUGGESTION**')[0].trim();
        const suggestion = response.split('**SUGGESTION**')[1].trim();

        return {
            task: mission,
            suggestion,
            level,
            category
        };
    } catch (error) {
        console.error('Erreur génération mission:', error);
        throw error;
    }
}

// Routes pour les missions
app.get('/mission/:level', async (req, res) => {
    try {
        const level = parseInt(req.params.level);
        const mission = await generateMission(level);
        res.json(mission);
    } catch (error) {
        if (error.message === 'Niveaux 1-3 sur cartes physiques') {
            res.status(400).json({ error: 'Utilisez les cartes physiques pour les niveaux 1-3' });
        } else {
            console.error('Erreur mission:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur Splenderra : Legend IA en ligne sur le port ${PORT}`);
});

module.exports = { app, io, generateMission };