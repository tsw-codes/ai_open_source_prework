class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.viewportX = 0;
        this.viewportY = 0;
        
        // Movement state
        this.keysPressed = {};
        this.isMoving = false;
        this.currentDirection = null;
        this.movementLoopId = null;
        
        // WebSocket
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupEventListeners();
        this.connectToServer();
    }

    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.centerViewportOnMyAvatar();
            this.draw();
        });
    }

    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }

    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map at actual size (2048x2048)
        // Position it based on viewport offset
        this.ctx.drawImage(
            this.worldImage,
            0, 0, this.worldWidth, this.worldHeight,
            -this.viewportX, -this.viewportY, this.worldWidth, this.worldHeight
        );
    }

    // WebSocket connection methods
    connectToServer() {
        try {
            this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.ws.onopen = () => {
                console.log('Connected to game server');
                this.reconnectAttempts = 0;
                this.joinGame();
            };
            
            this.ws.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from game server');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
                this.connectToServer();
            }, 2000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Tim'
        };
        
        this.sendMessage(joinMessage);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected, cannot send message:', message);
        }
    }

    handleServerMessage(data) {
        console.log('Received message:', data);
        
        switch (data.action) {
            case 'join_game':
                this.handleJoinGame(data);
                break;
            case 'players_moved':
                this.handlePlayersMoved(data);
                break;
            case 'player_joined':
                this.handlePlayerJoined(data);
                break;
            case 'player_left':
                this.handlePlayerLeft(data);
                break;
            default:
                console.log('Unknown message type:', data.action);
        }
    }

    handleJoinGame(data) {
        if (data.success) {
            this.myPlayerId = data.playerId;
            this.players = data.players;
            this.avatars = data.avatars;
            
            console.log('Joined game successfully!');
            console.log('My player ID:', this.myPlayerId);
            console.log('Players:', this.players);
            console.log('Avatars:', this.avatars);
            
            // Center viewport on my avatar
            this.centerViewportOnMyAvatar();
            this.draw();
        } else {
            console.error('Failed to join game:', data.error);
        }
    }

    handlePlayersMoved(data) {
        // Update player positions
        Object.keys(data.players).forEach(playerId => {
            this.players[playerId] = { ...this.players[playerId], ...data.players[playerId] };
        });
        
        // Update viewport if my avatar moved
        if (this.myPlayerId && data.players[this.myPlayerId]) {
            this.updateViewportForMyAvatar();
        }
        
        this.draw();
    }

    handlePlayerJoined(data) {
        this.players[data.player.id] = data.player;
        this.avatars[data.avatar.name] = data.avatar;
        
        console.log('Player joined:', data.player.username);
        this.draw();
    }

    handlePlayerLeft(data) {
        delete this.players[data.playerId];
        console.log('Player left:', data.playerId);
        this.draw();
    }

    // Viewport management
    centerViewportOnMyAvatar() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate viewport offset to center my avatar
        this.viewportX = myPlayer.x - centerX;
        this.viewportY = myPlayer.y - centerY;
        
        // Clamp viewport to map boundaries
        this.viewportX = Math.max(0, Math.min(this.viewportX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(this.viewportY, this.worldHeight - this.canvas.height));
    }

    updateViewportForMyAvatar() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate desired viewport position
        const desiredViewportX = myPlayer.x - centerX;
        const desiredViewportY = myPlayer.y - centerY;
        
        // Smoothly update viewport (you can adjust this for smoother following)
        this.viewportX = Math.max(0, Math.min(desiredViewportX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(desiredViewportY, this.worldHeight - this.canvas.height));
    }

    // Coordinate conversion
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.viewportX,
            y: worldY - this.viewportY
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.viewportX,
            y: screenY + this.viewportY
        };
    }

    // Check if a world position is visible in the current viewport
    isPositionVisible(worldX, worldY) {
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -50 && screen.x <= this.canvas.width + 50 &&
               screen.y >= -50 && screen.y <= this.canvas.height + 50;
    }

    // Main draw method
    draw() {
        this.drawWorld();
        this.drawPlayers();
    }

    drawPlayers() {
        Object.values(this.players).forEach(player => {
            if (this.isPositionVisible(player.x, player.y)) {
                this.drawPlayer(player);
            }
        });
    }

    drawPlayer(player) {
        const screenPos = this.worldToScreen(player.x, player.y);
        const avatar = this.avatars[player.avatar];
        
        if (!avatar) return;
        
        // Get the correct frame for the player's direction and animation
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        let frameData = null;
        if (direction === 'west') {
            // Use east frames flipped horizontally
            frameData = avatar.frames.east[frameIndex];
        } else {
            frameData = avatar.frames[direction][frameIndex];
        }
        
        if (!frameData) return;
        
        // Create image from base64 data
        const img = new Image();
        img.onload = () => {
            // Calculate avatar size (you can adjust this)
            const avatarSize = 32;
            const x = screenPos.x - avatarSize / 2;
            const y = screenPos.y - avatarSize;
            
            // Draw avatar
            this.ctx.save();
            if (direction === 'west') {
                // Flip horizontally for west direction
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(img, -x - avatarSize, y, avatarSize, avatarSize);
            } else {
                this.ctx.drawImage(img, x, y, avatarSize, avatarSize);
            }
            this.ctx.restore();
            
            // Draw username label
            this.drawPlayerLabel(player.username, screenPos.x, screenPos.y - avatarSize - 5);
        };
        img.src = frameData;
    }

    drawPlayerLabel(username, x, y) {
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        // Draw text with outline
        this.ctx.strokeText(username, x, y);
        this.ctx.fillText(username, x, y);
        this.ctx.restore();
    }

    // Movement methods
    startMovement() {
        if (this.movementLoopId) return; // Already moving
        
        this.movementLoopId = requestAnimationFrame(() => this.movementLoop());
    }

    stopMovement() {
        if (this.movementLoopId) {
            cancelAnimationFrame(this.movementLoopId);
            this.movementLoopId = null;
        }
        this.isMoving = false;
        this.currentDirection = null;
        this.sendStopCommand();
    }

    movementLoop() {
        const pressedKeys = Object.keys(this.keysPressed);
        
        if (pressedKeys.length === 0) {
            this.stopMovement();
            return;
        }
        
        // Get the first pressed key (prioritize first pressed)
        const direction = this.getDirectionFromKey(pressedKeys[0]);
        
        if (direction && direction !== this.currentDirection) {
            this.currentDirection = direction;
            this.sendMoveCommand(direction);
        }
        
        // Continue the loop
        this.movementLoopId = requestAnimationFrame(() => this.movementLoop());
    }

    getDirectionFromKey(key) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'up',
            's': 'down',
            'a': 'left',
            'd': 'right'
        };
        return keyMap[key];
    }

    sendMoveCommand(direction) {
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        this.sendMessage(moveMessage);
        this.isMoving = true;
    }

    sendStopCommand() {
        const stopMessage = {
            action: 'stop'
        };
        this.sendMessage(stopMessage);
    }

    setupEventListeners() {
        // Add click event for future click-to-move functionality
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;
            
            // Convert screen coordinates to world coordinates
            const worldPos = this.screenToWorld(screenX, screenY);
            const worldX = Math.floor(worldPos.x);
            const worldY = Math.floor(worldPos.y);
            
            console.log(`Clicked at world coordinates: (${worldX}, ${worldY})`);
        });

        // Add keyboard event listeners for movement
        document.addEventListener('keydown', (event) => {
            const key = event.key;
            const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'];
            
            if (movementKeys.includes(key)) {
                event.preventDefault(); // Prevent default browser behavior
                
                if (!this.keysPressed[key]) {
                    this.keysPressed[key] = true;
                    this.startMovement();
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            const key = event.key;
            const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'];
            
            if (movementKeys.includes(key)) {
                event.preventDefault();
                delete this.keysPressed[key];
                
                if (Object.keys(this.keysPressed).length === 0) {
                    this.stopMovement();
                }
            }
        });
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
