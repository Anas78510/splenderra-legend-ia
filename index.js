const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config();

// Initialisation
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// MongoDB setup
mongoose.connect(process.env.MONGODB_URI);

// MongoDB Models
const Game = mongoose.model('Game', {
    code: String,
    players: [{
        id: String,
        name: String,
        score: { type: Number, default: 0 },
        hasJoker: { type: Boolean, default: true }
    }],
    currentPlayer: String,
    status: { type: String, default: 'waiting' }
});

// Servir les fichiers statiques
app.use(express.static('public'));
app.use(express.json());

// Gestion Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);

    // Créer une partie
    socket.on('createGame', async () => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        const game = new Game({ code });
        await game.save();
        socket.join(code);
        socket.emit('gameCreated', { code });
    });

    // Rejoindre une partie
    socket.on('joinGame', async (data) => {
        try {
            const game = await Game.findOne({ code: data.code });
            if (!game) {
                socket.emit('error', 'Partie non trouvée');
                return;
            }

            const player = {
                id: socket.id,
                name: data.name,
                score: 0,
                hasJoker: true
            };

            game.players.push(player);
            await game.save();

            socket.join(data.code);
            io.to(data.code).emit('playerJoined', {
                players: game.players,
                newPlayer: player
            });
        } catch (error) {
            socket.emit('error', 'Erreur de connexion');
        }
    });

    // Générer une mission
    socket.on('requestMission', async (data) => {
        try {
            const mission = await generateMission(data.level);
            io.to(data.gameCode).emit('missionReceived', mission);
        } catch (error) {
            socket.emit('error', 'Erreur génération mission');
        }
    });

    // Vote
    socket.on('vote', async (data) => {
        try {
            const game = await Game.findOne({ code: data.gameCode });
            const player = game.players.find(p => p.id === data.targetId);
            if (player) {
                player.score += 1;
                await game.save();
                io.to(data.gameCode).emit('scoreUpdated', game.players);
            }
        } catch (error) {
            socket.emit('error', 'Erreur de vote');
        }
    });
});

// Génération de mission
async function generateMission(level) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: `Génère une mission d'improvisation de niveau ${level}/10, réalisable en 2 minutes.`
            }],
            temperature: 0.8,
            max_tokens: 100
        });

        return {
            task: completion.choices[0].message.content,
            level
        };
    } catch (error) {
        console.error('Erreur génération:', error);
        throw error;
    }
}

// Démarrage serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en ligne sur le port ${PORT}`);
});