class GoGame {
    constructor() {
        this.boardSize = 9;
        this.board = []; 
        this.history = []; 
        this.moveListRecord = []; 
        this.currentPlayer = 1; 
        this.passCount = 0; // 0=無, 1=一方Pass, 2=終局
        this.isGameOver = false;
        this.aiEnabled = true;
        this.koCoordinate = null; 
        this.komi = 5.5; 

        this.soundMove = document.getElementById('sndMove');
        this.soundCapture = document.getElementById('sndCapture');
        
        this.initUI();
        if (!this.loadGame()) {
            this.reset();
        }
    }

    // ... (initUI, showGhost, removeGhost, playSound 保持不變) ...
    initUI() {
        // (內容同上個版本，不需變更)
        const boardEl = document.getElementById('board');
        const coordsTop = document.getElementById('coordsTop');
        const coordsLeft = document.getElementById('coordsLeft');
        
        boardEl.innerHTML = '';
        coordsTop.innerHTML = '';
        coordsLeft.innerHTML = '';

        const starPoints = [[2,2], [2,6], [6,2], [6,6], [4,4]];
        const colLabels = "ABCDEFGHJ";
        const rowLabels = "987654321";

        for(let i=0; i<9; i++) {
            const topLabel = document.createElement('div');
            topLabel.innerText = colLabels[i];
            coordsTop.appendChild(topLabel);
            const leftLabel = document.createElement('div');
            leftLabel.innerText = rowLabels[i];
            leftLabel.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;padding-right:5px;';
            coordsLeft.appendChild(leftLabel);
        }

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                if (starPoints.some(p => p[0] === r && p[1] === c)) {
                    cell.classList.add('star-point');
                }
                cell.addEventListener('click', () => this.handleHumanClick(r, c));
                cell.addEventListener('mouseenter', () => this.showGhost(r, c));
                cell.addEventListener('mouseleave', () => this.removeGhost(r, c));
                boardEl.appendChild(cell);
            }
        }
    }
    
    showGhost(r, c) {
        if (this.isGameOver || this.board[r][c] !== 0) return;
        if (this.aiEnabled && this.currentPlayer === 2) return; 
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell.querySelector('.stone:not(.ghost)')) {
            const ghost = document.createElement('div');
            ghost.className = `stone ghost ${this.currentPlayer === 1 ? 'black' : 'white'}`;
            cell.appendChild(ghost);
        }
    }
    removeGhost(r, c) {
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        const ghost = cell.querySelector('.ghost');
        if (ghost) ghost.remove();
    }
    playSound(type) {
        try {
            const snd = type === 'move' ? this.soundMove : this.soundCapture;
            snd.currentTime = 0;
            snd.play();
        } catch(e) {}
    }

    // ... (saveGame, loadGame 保持不變，但記得存取 passCount) ...
    saveGame() {
        const state = {
            board: this.board,
            history: this.history, 
            moveListRecord: this.moveListRecord,
            currentPlayer: this.currentPlayer,
            passCount: this.passCount,
            isGameOver: this.isGameOver,
            koCoordinate: this.koCoordinate,
            aiEnabled: this.aiEnabled
        };
        localStorage.setItem('goGameMaster', JSON.stringify(state));
    }
    loadGame() {
        const saved = localStorage.getItem('goGameMaster');
        if (!saved) return false;
        try {
            const state = JSON.parse(saved);
            this.board = state.board;
            this.history = state.history || []; 
            this.moveListRecord = state.moveListRecord || [];
            this.currentPlayer = state.currentPlayer;
            this.passCount = state.passCount || 0;
            this.isGameOver = state.isGameOver;
            this.koCoordinate = state.koCoordinate;
            this.aiEnabled = state.aiEnabled;
            
            document.getElementById('aiBtn').innerText = `AI: ${this.aiEnabled ? '開' : '關'}`;
            this.updateView();
            this.updateKifuUI();
            this.updatePassBtnUI(); // 恢復按鈕狀態

            if(this.isGameOver) this.endGame();
            else {
                const pName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
                // 恢復時如果有 Pass，顯示提示
                if (this.passCount === 1) {
                    this.updateStatus(`${pName} 回合 (對手已 Pass)`);
                } else {
                    this.updateStatus(`${pName} 回合`);
                }
            }
            return true;
        } catch(e) { return false; }
    }

    reset() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(0));
        this.history = [];
        this.moveListRecord = [];
        this.currentPlayer = 1;
        this.passCount = 0;
        this.isGameOver = false;
        this.koCoordinate = null;
        this.updateView();
        this.updateKifuUI();
        this.updatePassBtnUI();
        this.updateStatus(`⚫ 黑棋先行`);
        document.getElementById('blackScore').innerText = '0';
        document.getElementById('whiteScore').innerText = '0';
        document.querySelectorAll('.cell').forEach(c => c.innerHTML = '');
        document.getElementById('statusBar').className = 'status-bar';
        this.saveGame();
    }

    handleHumanClick(r, c) {
        if (this.isGameOver || (this.aiEnabled && this.currentPlayer === 2)) return;
        this.playMove(r, c);
    }

    playMove(r, c) {
        if (this.isGameOver) return;
        this.removeGhost(r, c);

        if (this.board[r][c] !== 0) {
            this.updateStatus("❌ 此處已有子", true);
            return;
        }
        if (this.koCoordinate && this.koCoordinate[0] === r && this.koCoordinate[1] === c) {
            this.updateStatus("❌ 劫爭禁著", true);
            return;
        }

        const nextBoard = this.board.map(row => [...row]);
        nextBoard[r][c] = this.currentPlayer;
        const opponent = this.currentPlayer === 1 ? 2 : 1;
        const capturedStones = this.getCapturedStones(nextBoard, r, c, opponent);
        
        if (this.countLiberties(nextBoard, r, c) === 0 && capturedStones.length === 0) {
            this.updateStatus("❌ 禁止自殺", true);
            return;
        }

        this.history.push({
            board: this.board.map(row => [...row]),
            player: this.currentPlayer,
            ko: this.koCoordinate,
            moveRecord: [...this.moveListRecord],
            passCount: this.passCount
        });

        const colChar = "ABCDEFGHJ"[c];
        const rowChar = "987654321"[r];
        const moveNum = this.moveListRecord.length + 1;
        const pColor = this.currentPlayer === 1 ? "黑" : "白";
        this.moveListRecord.push(`${moveNum}. ${pColor} (${colChar},${rowChar})`);
        this.updateKifuUI();

        this.board[r][c] = this.currentPlayer;
        
        // 🔥 關鍵修正：只要有人下子，連續 Pass 次數歸零
        this.passCount = 0; 
        this.updatePassBtnUI(); // 更新按鈕文字變回 "Pass"

        let capturedCount = 0;
        if (capturedStones.length > 0) {
            capturedStones.forEach(stone => {
                this.board[stone.r][stone.c] = 0;
                this.showCaptureEffect(stone.r, stone.c);
            });
            capturedCount = capturedStones.length;
            this.playSound('capture');
        } else {
            this.playSound('move');
        }

        if (capturedCount === 1 && this.countLiberties(this.board, r, c) === 1) {
             this.koCoordinate = [capturedStones[0].r, capturedStones[0].c];
        } else {
            this.koCoordinate = null;
        }

        this.updateView(r, c);
        
        const isAtari = this.checkAtari(opponent);
        const atariMsg = isAtari ? " ⚠️ 叫吃！" : "";
        this.currentPlayer = opponent;
        const nextName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
        this.updateStatus(`${nextName} 回合${atariMsg}`);
        this.saveGame();

        if (!this.isGameOver && this.aiEnabled && this.currentPlayer === 2) {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    pass() {
        if (this.isGameOver) return;
        this.history.push({ 
            board: this.board.map(r=>[...r]), 
            player: this.currentPlayer, 
            ko: this.koCoordinate,
            moveRecord: [...this.moveListRecord],
            passCount: this.passCount
        });
        
        const moveNum = this.moveListRecord.length + 1;
        const pColor = this.currentPlayer === 1 ? "黑" : "白";
        this.moveListRecord.push(`${moveNum}. ${pColor} 虛手 (Pass)`);
        this.updateKifuUI();

        this.passCount++;
        this.playSound('move');
        
        // 🔥 關鍵修正：根據 Pass 次數更新 UI 和狀態
        this.updatePassBtnUI();

        if (this.passCount >= 2) { 
            this.endGame(); 
            return; 
        }
        
        this.currentPlayer = this.currentPlayer===1?2:1;
        this.koCoordinate = null;
        this.saveGame();

        // 如果是白棋(AI) Pass，顯示特殊訊息引導使用者
        if (pColor === "白") {
             this.updateStatus(`⚪ 白棋 Pass！若您也同意終局，請按 Pass (1/2)`);
        } else {
             // 黑棋 Pass，AI 接手
             const nextName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
             this.updateStatus(`${nextName} 回合 (對手已 Pass)`);
        }

        if (!this.isGameOver && this.aiEnabled && this.currentPlayer === 2) setTimeout(() => this.pass(), 1000);
    }

    // 🔥 新增：更新 Pass 按鈕外觀
    updatePassBtnUI() {
        const btn = document.querySelector('.btn-pass');
        if (this.passCount === 1) {
            btn.innerText = "虛手 (1/2)";
            btn.classList.add('active-pass'); // 可以加個閃爍動畫
        } else {
            btn.innerText = "虛手 (Pass)";
            btn.classList.remove('active-pass');
        }
    }

    undo() {
        if (this.history.length === 0 || this.isGameOver) return;
        let steps = (this.aiEnabled && this.currentPlayer === 1) ? 2 : 1;
        if (this.history.length < steps) steps = this.history.length;
        for(let i=0; i<steps; i++) {
            const prevState = this.history.pop();
            this.board = prevState.board;
            this.currentPlayer = prevState.player;
            this.koCoordinate = prevState.ko;
            this.moveListRecord = prevState.moveRecord || [];
            this.passCount = prevState.passCount || 0;
        }
        this.isGameOver = false;
        this.updateView();
        this.updateKifuUI();
        this.updatePassBtnUI(); // 悔棋也要更新按鈕狀態
        this.updateStatus(`悔棋成功，輪到 ${this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋'}`);
        this.saveGame();
    }

    updateKifuUI() {
        const list = document.getElementById('moveList');
        list.innerHTML = '';
        this.moveListRecord.forEach(move => {
            const li = document.createElement('li');
            li.textContent = move;
            list.appendChild(li);
        });
        list.scrollTop = list.scrollHeight;
    }

    // ... (演算法部分 countLiberties, getGroup, getCapturedStones, checkAtari, aiMove, endGame 保持原樣) ...
    // 請複製上一個版本的這些函數，邏輯不需要變動，因為這是純介面與狀態顯示的優化。
    
    // (為了完整性，這裡列出 aiMove 的一點小修改，讓他更傾向於在沒棋下時 Pass)
    aiMove() {
        if(this.isGameOver) return;
        const moves = [];
        for(let r=0; r<9; r++) for(let c=0; c<9; c++) moves.push([r,c]);
        moves.sort(() => Math.random() - 0.5);
        let bestMove = null, maxScore = -9999;
        
        let validMoveFound = false;

        for (let [r, c] of moves) {
            if (this.board[r][c] !== 0) continue;
            if (this.koCoordinate && this.koCoordinate[0] === r && this.koCoordinate[1] === c) continue;
            const nextBoard = this.board.map(row => [...row]);
            nextBoard[r][c] = 2;
            const captured = this.getCapturedStones(nextBoard, r, c, 1);
            const libs = this.countLiberties(nextBoard, r, c);
            if (libs === 0 && captured.length === 0) continue; 
            
            validMoveFound = true; // 只要有合法棋步
            
            let score = captured.length * 10;
            let myNeighbors = 0;
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc])=> {
                 let nr=r+dr, nc=c+dc;
                 if(nr>=0 && nr<9 && nc>=0 && nc<9 && this.board[nr][nc]===2) myNeighbors++;
            });
            if (myNeighbors === 4) score -= 5;
            
            // 簡單 AI：避免下在單眼裡，除非能吃子
            if (score > maxScore) { maxScore = score; bestMove = {r, c}; }
        }

        // 如果真的沒好棋下，或者分數太低，AI 可以選擇 Pass
        // 這裡維持簡單：有合法步就下，除非完全沒地方下
        if (bestMove && validMoveFound) {
            this.playMove(bestMove.r, bestMove.c);
        } else {
            this.pass();
        }
    }
    
    // 以下函式請直接從上一個回答複製貼上即可，無需更動：
    // countLiberties, getGroup, getCapturedStones, checkAtari, endGame, getEmptyRegion, updateView, showCaptureEffect, showTerritory, updateStatus, toggleAI
    
    countLiberties(board, r, c) {
        const group = this.getGroup(board, r, c);
        const libSet = new Set();
        for (let stone of group) {
            [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                const nr = stone.r + dr, nc = stone.c + dc;
                if (nr >= 0 && nr < this.boardSize && nc >= 0 && nc < this.boardSize) {
                    if (board[nr][nc] === 0) libSet.add(`${nr},${nc}`);
                }
            });
        }
        return libSet.size;
    }
    getGroup(board, r, c) {
        const color = board[r][c];
        const group = [];
        if (color === 0) return group;
        const stack = [[r, c]];
        const visited = new Set();
        visited.add(`${r},${c}`);
        group.push({r, c});
        while (stack.length > 0) {
            const [currR, currC] = stack.pop();
            [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                const nr = currR + dr, nc = currC + dc;
                if (nr>=0 && nr<9 && nc>=0 && nc<9) {
                    if (board[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
                        visited.add(`${nr},${nc}`);
                        group.push({r: nr, c: nc});
                        stack.push([nr, nc]);
                    }
                }
            });
        }
        return group;
    }
    getCapturedStones(board, r, c, opponentColor) {
        let captured = [];
        const seen = new Set();
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (nr>=0 && nr<9 && nc>=0 && nc<9 && board[nr][nc] === opponentColor) {
                if (this.countLiberties(board, nr, nc) === 0) {
                    this.getGroup(board, nr, nc).forEach(s => {
                        if(!seen.has(`${s.r},${s.c}`)) {
                            seen.add(`${s.r},${s.c}`);
                            captured.push(s);
                        }
                    });
                }
            }
        });
        return captured;
    }
    checkAtari(targetColor) {
        const checked = new Set();
        for(let r=0; r<this.boardSize; r++){
            for(let c=0; c<this.boardSize; c++){
                if(this.board[r][c] === targetColor && !checked.has(`${r},${c}`)){
                    if (this.countLiberties(this.board, r, c) === 1) return true;
                    this.getGroup(this.board, r, c).forEach(s => checked.add(`${s.r},${s.c}`));
                }
            }
        }
        return false;
    }
    endGame() {
        this.isGameOver = true;
        this.saveGame();
        let blackTerritory = 0, whiteTerritory = 0, blackStones = 0, whiteStones = 0;
        const visited = new Set();
        for(let r=0; r<9; r++) for(let c=0; c<9; c++) {
            if (this.board[r][c] === 1) blackStones++;
            else if (this.board[r][c] === 2) whiteStones++;
        }
        for(let r=0; r<9; r++) for(let c=0; c<9; c++) {
            if (this.board[r][c] === 0 && !visited.has(`${r},${c}`)) {
                const region = this.getEmptyRegion(r, c);
                region.points.forEach(p => visited.add(`${p.r},${p.c}`));
                if (region.borderColors.has(1) && !region.borderColors.has(2)) {
                    blackTerritory += region.points.length;
                    this.showTerritory(region.points, 1);
                } else if (region.borderColors.has(2) && !region.borderColors.has(1)) {
                    whiteTerritory += region.points.length;
                    this.showTerritory(region.points, 2);
                }
            }
        }
        const bTotal = blackStones + blackTerritory;
        const wTotal = whiteStones + whiteTerritory + this.komi;
        document.getElementById('blackScore').innerText = bTotal;
        document.getElementById('whiteScore').innerText = wTotal;
        let winner = bTotal > wTotal ? "⚫ 黑棋勝" : "⚪ 白棋勝";
        this.updateStatus(`🏁 終局！${winner} (黑:${bTotal} 白:${wTotal})`, false);
        document.getElementById('statusBar').style.background = "#27ae60";
    }
    getEmptyRegion(r, c) {
        const stack = [[r, c]], points = [], borderColors = new Set();
        const visited = new Set(); 
        visited.add(`${r},${c}`); points.push({r, c});
        while(stack.length > 0) {
            const [cr, cc] = stack.pop();
            [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                const nr = cr + dr, nc = cc + dc;
                if (nr>=0 && nr<9 && nc>=0 && nc<9) {
                    const color = this.board[nr][nc];
                    if (color === 0) {
                        if (!visited.has(`${nr},${nc}`)) {
                            visited.add(`${nr},${nc}`);
                            points.push({r:nr, c:nc});
                            stack.push([nr, nc]);
                        }
                    } else borderColors.add(color);
                }
            });
        }
        return { points, borderColors };
    }
    updateView(lastR = -1, lastC = -1) {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const val = this.board[r][c];
            const ghost = cell.querySelector('.ghost');
            const realStone = cell.querySelector('.stone:not(.ghost)');
            if (val === 0) {
                if (realStone && !realStone.classList.contains('captured')) realStone.remove();
            } else {
                if(ghost) ghost.remove();
                if (!realStone) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${val === 1 ? 'black' : 'white'}`;
                    cell.appendChild(stone);
                } else {
                    realStone.className = `stone ${val === 1 ? 'black' : 'white'}`;
                }
            }
            cell.classList.remove('last-move');
            if (r === lastR && c === lastC) cell.classList.add('last-move');
        });
    }
    showCaptureEffect(r, c) {
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        let stone = cell.querySelector('.stone:not(.ghost)');
        if (stone) {
            stone.classList.add('captured');
            setTimeout(() => { if(stone && stone.parentElement) stone.remove(); }, 600);
        }
    }
    showTerritory(points, player) {
        points.forEach(p => {
            const cell = document.querySelector(`.cell[data-r="${p.r}"][data-c="${p.c}"]`);
            if (!cell.querySelector('.stone')) {
                const mark = document.createElement('div');
                mark.className = `territory-mark ${player === 1 ? 'territory-black' : 'territory-white'}`;
                cell.appendChild(mark);
            }
        });
    }
    updateStatus(msg, isError = false) {
        const el = document.getElementById('statusBar');
        el.innerText = msg;
        el.style.background = isError ? '#c0392b' : '#34495e';
        el.classList.remove('atari-warning');
        if (msg.includes("叫吃")) el.classList.add('atari-warning');
    }
    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        document.getElementById('aiBtn').innerText = `AI: ${this.aiEnabled ? '開' : '關'}`;
        this.saveGame();
        if (this.aiEnabled && this.currentPlayer === 2 && !this.isGameOver) {
            setTimeout(() => this.aiMove(), 500);
        }
    }
}
const game = new GoGame();