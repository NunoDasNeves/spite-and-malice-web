function Game(players) {
    this.players = players;
    this.paused = false;
    this.ready = true;
    /* TODO random turn? */
    this.turn = 0;
}

Game.prototype.start = function() {
    this.drawPile = makeDecks(2);
    shuffleArray(this.drawPile);
    this.playPiles = Array.from(Array(4), () => []);
    this.players = this.players.map(
        ({info}) => ({
            info,
            stack: [],
            hand: [],
            discard: Array.from(Array(4), () => []),
        }));

    this.stackSize = 13;
    this.handSize = 4;

    /* deal */
    for (j = 0; j < this.stackSize; ++j) {
        for (i = 0; i < this.players.length; ++i) {
            this.players[i].stack.push(this.drawPile.pop());
        }
    }
    for (j = 0; j < this.handSize; ++j) {
        for (i = 0; i < this.players.length; ++i) {
            this.players[i].hand.push(this.drawPile.pop());
        }
    }
}

/* Game as seen by one player at a given point in time */
function GameView(game, myIdx, turn) {
    /* TODO do we need to deep copy this stuff? */
    this.playerViews = game.players.map(({stack, hand, discard}) => ({stackTop: stack[stack.length-1], stackCount: stack.length, handCount: hand.length, discard}));
    this.playPiles = game.playPiles;
    this.drawPileCount = game.drawPile.length;
    this.turn = turn;
    this.myIdx = myIdx;
    this.myHand = game.players[myIdx].hand;
}

const MOVES = {
    PLAY_FROM_HAND: 0,
    PLAY_FROM_DISCARD: 1,
    PLAY_FROM_STACK: 2,
    DISCARD: 3,
};

/* hand to play pile (may cause draw 4 more cards) */
function movePlayFromHand(handIdx, playIdx) {
    return {
        type: MOVES.PLAY_FROM_HAND,
        handIdx,
        playIdx
    };
}
/* discard pile to play pile */
function movePlayFromDiscard(discardIdx, playIdx) {
    return {
        type: MOVES.PLAY_FROM_DISCARD,
        discardIdx,
        playIdx
    };
}
/* stack to play pile (reveals next stack card) */
function movePlayFromStack(playIdx) {
    return {
        type: MOVES.PLAY_FROM_STACK,
        playIdx
    };
}
/* discard (ends turn) */
function moveDiscard(handIdx, discardIdx) {
    return {
        type: MOVES.DISCARD,
        handIdx,
        discardIdx
    };
}

GameView.isValidMove = function(move) {
    /* TODO */
    return true;
}