const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const paddleWidth = 10;
const paddleHeight = 100;
const barWidth = 8;

// --- CLASE PELOTA ---
class Ball {
    constructor(x, y, radius, speedX, speedY, color) {
        this.x = x; this.y = y; 
        this.radius = radius; 
        this.speedX = speedX; this.speedY = speedY; 
        this.color = color;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill(); ctx.closePath();
    }
    move() {
        this.x += this.speedX; this.y += this.speedY;
        if (this.y - this.radius <= 0 || this.y + this.radius >= canvas.height) this.speedY = -this.speedY;
    }
    reset() {
        this.x = canvas.width / 2; this.y = canvas.height / 2;
        this.speedX = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
        this.speedY = (Math.random() - 0.5) * 10;
    }
}

// --- CLASE PALETA ---
class Paddle {
    constructor(x, y, width, height, color, isLeft) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.baseColor = color; this.isLeft = isLeft;
        this.speed = 8.5;
        this.flashFrames = 0;
        this.maxEnergy = 100;
        this.energy = 100;
    }

    draw() {
        ctx.fillStyle = this.flashFrames > 0 ? "white" : this.baseColor;
        if (this.flashFrames > 0) this.flashFrames--;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        const barX = this.isLeft ? this.x - 15 : this.x + this.width + 7;
        const energyHeight = (this.energy / this.maxEnergy) * canvas.height;
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(barX, 0, barWidth, canvas.height);
        ctx.fillStyle = this.baseColor;
        ctx.fillRect(barX, canvas.height - energyHeight, barWidth, energyHeight);
    }

    hitEffect() { this.flashFrames = 5; }

    updateEnergy(isDashing, costMult = 1) {
        if (isDashing && this.energy > 0) {
            this.energy -= 0.9 * costMult;
        } else if (this.energy < this.maxEnergy) {
            this.energy += 0.22; 
        }
        if (this.energy < 0) this.energy = 0;
    }

    applyMove(direction, isDashing) {
        let canDash = isDashing && this.energy > 5;
        this.updateEnergy(canDash);
        let currentSpeed = canDash ? this.speed * 2.1 : this.speed;
        if (direction === 'up' && this.y > 0) this.y -= currentSpeed;
        if (direction === 'down' && this.y + this.height < canvas.height) this.y += currentSpeed;
    }

    autoMove(balls) {
        let incomingBalls = balls.filter(b => b.speedX > 0 && b.x > canvas.width / 2.5);
        if (incomingBalls.length === 0) { this.updateEnergy(false); return; }
        
        let targetBall = incomingBalls.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
        let center = this.y + this.height / 2;
        
        if (Math.abs(targetBall.y - center) < 35) {
            this.updateEnergy(false);
            return;
        }

        let shouldDash = Math.abs(targetBall.y - center) > 110 && this.energy > 60;
        this.updateEnergy(shouldDash, 2.0);
        
        let moveSpeed = shouldDash ? this.speed * 1.5 : this.speed * 0.55;
        if (targetBall.y < center) this.y -= moveSpeed;
        else this.y += moveSpeed;
    }
}

// --- CLASE MOTOR DEL JUEGO ---
class Game {
    constructor() {
        this.isPVP = false;
        this.timerReference = null;
        this.smashEffects = [];
        this.init();
        this.handleInput();
    }

    init() {
        if (this.timerReference) clearInterval(this.timerReference);
        
        const colorLeft = "#3333FF"; // Azul
        const colorRight = this.isPVP ? "#FF3333" : "#FF33FF"; // Rojo o Morado
        
        this.paddle1 = new Paddle(25, canvas.height/2 - paddleHeight, paddleWidth, paddleHeight * 2, colorLeft, true);
        this.paddle2 = new Paddle(canvas.width - 35, canvas.height/2 - (this.isPVP ? paddleHeight : paddleHeight/2), paddleWidth, this.isPVP ? paddleHeight * 2 : paddleHeight, colorRight, false);
        
        this.balls = []; this.createBalls();
        this.score1 = 0; this.score2 = 0;
        this.gameOver = false; this.winner = "";
        this.keys = {}; this.smashEffects = [];
        this.countdown = 3; this.isCounting = true;
        this.startCountdown();
    }

    startCountdown() {
        this.timerReference = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) { clearInterval(this.timerReference); this.timerReference = null; this.isCounting = false; }
        }, 1000);
    }

    createBalls() {
        const colors = ['#FF5555', '#55FF55', '#5555FF', '#FFFF55', '#FF55FF'];
        for (let i = 0; i < 5; i++) {
            const radius = 6 + (i * 2.5);
            this.balls.push(new Ball(canvas.width / 2, canvas.height / 2, radius, 0, 0, colors[i]));
            this.balls[i].reset();
        }
    }

    triggerSmashEffect(x, y, color) { this.smashEffects.push({ x, y, color, life: 20, size: 0 }); }

    draw() {
        ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "150px Arial"; ctx.fillStyle = "rgba(255, 255, 255, 0.05)"; ctx.textAlign = "center";
        ctx.fillText(this.score1, canvas.width / 4, canvas.height / 2 + 50);
        ctx.fillText(this.score2, (canvas.width / 4) * 3, canvas.height / 2 + 50);

        this.paddle1.draw(); this.paddle2.draw();
        this.balls.forEach(ball => ball.draw());

        ctx.font = "18px Arial"; ctx.fillStyle = "white";
        ctx.fillText(this.isPVP ? "PVP: AZUL (W/S + L-Shift) | ROJO (↑/↓ + M)" : "VS IA: AZUL (W/S o ↑/↓ + L-Shift)", canvas.width / 2, 30);

        this.smashEffects.forEach((eff, i) => {
            ctx.save(); ctx.translate(eff.x, eff.y); ctx.strokeStyle = eff.color; ctx.lineWidth = 4;
            for(let j=0; j<8; j++) { ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.moveTo(eff.size,0); ctx.lineTo(eff.size+40,0); ctx.stroke(); }
            ctx.restore(); eff.size += 5; eff.life--; if(eff.life <= 0) this.smashEffects.splice(i, 1);
        });

        if (this.isCounting) {
            ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle = "white"; ctx.font = "bold 120px Arial"; ctx.fillText(this.countdown, canvas.width/2, canvas.height/2+40);
        }
        if (this.gameOver) {
            ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle="white"; ctx.font="50px Arial"; ctx.fillText("GANADOR: "+this.winner, canvas.width/2, canvas.height/2);
            ctx.font="20px Arial"; ctx.fillText("Presiona 'R' para revancha", canvas.width/2, canvas.height/2 + 60);
        }
    }

    update() {
        if (this.isCounting || this.gameOver) return;

        const p1Dash = this.keys['ShiftLeft']; 
        if (this.keys['w'] || this.keys['W'] || (!this.isPVP && this.keys['ArrowUp'])) {
            this.paddle1.applyMove('up', p1Dash);
        } else if (this.keys['s'] || this.keys['S'] || (!this.isPVP && this.keys['ArrowDown'])) {
            this.paddle1.applyMove('down', p1Dash);
        } else {
            this.paddle1.updateEnergy(false);
        }

        if (this.isPVP) {
            const p2Dash = this.keys['m'] || this.keys['M'];
            if (this.keys['ArrowUp']) this.paddle2.applyMove('up', p2Dash);
            else if (this.keys['ArrowDown']) this.paddle2.applyMove('down', p2Dash);
            else this.paddle2.updateEnergy(false);
        } else {
            this.paddle2.autoMove(this.balls);
        }

        this.balls.forEach(ball => {
            ball.move();
            if (ball.speedX < 0 && ball.x - ball.radius <= this.paddle1.x + this.paddle1.width && ball.x - ball.radius >= this.paddle1.x - 10) {
                if (ball.y >= this.paddle1.y - 15 && ball.y <= this.paddle1.y + this.paddle1.height + 15) {
                    ball.speedX = Math.abs(ball.speedX) * 1.035; 
                    ball.x = this.paddle1.x + this.paddle1.width + ball.radius;
                    this.paddle1.hitEffect();
                }
            }
            if (ball.speedX > 0 && ball.x + ball.radius >= this.paddle2.x && ball.x + ball.radius <= this.paddle2.x + 10) {
                if (ball.y >= this.paddle2.y - 15 && ball.y <= this.paddle2.y + this.paddle2.height + 15) {
                    ball.speedX = -Math.abs(ball.speedX) * 1.035; 
                    ball.x = this.paddle2.x - ball.radius;
                    this.paddle2.hitEffect();
                }
            }
            if (ball.x < 0) { this.score2++; this.triggerSmashEffect(0, ball.y, ball.color); ball.reset(); }
            else if (ball.x > canvas.width) { this.score1++; this.triggerSmashEffect(canvas.width, ball.y, ball.color); ball.reset(); }
        });

        if (this.score1 >= 50) { this.gameOver = true; this.winner = "AZUL"; }
        if (this.score2 >= 50) { this.gameOver = true; this.winner = this.isPVP ? "ROJO" : "MORADO"; }
    }

    handleInput() {
        window.addEventListener('keydown', (e) => { 
            // PREVENT DEFAULT PARA EVITAR SCROLL EN GITHUB
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
                e.preventDefault();
            }

            if (e.code === 'ShiftLeft') this.keys['ShiftLeft'] = true;
            else this.keys[e.key] = true;
            if (e.key.toLowerCase() === 'r') this.init(); 
            if (e.key.toLowerCase() === 'p') { this.isPVP = !this.isPVP; this.init(); }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ShiftLeft') this.keys['ShiftLeft'] = false;
            else this.keys[e.key] = false;
        });
    }

    run() {
        const loop = () => { this.update(); this.draw(); requestAnimationFrame(loop); };
        loop();
    }
}

const game = new Game();
game.run();
