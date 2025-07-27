document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const setupScreen = document.getElementById('setup-screen');
    const nameEntryBox = document.getElementById('name-entry-box');
    const playerNameInput = document.getElementById('player-name-input');
    const submitNameBtn = document.getElementById('submit-name-btn');
    const instructionsScreen = document.getElementById('instructions-screen');
    const continueToLobbyBtn = document.getElementById('continue-to-lobby-btn');
    const joinOptions = document.getElementById('join-options');
    const createGameBtn = document.getElementById('create-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const roomInfo = document.getElementById('room-info');
    const roomIdDisplay = document.getElementById('room-id-display');
    const playerList = document.getElementById('player-list');
    const startGameBtn = document.getElementById('force-start-game-btn');
    const errorMessage = document.getElementById('error-message');
    const gameScreen = document.getElementById('game-screen');
    const boardElement = document.getElementById('game-board');
    const rollButton = document.getElementById('roll-button');
    const diceElement = document.getElementById('dice');
    const playerTurnElement = document.getElementById('player-turn');
    const winnerMessageElement = document.getElementById('winner-message');
    const extraTurnMessage = document.getElementById('extra-turn-message');
    
    let isHost = false;
    let myPlayerNum = -1;
    let playerName = '';
    const playerColors = ['#ff3b30', '#007aff', '#ffcc00', '#af52de'];
    const snakes = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 };
    const ladders = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };

    // --- Setup Flow ---
    submitNameBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name) {
            playerName = name;
            nameEntryBox.classList.add('hidden');
            instructionsScreen.classList.remove('hidden');
        } else {
            errorMessage.innerText = 'Please enter a name.';
            setTimeout(() => errorMessage.innerText = '', 3000);
        }
    });

    continueToLobbyBtn.addEventListener('click', () => {
        instructionsScreen.classList.add('hidden');
        joinOptions.classList.remove('hidden');
    });

    // --- Socket Emitters ---
    createGameBtn.addEventListener('click', () => socket.emit('createGame', { name: playerName }));
    joinGameBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.toUpperCase();
        if (roomId) socket.emit('joinGame', { roomId, name: playerName });
    });
    startGameBtn.addEventListener('click', () => socket.emit('startGameRequest'));
    rollButton.addEventListener('click', () => {
        rollButton.disabled = true;
        extraTurnMessage.classList.add('hidden');
        socket.emit('rollDice');
    });

    // --- Socket Listeners ---
    socket.on('gameCreated', ({ roomId }) => {
        isHost = true;
        roomIdDisplay.innerText = roomId;
        joinOptions.classList.add('hidden');
        roomInfo.classList.remove('hidden');
    });

    socket.on('lobbyUpdate', (gameState) => {
        playerList.innerHTML = '';
        gameState.players.forEach(p => {
            const playerItem = document.createElement('li');
            playerItem.innerText = p.name;
            playerItem.style.color = playerColors[p.playerNum - 1];
            playerList.appendChild(playerItem);
        });
        startGameBtn.classList.toggle('hidden', !(isHost && gameState.players.length >= 2));
    });

    socket.on('gameStart', (gameState) => {
        myPlayerNum = gameState.players.find(p => p.id === socket.id).playerNum;
        setupScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        createBoard();
        drawSnakesAndLadders();
        updateBoard(gameState);
    });

    socket.on('gameUpdate', ({ state, roll }) => {
        animateDice(roll, () => {
            updateBoard(state);
            const currentPlayer = state.players[state.currentPlayerIndex];
            // --- NEW LOGIC: Only check for a roll of 6 ---
            if (roll === 6 && currentPlayer.id === socket.id) {
                extraTurnMessage.classList.remove('hidden');
            }
        });
    });
    
    socket.on('gameOver', ({ winnerId, state }) => {
        const winner = state.players.find(p => p.id === winnerId);
        animateDice(6, () => {
            updateBoard(state);
            winnerMessageElement.innerText = `🎉 ${winner.name} Wins! 🎉`;
            winnerMessageElement.classList.remove('hidden');
            rollButton.disabled = true;
        });
    });
    
    socket.on('error', ({ message }) => {
        errorMessage.innerText = message;
        setTimeout(() => errorMessage.innerText = '', 3000);
    });

    // --- Render Functions ---
    function updateBoard(state) {
        document.querySelectorAll('.player').forEach(el => el.remove());
        state.players.forEach((p) => {
            const playerEl = document.createElement('div');
            playerEl.id = `player-${p.playerNum}`;
            playerEl.classList.add('player');
            playerEl.style.backgroundColor = playerColors[p.playerNum - 1];
            boardElement.appendChild(playerEl);
            updatePlayerPosition(playerEl, p.position, p.playerNum);
        });

        const currentPlayer = state.players[state.currentPlayerIndex];
        playerTurnElement.innerText = `${currentPlayer.name}'s Turn`;
        playerTurnElement.style.color = playerColors[currentPlayer.playerNum - 1];
        rollButton.disabled = (currentPlayer.id !== socket.id);
    }
    
    function createBoard() {
        boardElement.innerHTML = '<div id="snakes-ladders-container"></div>'; 
        let squares = Array.from({ length: 100 }, (_, i) => i + 1);
        let boardNumbers = [];
        for (let i = 0; i < 10; i++) {
            let row = squares.slice(i * 10, (i + 1) * 10);
            if (i % 2 !== 0) row.reverse();
            boardNumbers.push(...row);
        }
        boardNumbers.reverse(); 
        for (const num of boardNumbers) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.id = `square-${num}`;
            square.innerText = num;
            boardElement.appendChild(square);
        }
    }

    function updatePlayerPosition(playerEl, position, playerNum) {
        const offset = 5 * (playerNum - 1);
        if (position === 0) {
            playerEl.style.display = 'none';
        } else {
            playerEl.style.display = 'block';
            const squareEl = document.getElementById(`square-${position}`);
            const squareRect = squareEl.getBoundingClientRect();
            const boardRect = boardElement.getBoundingClientRect();
            playerEl.style.bottom = `${boardRect.height - (squareRect.bottom - boardRect.top) + 5}px`;
            playerEl.style.left = `${squareRect.left - boardRect.left + offset}px`;
        }
    }

    function drawSnakesAndLadders() {
        const svgNS = "http://www.w3.org/2000/svg";
        const container = document.getElementById('snakes-ladders-container');
        if (!container) return; 
        
        const svg = document.createElementNS(svgNS, "svg");
        container.innerHTML = '';
        container.appendChild(svg);

        const getSquareCenter = (squareNum) => {
            const squareElement = document.getElementById(`square-${squareNum}`);
            if (!squareElement) return null;
            const rect = squareElement.getBoundingClientRect();
            const boardRect = boardElement.getBoundingClientRect();
            return { x: rect.left - boardRect.left + rect.width / 2, y: rect.top - boardRect.top + rect.height / 2 };
        };

        for (const start in snakes) {
            const end = snakes[start];
            const startPos = getSquareCenter(start);
            const endPos = getSquareCenter(end);
            if (!startPos || !endPos) continue;
            const controlX = (startPos.x + endPos.x) / 2 + (startPos.y - endPos.y) * 0.3;
            const controlY = (startPos.y + endPos.y) / 2 + (endPos.x - startPos.x) * 0.3;
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', `M${startPos.x},${startPos.y} Q${controlX},${controlY} ${endPos.x},${endPos.y}`);
            path.classList.add('snake-path');
            svg.appendChild(path);
        }

        for (const start in ladders) {
            const end = ladders[start];
            const startPos = getSquareCenter(start);
            const endPos = getSquareCenter(end);
            if (!startPos || !endPos) continue;
            const ladderGroup = document.createElementNS(svgNS, 'g');
            ladderGroup.classList.add('ladder-group');
            const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
            const perpAngle = angle + Math.PI / 2;
            const ladderWidth = 8;
            const dx = Math.cos(perpAngle) * ladderWidth;
            const dy = Math.sin(perpAngle) * ladderWidth;
            const side1 = document.createElementNS(svgNS, 'line');
            side1.setAttribute('x1', startPos.x - dx); side1.setAttribute('y1', startPos.y - dy);
            side1.setAttribute('x2', endPos.x - dx); side1.setAttribute('y2', endPos.y - dy);
            side1.classList.add('side');
            const side2 = document.createElementNS(svgNS, 'line');
            side2.setAttribute('x1', startPos.x + dx); side2.setAttribute('y1', startPos.y + dy);
            side2.setAttribute('x2', endPos.x + dx); side2.setAttribute('y2', endPos.y + dy);
            side2.classList.add('side');
            ladderGroup.appendChild(side1);
            ladderGroup.appendChild(side2);
            const numRungs = Math.floor(Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) / 15);
            for (let i = 1; i <= numRungs; i++) {
                const rung = document.createElementNS(svgNS, 'line');
                const ratio = i / (numRungs + 1);
                const rungX1 = startPos.x * (1 - ratio) + endPos.x * ratio - dx;
                const rungY1 = startPos.y * (1 - ratio) + endPos.y * ratio - dy;
                const rungX2 = startPos.x * (1 - ratio) + endPos.x * ratio + dx;
                const rungY2 = startPos.y * (1 - ratio) + endPos.y * ratio + dy;
                rung.setAttribute('x1', rungX1); rung.setAttribute('y1', rungY1);
                rung.setAttribute('x2', rungX2); rung.setAttribute('y2', rungY2);
                rung.classList.add('rung');
                ladderGroup.appendChild(rung);
            }
            svg.appendChild(ladderGroup);
        }
    }

    function animateDice(roll, callback) {
        const randomX = (Math.floor(Math.random() * 8) + 4) * 360;
        const randomY = (Math.floor(Math.random() * 8) + 4) * 360;
        let finalX = 0, finalY = 0;

        switch (roll) {
            case 1: break;
            case 2: finalX = -90; break;
            case 3: finalY = -90; break;
            case 4: finalY = 90; break;
            case 5: finalX = 90; break;
            case 6: finalY = 180; break;
        }
        
        diceElement.style.transform = `rotateX(${randomX + finalX}deg) rotateY(${randomY + finalY}deg)`;
        setTimeout(callback, 1600);
    }
});