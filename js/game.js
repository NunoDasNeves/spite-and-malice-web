function Game(players) {
    this.paused = false;
    this.ready = true;
    /* TODO random turn? */
    this.turn = 0;
    this.started = false;

    this.players = Object.values(players)
                    .reduce(
                        (obj, {id, name}) => {
                            obj[id] = { name, id };
                            return obj;
                        }, {});
}

Game.prototype.start = function() {
    this.started = true;
    this.drawPile = makeDecks(2);
    shuffleArray(this.drawPile);
    this.playPiles = Array.from(Array(4), () => []);
    /* just a list of players */
    this.players = Object.values(this.players)
        .reduce(
            (obj, {id, name}) => {
                obj[id] = {
                    id,
                    name,
                    stack: [],
                    hand: [],
                    discard: Array.from(Array(4), () => []),
                };
                return obj;
            }, {});

    this.stackSize = 13;
    this.handSize = 4;

    /* deal */
    for (j = 0; j < this.stackSize; ++j) {
        for (const k of Object.keys(this.players)) {
            this.players[k].stack.push(this.drawPile.pop());
        }
    }
    for (j = 0; j < this.handSize; ++j) {
        for (const k of Object.keys(this.players)) {
            this.players[k].hand.push(this.drawPile.pop());
        }
    }
}

/* Game as seen by one player at a given point in time */
Game.prototype.toView = function(myId) {
    if (!this.started) {
        throw('game not started!');
    }
    /* TODO do we need to deep copy this stuff? */
    return {
        playerViews: Object.values(this.players)
                        .reduce((obj, {id, name, stack, hand, discard}) => {
                            obj[id] = {
                                name,
                                id,
                                stackTop: stack[stack.length-1],
                                stackCount: stack.length,
                                handCount: hand.length,
                                discard};
                            return obj;
                        }, {}),
        playPiles: this.playPiles,
        drawPileCount: this.drawPile.length,
        turn: this.turn,
        myId: myId,
        myHand: this.players[myId].hand,
    };
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

function isValidMove(move, gameView) {
    /* TODO */
    return true;
}