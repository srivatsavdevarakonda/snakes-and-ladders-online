// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let games = {};

const snakes = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 };
const ladders = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
const boardSize = 100;
const MAX_PLAYERS = 4;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createGame', ({ name }) => {
        const roomId = Math.random().toString(36).substr(2, 5).toUpperCase();
        socket.join(roomId);

        games[roomId] = {
            players: [{ id: socket.id, position: 0, playerNum: 1, name: name }],
            currentPlayerIndex: 0,
            roomId: roomId,
            hostId: socket.id
        };
        socket.emit('gameCreated', { roomId });
        io.to(roomId).emit('lobbyUpdate', games[roomId]);
    });

    socket.on('joinGame', ({ roomId, name }) => {
        const room = games[roomId];
        if (!room) {
            return socket.emit('error', { message: 'Room not found.' });
        }
        if (room.players.length >= MAX_PLAYERS) {
            return socket.emit('error', { message: 'Room is full.' });
        }

        socket.join(roomId);
        const playerNum = room.players.length + 1;
        room.players.push({ id: socket.id, position: 0, playerNum: playerNum, name: name });

        io.to(roomId).emit('lobbyUpdate', room);
    });

    socket.on('startGameRequest', () => {
        const roomId = [...socket.rooms].find(r => r !== socket.id);
        const game = games[roomId];
        if (game && game.hostId === socket.id && game.players.length >= 2) {
            io.to(roomId).emit('gameStart', game);
        }
    });

    socket.on('rollDice', () => {
        const roomId = [...socket.rooms].find(r => r !== socket.id);
        const game = games[roomId];

        if (!game || socket.id !== game.players[game.currentPlayerIndex].id) return;

        const diceRoll = Math.floor(Math.random() * 6) + 1;
        let player = game.players[game.currentPlayerIndex];

        if (player.position + diceRoll <= boardSize) player.position += diceRoll;
        
        // --- NEW LOGIC: Resolve snakes/ladders immediately ---
        if (snakes[player.position]) player.position = snakes[player.position];
        else if (ladders[player.position]) player.position = ladders[player.position];
        
        if (player.position === boardSize) {
            io.to(roomId).emit('gameOver', { winnerId: player.id, state: game });
            delete games[roomId];
            return;
        }

        // --- NEW LOGIC: Only give extra turn on a 6 ---
        if (diceRoll !== 6) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
        
        io.to(roomId).emit('gameUpdate', { state: game, roll: diceRoll });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        const roomId = Object.keys(games).find(r => games[r] && games[r].players.some(p => p.id === socket.id));
        if (roomId && games[roomId]) {
            games[roomId].players = games[roomId].players.filter(p => p.id !== socket.id);
            if (games[roomId].players.length === 0) {
                delete games[roomId];
            } else {
                games[roomId].players.forEach((p, i) => p.playerNum = i + 1);
                io.to(roomId).emit('lobbyUpdate', games[roomId]);
                io.to(roomId).emit('opponentDisconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));