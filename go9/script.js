class GoGame {
    constructor() {
        this.boardSize = 9;
        this.board = []; 
        this.history = []; 
        this.moveListRecord = []; 
        this.currentPlayer = 1; 
        this.passCount = 0; 
        this.isGameOver = false;
        
        // 🔥 修改：AI 設定
        this.aiLevel = 'hard'; // 預設困難
        this.koCoordinate = null; 
        this.komi = 5.5; 

        this.soundMove = document.getElementById('sndMove');
        this.soundCapture = document.getElementById('sndCapture');
        
        this.initUI();
        if (!this.loadGame()) {
            this.reset();
        }
    }

    initUI() {
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
        if (this.aiLevel !== 'off' && this.currentPlayer === 2) return; // AI 回合不顯示
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

    saveGame() {
        const state = {
            board: this.board,
            history: this.history, 
            moveListRecord: this.moveListRecord,
            currentPlayer: this.currentPlayer,
            passCount: this.passCount,
            isGameOver: this.isGameOver,
            koCoordinate: this.koCoordinate,
            aiLevel: this.aiLevel
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
            this.aiLevel = state.aiLevel || 'hard';
            
            // 恢復 UI 狀態
            document.getElementById('aiSelect').value = this.aiLevel;
            this.updateView();
            this.updateKifuUI();
            this.updatePassBtnUI();
            this.updateStoneCounts(); // 載入時更新計數

            if(this.isGameOver) this.endGame();
            else {
                const pName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
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
        this.updateStoneCounts();
        this.updateStatus(`⚫ 黑棋先行`);
        // 重置分數顯示
        document.getElementById('blackScore').innerText = '0';
        document.getElementById('whiteScore').innerText = '0';
        document.querySelectorAll('.cell').forEach(c => c.innerHTML = '');
        document.getElementById('statusBar').className = 'status-bar';
        this.saveGame();
    }

    handleHumanClick(r, c) {
        if (this.isGameOver || (this.aiLevel !== 'off' && this.currentPlayer === 2)) return;
        this.playMove(r, c);
    }

    // 🔥 新增：AI 等級設定
    setAILevel(level) {
        this.aiLevel = level;
        this.saveGame();
        // 如果切換時剛好輪到白棋，且不是關閉狀態，觸發 AI
        if (!this.isGameOver && this.currentPlayer === 2 && this.aiLevel !== 'off') {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    // 🔥 新增：計算盤面棋子數
    updateStoneCounts() {
        let black = 0, white = 0;
        for(let r=0; r<this.boardSize; r++){
            for(let c=0; c<this.boardSize; c++){
                if (this.board[r][c] === 1) black++;
                else if (this.board[r][c] === 2) white++;
            }
        }
        document.getElementById('blackCount').innerText = black;
        document.getElementById('whiteCount').innerText = white;
    }

    // 🔥 新增：提示功能
   showHint() {
        if (this.isGameOver) return;
        
        // 取得最佳手 (使用 Hard AI 的邏輯，但為了穩定，我們不使用隨機)
        // 這裡傳入 true 代表是 "Hint Mode"，我們會移除隨機性
        const bestMove = this.getBestMove(true);
        
        // 清除舊提示
        document.querySelectorAll('.hint-mark').forEach(el => el.remove());

        if (bestMove) {
            const cell = document.querySelector(`.cell[data-r="${bestMove.r}"][data-c="${bestMove.c}"]`);
            if (cell) {
                // 創建提示元素
                const mark = document.createElement('div');
                mark.className = 'hint-mark';
                
                const stone = document.createElement('div');
                // 提示顯示當前玩家顏色的半透明棋子
                stone.className = `hint-stone ${this.currentPlayer === 1 ? 'black' : 'white'}`;
                
                mark.appendChild(stone);
                cell.appendChild(mark);
                
                // 3秒後自動消失
                setTimeout(() => {
                    if (mark && mark.parentElement) mark.remove();
                }, 3000);
            }
        } else {
            this.updateStatus("💡 AI 建議：沒有好棋了，考慮 Pass？");
        }
    }

    playMove(r, c) {
        document.querySelectorAll('.hint-mark').forEach(el => el.remove());
        if (this.isGameOver) return;
        this.removeGhost(r, c);
        // 清除提示
        document.querySelectorAll('.hint-highlight').forEach(el => el.classList.remove('hint-highlight'));

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
        this.passCount = 0; 
        this.updatePassBtnUI(); 

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
        this.updateStoneCounts(); // 🔥 更新盤面子數

        const isAtari = this.checkAtari(opponent);
        const atariMsg = isAtari ? " ⚠️ 叫吃！" : "";
        this.currentPlayer = opponent;
        const nextName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
        this.updateStatus(`${nextName} 回合${atariMsg}`);
        this.saveGame();

        if (!this.isGameOver && this.aiLevel !== 'off' && this.currentPlayer === 2) {
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
        this.updatePassBtnUI();

        if (this.passCount >= 2) { 
            this.endGame(); 
            return; 
        }
        
        this.currentPlayer = this.currentPlayer===1?2:1;
        this.koCoordinate = null;
        this.saveGame();

        if (pColor === "白") {
             this.updateStatus(`⚪ 白棋 Pass！若您也同意終局，請按 Pass (1/2)`);
        } else {
             const nextName = this.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋';
             this.updateStatus(`${nextName} 回合 (對手已 Pass)`);
        }

        if (!this.isGameOver && this.aiLevel !== 'off' && this.currentPlayer === 2) setTimeout(() => this.pass(), 1000);
    }

    updatePassBtnUI() {
        const btn = document.querySelector('.btn-pass');
        if (this.passCount === 1) {
            btn.innerText = "虛手 (1/2)";
            btn.classList.add('active-pass');
        } else {
            btn.innerText = "虛手 (Pass)";
            btn.classList.remove('active-pass');
        }
    }

    undo() {
        if (this.history.length === 0 || this.isGameOver) return;
        // 如果 AI 開啟，悔兩步；關閉則悔一步
        let steps = (this.aiLevel !== 'off' && this.currentPlayer === 1) ? 2 : 1;
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
        this.updatePassBtnUI();
        this.updateStoneCounts();
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

    // 🔥 抽取邏輯：計算最佳落點 (供 AI 和提示使用)
    // 🔥 大幅升級：計算最佳落點
    getBestMove(isHintMode = false) {
        const moves = [];
        // 為了避免 Hint 亂跳，如果是 Hint 模式，我們不隨機打亂，而是依序掃描
        for(let r=0; r<9; r++) for(let c=0; c<9; c++) moves.push([r,c]);
        
        // 只有在非 Hint 模式 (真的 AI 下棋) 才加入隨機性，增加趣味
        if (!isHintMode && this.aiLevel === 'easy') {
            moves.sort(() => Math.random() - 0.5);
        }

        let bestMove = null;
        let maxScore = -99999; // 初始分數設很低

        const myColor = this.currentPlayer;
        const oppColor = myColor === 1 ? 2 : 1;

        for (let [r, c] of moves) {
            // 1. 基本合法性檢查
            if (this.board[r][c] !== 0) continue;
            if (this.koCoordinate && this.koCoordinate[0] === r && this.koCoordinate[1] === c) continue;
            
            const nextBoard = this.board.map(row => [...row]);
            nextBoard[r][c] = myColor;
            
            const captured = this.getCapturedStones(nextBoard, r, c, oppColor);
            const myLibs = this.countLiberties(nextBoard, r, c);
            
            // 自殺檢查：沒提子且自己沒氣 -> 絕對禁手
            if (myLibs === 0 && captured.length === 0) continue; 

            // --- 簡單模式 (Easy) ---
            if (this.aiLevel === 'easy' && !isHintMode) {
                return {r, c}; // 隨機返回一個合法點
            }

            // --- 困難/提示模式 (Hard/Hint) 評分邏輯 ---
            let score = 0;

            // 如果是 Hint 模式，加入一點點微小的位置權重 (0.01)，確保分數相同時不會亂跳
            if (isHintMode) {
                score += (9-r) * 0.01 + (9-c) * 0.001; 
            } else {
                 // AI 模式加入隨機因子讓它不要太死板
                 score += Math.random() * 0.5;
            }

            // 策略 1: 【救命】(Atari Defense) - 最重要！
            // 檢查下這手之前，我有沒有棋子剩一氣？
            // 如果這手棋能增加那團棋子的氣，加超多分
            if (this.checkAtari(myColor)) {
                // 這裡簡化判斷：如果下這手後，原本被叫吃的棋子氣變多了，或是這手棋連起來氣 > 1
                // 由於效能考量，我們簡單判斷：如果這手棋連著我也在叫吃的子，且下完後這團氣 > 1
                const myGroups = this.getGroup(nextBoard, r, c); // 取得下完後這團棋
                const currentLibs = this.countLiberties(nextBoard, r, c);
                if (currentLibs > 1) {
                    // 簡單啟發式：如果我現在被叫吃，且這手能讓我氣變多，優先下
                     score += 40; 
                }
            }

            // 策略 2: 【吃子】(Capture)
            if (captured.length > 0) {
                score += 30 + (captured.length * 5); // 吃越多越好
            }

            // 策略 3: 【叫吃】(Atari Attack)
            // 下完後，讓對方某團棋剩一氣
            let putOpponentInAtari = false;
            const neighbors = [[0,1],[0,-1],[1,0],[-1,0]];
            for(let [dr, dc] of neighbors) {
                const nr = r+dr, nc = c+dc;
                if(nr>=0 && nr<9 && nc>=0 && nc<9 && nextBoard[nr][nc] === oppColor) {
                    if(this.countLiberties(nextBoard, nr, nc) === 1) putOpponentInAtari = true;
                }
            }
            if (putOpponentInAtari) score += 15;

            // 策略 4: 【避免送死】(Self-Atari)
            // 如果這手下下去，自己只剩一口氣 (且沒吃到對方)，這是爛棋 (除非是撲)
            if (myLibs === 1 && captured.length === 0) {
                score -= 50; 
            }

            // 策略 5: 【搶佔空地/星位】
            // 只有開局時 (前12手) 重視
            if (this.moveListRecord.length < 12) {
                if (r===4 && c===4) score += 5; // 天元
                if ((r===2||r===6) && (c===2||c===6)) score += 4; // 星位
                if ((r===2||r===6) && c===4) score += 3;
                if (r===4 && (c===2||c===6)) score += 3;
            }

            // 策略 6: 【連接與切斷】(簡單判斷)
            // 貼著對方下 (進攻或防守)
            let oppNeighborsCount = 0;
            let myNeighborsCount = 0;
            for(let [dr, dc] of neighbors) {
                const nr = r+dr, nc = c+dc;
                if(nr>=0 && nr<9 && nc>=0 && nc<9) {
                    if(this.board[nr][nc] === oppColor) oppNeighborsCount++;
                    if(this.board[nr][nc] === myColor) myNeighborsCount++;
                }
            }
            if (oppNeighborsCount > 0) score += 2; // 戰鬥
            if (myNeighborsCount > 0) score += 1; // 連接

            // 愚型扣分 (填滿自己四氣)
            if (myNeighborsCount === 4) score -= 5;


            // 更新最佳手
            if (score > maxScore) {
                maxScore = score;
                bestMove = {r, c};
            }
        }
        
        return bestMove;
    }

    aiMove() {
        if(this.isGameOver) return;
        
        // 取得最佳落點
        const bestMove = this.getBestMove();

        if (bestMove) {
            this.playMove(bestMove.r, bestMove.c);
        } else {
            this.pass();
        }
    }

    // --- 演算法部分保持不變 ---
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
}
const game = new GoGame();