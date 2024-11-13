// Modèle MongoDB pour l'historique des missions
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

// Système de génération de missions
async function generateMission(level, theme, playerId, gameId, isRegeneration = false) {
    console.log('🎲 Génération mission:', { level, theme, isRegeneration });

    // Vérifier le nombre de régénérations restantes
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
                regenerationsLeft: isRegeneration ? 2 : 3 // 3 régénérations au départ
            }
        });
        await missionHistory.save();

        return mission;
    } catch (error) {
        console.error('❌ Erreur génération mission:', error);
        throw error;
    }
}

// Obtenir le type de mission selon le niveau
function getMissionType(level) {
    if (level <= 3) {
        return [
            'présentation simple',
            'mini-sketch',
            'observation'
        ];
    } else if (level <= 7) {
        return [
            'sketch humoristique',
            'présentation point de vue',
            'analyse de groupe'
        ];
    } else {
        return [
            'performance complexe',
            'dialogue multi-personnages',
            'situation absurde'
        ];
    }
}

// Construire le prompt selon niveau et thème
function getMissionPrompt(level, theme) {
    const basePrompt = `Crée une mission de niveau ${level} pour le thème "${theme}".

STRUCTURE DE LA MISSION :
Pour un niveau ${level}/10, la mission doit être :
- Adaptée au niveau d'intensité
- Réalisable en 2 minutes
- Claire et directe
- Immersive et engageante

THÈMES POSSIBLES :
- Humour et légèreté : missions fun et décontractées
- Défis sérieux : missions de prise de parole et argumentation
- Coaching collectif : missions de développement et collaboration
- Improvisation créative : missions théâtrales et artistiques

NIVEAUX D'INTENSITÉ :
Niveaux 1-3 : Introduction et découverte
- Missions simples et accessibles
- Focus sur la prise de confiance
- Participation progressive

Niveaux 4-7 : Développement
- Missions plus élaborées
- Créativité et spontanéité
- Interaction avec le groupe

Niveaux 8-10 : Maîtrise
- Missions complexes
- Performance avancée
- Impact maximum

FORMAT DE SORTIE :
**VOTRE MISSION**
[Mission claire et directe]
**SUGGESTION**
[Guide pratique pour réussir]`;

    return basePrompt;
}

// Parser la réponse de l'IA
function parseMissionResponse(response) {
    const mission = response.split('**VOTRE MISSION**')[1].split('**SUGGESTION**')[0].trim();
    const suggestion = response.split('**SUGGESTION**')[1].trim();

    return {
        task: mission,
        suggestion
    };
}

// Récupérer l'historique des missions d'un joueur
async function getPlayerMissionHistory(playerId) {
    try {
        return await MissionHistory.find({ playerId })
            .sort({ createdAt: -1 })
            .populate('gameId');
    } catch (error) {
        console.error('❌ Erreur récupération historique:', error);
        throw error;
    }
}

// Régénérer une mission
async function regenerateMission(playerId, gameId, level, theme) {
    return generateMission(level, theme, playerId, gameId, true);
}

// Sauvegarder performance
async function saveMissionPerformance(missionId, performance) {
    try {
        const mission = await MissionHistory.findById(missionId);
        if (!mission) throw new Error('Mission non trouvée');

        mission.performance = performance;
        await mission.save();

        return mission;
    } catch (error) {
        console.error('❌ Erreur sauvegarde performance:', error);
        throw error;
    }
}

// Routes pour le système de missions
app.get('/mission/history/:playerId', async (req, res) => {
    try {
        const history = await getPlayerMissionHistory(req.params.playerId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/mission/regenerate', async (req, res) => {
    try {
        const { playerId, gameId, level, theme } = req.body;
        const mission = await regenerateMission(playerId, gameId, level, theme);
        res.json(mission);
    } catch (error) {
        if (error.message === 'Plus de régénérations disponibles') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

app.post('/mission/performance', async (req, res) => {
    try {
        const { missionId, performance } = req.body;
        const updatedMission = await saveMissionPerformance(missionId, performance);
        res.json(updatedMission);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// WebSocket pour les mises à jour en temps réel
io.on('connection', (socket) => {
    // Demande de mission
    socket.on('requestMission', async ({ playerId, gameId, level, theme }) => {
        try {
            const mission = await generateMission(level, theme, playerId, gameId);
            socket.emit('missionGenerated', mission);
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    // Régénération de mission
    socket.on('regenerateMission', async ({ playerId, gameId, level, theme }) => {
        try {
            const mission = await regenerateMission(playerId, gameId, level, theme);
            socket.emit('missionRegenerated', mission);
        } catch (error) {
            socket.emit('error', error.message);
        }
    });
});