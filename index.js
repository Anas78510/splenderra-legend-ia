// SPLENDERRA : LEGEND IA
// Configuration principale
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const OpenAI = require('openai');

// Initialisation serveur
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Configuration OpenAI & Middleware
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(express.static('public'));
app.use(express.json());

// Modèles MongoDB
const Player = mongoose.model('Player', {
    name: String,
    socketId: String,
    credibilityPoints: { type: Number, default: 1 },
    hasJoker: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    isArbiter: { type: Boolean, default: false },
    performances: [{
        missionId: mongoose.Schema.Types.ObjectId,
        votes: Number,
        level: Number,
        success: Boolean,
        date: Date
    }],
    createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', {
    code: String,
    status: { 
        type: String, 
        enum: ['waiting', 'playing', 'finished'],
        default: 'waiting'
    },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    arbiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    currentMission: {
        task: String,
        suggestion: String,
        level: Number,
        regenerationsLeft: { type: Number, default: 3 }
    },
    rounds: [{
        player: mongoose.Schema.Types.ObjectId,
        mission: String,
        votes: Number,
        success: Boolean,
        timeSpent: Number
    }],
    startTime: Date,
    endTime: Date,
    createdAt: { type: Date, default: Date.now }
});

const Mission = mongoose.model('Mission', {
    playerId: mongoose.Schema.Types.ObjectId,
    gameId: mongoose.Schema.Types.ObjectId,
    task: String,
    suggestion: String,
    level: Number,
    votes: { type: Number, default: 0 },
    arbiterValidation: Boolean,
    regenerationsLeft: { type: Number, default: 3 },
    performance: {
        success: Boolean,
        timeSpent: Number,
        jokerUsed: Boolean
    },
    createdAt: { type: Date, default: Date.now }
});

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('💾 MongoDB connecté'))
    .catch(err => console.error('❌ Erreur MongoDB:', err));

// Générateur de missions
async function generateMission(level, theme = 'standard') {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Tu es le Créateur de missions pour Splenderra : Legend IA.
                    Niveau actuel: ${level}/10
                    Thème: ${theme}
                    
                    Les missions doivent être :
                    - Réalisables en 2 minutes exactement
                    - Adaptées au niveau d'intensité
                    - Immersives et engageantes
                    - Créer des moments mémorables`
                },
                {
                    role: "user",
                    content: `Génère une mission de niveau ${level}.

TYPES DE PERFORMANCES SELON NIVEAU :

Niveaux 1-3 (Introduction) :
- Narration simple
- Mini-sketch
- Observation du groupe

Niveaux 4-7 (Développement) :
- Sketch humoristique
- Présentation convaincante
- Analyse de situation
- Performance d'impro

Niveaux 8-10 (Maîtrise) :
- Performance complexe
- Dialogues multi-personnages
- Situations absurdes
- Moments épiques

FORMAT :
**VOTRE MISSION**
[Mission claire et directe]
**SUGGESTION**
[Guide pratique et stratégique pour réussir]`
                }
            ],
            temperature: 0.9,
            max_tokens: 300
        });

        const response = completion.choices[0].message.content;
        const mission = response.split('**VOTRE MISSION**')[1].split('**SUGGESTION**')[0].trim();
        const suggestion = response.split('**SUGGESTION**')[1].trim();

        return {
            task: mission,
            suggestion,
            level,
            regenerationsLeft: 3
        };
    } catch (error) {
        console.error('❌ Erreur génération mission:', error);
        throw error;
    }
}
// Gestion Socket.IO
io.on('connection', (socket) => {
    console.log('🔌 Nouvelle connexion:', socket.id);

    // Rejoindre une partie
    socket.on('joinGame', async ({ code, name }) => {
        try {
            const game = await Game.findOne({ code }).populate('players');
            if (!game) {
                socket.emit('error', 'Partie non trouvée');
                return;
            }

            // Création du joueur
            const player = new Player({
                name,
                socketId: socket.id,
                credibilityPoints: 1,
                hasJoker: true,
                level: 1,
                score: 0
            });
            await player.save();

            // Ajout à la partie
            game.players.push(player._id);
            
            // Premier joueur = Arbitre
            if (game.players.length === 1) {
                game.arbiter = player._id;
                player.isArbiter = true;
                await player.save();
            }

            await game.save();
            
            socket.join(code);
            
            // Informer tout le monde
            const updatedGame = await Game.findOne({ code })
                .populate('players')
                .populate('arbiter')
                .populate('currentPlayer');

            io.to(code).emit('gameUpdated', {
                game: updatedGame,
                newPlayer: player
            });

        } catch (error) {
            console.error('❌ Erreur join:', error);
            socket.emit('error', 'Erreur de connexion');
        }
    });

    // Démarrer un tour
    socket.on('startTurn', async ({ gameCode, playerId }) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const player = await Player.findById(playerId);
            if (!player) return;

            // Générer mission
            const mission = await generateMission(player.level);
            game.currentPlayer = playerId;
            game.currentMission = mission;
            game.status = 'playing';
            await game.save();

            // Informer tout le monde
            io.to(gameCode).emit('turnStarted', {
                player: player,
                mission: mission
            });

            // Timer 2 minutes
            let timeLeft = 120;
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
    socket.on('vote', async ({ gameCode, voterId, targetId, isArbiter }) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const voter = await Player.findById(voterId);
            const target = await Player.findById(targetId);

            if (!voter || !target) return;

            // Vérifier points de crédibilité
            if ((!isArbiter && voter.credibilityPoints < 1) || 
                (isArbiter && voter.credibilityPoints < 2)) {
                socket.emit('error', 'Plus de points disponibles');
                return;
            }

            // Appliquer le vote
            const pointsToAdd = isArbiter ? 2 : 1;
            target.score += pointsToAdd;
            voter.credibilityPoints--;

            // Mise à jour niveau si nécessaire
            if (target.score >= target.level * 3) {
                target.level++;
            }

            await Promise.all([target.save(), voter.save()]);

            // Informer tout le monde
            io.to(gameCode).emit('voteRegistered', {
                target: target,
                voter: voter,
                pointsAdded: pointsToAdd
            });

        } catch (error) {
            console.error('❌ Erreur vote:', error);
        }
    });

    // Utiliser Joker
    socket.on('useJoker', async ({ gameCode, playerId, targetId }) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const player = await Player.findById(playerId);
            const target = await Player.findById(targetId);

            if (!player || !target || !player.hasJoker) {
                socket.emit('error', 'Joker non disponible');
                return;
            }

            // Utiliser le joker
            player.hasJoker = false;
            await player.save();

            // Informer tout le monde
            io.to(gameCode).emit('jokerUsed', {
                player: player,
                target: target
            });

        } catch (error) {
            console.error('❌ Erreur joker:', error);
        }
    });

    // Régénérer mission
    socket.on('regenerateMission', async ({ gameCode, playerId }) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game || game.currentMission.regenerationsLeft < 1) {
                socket.emit('error', 'Régénération impossible');
                return;
            }

            const player = await Player.findById(playerId);
            if (!player) return;

            // Générer nouvelle mission
            const newMission = await generateMission(player.level);
            game.currentMission = {
                ...newMission,
                regenerationsLeft: game.currentMission.regenerationsLeft - 1
            };
            await game.save();

            // Informer tout le monde
            io.to(gameCode).emit('missionRegenerated', {
                mission: game.currentMission,
                regenerationsLeft: game.currentMission.regenerationsLeft
            });

        } catch (error) {
            console.error('❌ Erreur régénération:', error);
        }
    });

    // Fin de tour
    socket.on('endTurn', async ({ gameCode, playerId, success }) => {
        try {
            const game = await Game.findOne({ code: gameCode });
            if (!game) return;

            const player = await Player.findById(playerId);
            if (!player) return;

            // Sauvegarder performance
            const mission = new Mission({
                playerId: playerId,
                gameId: game._id,
                task: game.currentMission.task,
                suggestion: game.currentMission.suggestion,
                level: player.level,
                votes: player.score,
                arbiterValidation: success
            });
            await mission.save();

            // Passer au joueur suivant
            const playerIndex = game.players.indexOf(playerId);
            const nextIndex = (playerIndex + 1) % game.players.length;
            game.currentPlayer = game.players[nextIndex];
            game.status = 'waiting';
            await game.save();

            // Informer tout le monde
            io.to(gameCode).emit('turnCompleted', {
                player: player,
                success: success,
                nextPlayer: game.currentPlayer
            });

        } catch (error) {
            console.error('❌ Erreur endTurn:', error);
        }
    });

    // Déconnexion
    socket.on('disconnect', async () => {
        try {
            const player = await Player.findOne({ socketId: socket.id });
            if (!player) return;

            const game = await Game.findOne({ players: player._id });
            if (game) {
                io.to(game.code).emit('playerDisconnected', player);
            }

        } catch (error) {
            console.error('❌ Erreur disconnect:', error);
        }
    });
});

// Routes API
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
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/player/:id/stats', async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        const missions = await Mission.find({ playerId: req.params.id })
            .sort('-createdAt')
            .limit(10);

        res.json({
            player,
            recentMissions: missions
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Lancement serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
🎮 Splenderra : Legend IA en ligne sur le port ${PORT}
🎯 Système de jeu prêt
✨ En attente des joueurs
    `);
});

module.exports = { app, io };