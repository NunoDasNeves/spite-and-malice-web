const MOVES = {
    PLAY_FROM_HAND: 0,
    PLAY_FROM_DISCARD: 1,
    PLAY_FROM_STACK: 2,
    DISCARD: 3,
    END_TURN: 4,
    UNDO: 5,
    LENGTH: 6,
};

const PLAY_PILE_FULL_LENGTH = 12;

class Game {
    constructor(players, numDecks, stackSize, handSize) {
        this.ended = false;
        this.winner = -1;

        this.undoableMoves = [];

        this.players = Object.values(players)
                        .reduce(
                            (obj, {id}) => {
                                obj[id] = {id};
                                return obj;
                            }, {});

        /* player ids in ascending order, for determining turn */
        this.playerIds = Object.keys(this.players)
                            .map((id) => Number(id))
                            .sort((a,b) => a - b);
        this.turnIdx = 0;
        this.turn = this.playerIds[this.turnIdx];

        this.lastCardPlayed = null;
        this.numDecks = numDecks;
        this.stackSize = stackSize;
        this.handSize = handSize;

        this.drawPile = makeDecks(this.numDecks);
        shuffleArray(this.drawPile);
        this.playPiles = Array.from(Array(4), () => []);
        /* just a list of players */
        this.players = Object.values(this.players)
            .reduce(
                (obj, {id}) => {
                    obj[id] = {
                        id,
                        stack: [],
                        hand: [],
                        discard: Array.from(Array(4), () => []),
                        discarded: false,
                    };
                    return obj;
                }, {});

        /* deal */
        for (let j = 0; j < this.stackSize; ++j) {
            for (const k of Object.keys(this.players)) {
                this.players[k].stack.push(this.drawPile.pop());
            }
        }
        for (let j = 0; j < this.handSize; ++j) {
            for (const k of Object.keys(this.players)) {
                this.players[k].hand.push(this.drawPile.pop());
            }
        }
    }
    /* Game as seen by one player at a given point in time */
    toView(myId) {
        /* TODO do we need to deep copy this stuff? */
        return {
            playerViews: Object.values(this.players)
                            .reduce((obj, {id, stack, hand, discard}) => {
                                obj[id] = {
                                    id,
                                    stackTop: stack.length ? stack[stack.length-1] : null,
                                    stackCount: stack.length,
                                    handCount: hand.length,
                                    discard};
                                return obj;
                            }, {}),
            playPiles: this.playPiles,
            drawPileCount: this.drawPile.length,
            turn: this.turn,
            myId,
            myHand: this.players[myId].hand,
            ended: this.ended,
            winner: this.winner,
            lastCardPlayed: this.lastCardPlayed,
            discarded: this.players[myId].discarded,
            undoableMoves: this.undoableMoves,
        };
    }
    checkPlayPileFull(idx) {
        if (this.playPiles[idx].length == PLAY_PILE_FULL_LENGTH) {
            this.drawPile.push(...this.playPiles[idx]);
            this.playPiles[idx] = [];
            shuffleArray(this.drawPile);
        }
    }
    fillHand = function(hand) {
        while (hand.length < 4 && this.drawPile.length > 0) {
            hand.push(this.drawPile.pop());
        }
    }
    /* pre-validated with isValidMove */
    static _moveFn = {
        [MOVES.PLAY_FROM_HAND](move, playerId) {
            const {handIdx, playIdx} = move;
            const player = this.players[playerId];
            const hand = player.hand;
            this.lastCardPlayed = hand[handIdx];
            this.playPiles[playIdx].push(hand[handIdx]);
            hand.splice(handIdx, 1);
            this.checkPlayPileFull(playIdx);
            if (hand.length == 0) {
                this.fillHand(hand);
                this.undoableMoves.length = 0;
            } else {
                this.undoableMoves.push(move);
            }
        },
        [MOVES.PLAY_FROM_DISCARD](move, playerId) {
            const {discardIdx, playIdx} = move;
            const player = this.players[playerId];
            const discard = player.discard[discardIdx];
            this.lastCardPlayed = discard[discard.length - 1];
            this.playPiles[playIdx].push(discard.pop());
            this.checkPlayPileFull(playIdx);
            this.undoableMoves.push(move);
        },
        [MOVES.PLAY_FROM_STACK]({playIdx}, playerId) {
            const player = this.players[playerId];
            const stack = player.stack;
            this.lastCardPlayed = stack[stack.length - 1];
            this.playPiles[playIdx].push(stack.pop());
            if (stack.length == 0) {
                this.ended = true;
                this.winner = playerId;
            } else {
                this.checkPlayPileFull(playIdx);
            }
            this.undoableMoves.length = 0;
        },
        [MOVES.DISCARD](move, playerId) {
            const {handIdx, discardIdx} = move;
            const player = this.players[playerId];
            const hand = player.hand;
            const discard = player.discard[discardIdx];
            this.lastCardPlayed = hand[handIdx];
            discard.push(hand[handIdx]);
            hand.splice(handIdx, 1);
            player.discarded = true;
            this.undoableMoves.push(move);
        },
        [MOVES.END_TURN](move, playerId) {
            this.turnIdx = (this.turnIdx + 1) % this.playerIds.length;
            this.turn = this.playerIds[this.turnIdx];
            const nextPlayer = this.players[this.turn];
            this.fillHand(nextPlayer.hand);
            nextPlayer.discarded = false;
            this.undoableMoves.length = 0;
        },
        [MOVES.UNDO]({move}, playerId) {
            const player = this.players[playerId];
            switch(move.type) {
                case MOVES.PLAY_FROM_HAND:
                    {
                        const hand = player.hand;
                        const card = this.playPiles[move.playIdx].pop();
                        hand.splice(move.handIdx, 0, card);
                    }
                    break;
                case MOVES.PLAY_FROM_DISCARD:
                    {
                        const discard = player.discard[move.discardIdx];
                        const card = this.playPiles[move.playIdx].pop();
                        discard.push(card);
                    }
                    break;
                case MOVES.DISCARD:
                    {
                        const hand = player.hand;
                        const discard = player.discard[move.discardIdx];
                        const card = discard.pop();
                        hand.splice(move.handIdx, 0, card);
                        player.discarded = false;
                    }
                    break;
            }
            this.undoableMoves.pop();
        }
    };
    move(move, playerId) {
        if (isValidMove(move, this.toView(playerId))) {
            /* have to bind the function to this with call() */
            Game._moveFn[move.type].call(this, move, playerId);
            return true;
        }
        return false;
    }
}

function canPlayOnPile(card, pile) {
    if (cardIsWild(card)) {
        return true;
    }
    return card.value == pile.length + 1;
}

function isNonNullObject(o) {
    return typeof o === 'object' && o !== null;
}

function isValidMovePacket(move) {
    if (!isNonNullObject(move)) {
        return false;
    }
    if (!move.hasOwnProperty('type')) {
        return false;
    }
    if (move.type < 0 || move.type >= MOVES.LENGTH) {
        return false;
    }
    if (move.hasOwnProperty('playIdx')) {
        if (move.playIdx < 0 || move.playIdx >= 4) {
            return false;
        }
    }
    if (move.hasOwnProperty('discardIdx')) {
        if (move.discardIdx < 0 || move.discardIdx >= 4) {
            return false;
        }
    }
    switch(move.type) {
        case MOVES.PLAY_FROM_HAND:
            if (!move.hasOwnProperty('handIdx') || !move.hasOwnProperty('playIdx')) {
                return false;
            }
            break;
        case MOVES.PLAY_FROM_DISCARD:
            if (!move.hasOwnProperty('discardIdx') || !move.hasOwnProperty('playIdx')) {
                return false;
            }
            break;
        case MOVES.PLAY_FROM_STACK:
            if (!move.hasOwnProperty('playIdx')) {
                return false;
            }
            break;
        case MOVES.DISCARD:
            if (!move.hasOwnProperty('handIdx') || !move.hasOwnProperty('discardIdx')) {
                return false;
            }
            break;
        case MOVES.END_TURN:
            // return true;
            break;
        case MOVES.UNDO:
            if (!move.hasOwnProperty('move')) {
                return false;
            }
            // check a couple of things before recursing
            if (!isNonNullObject(move.move)) {
                return false;
            }
            if (move.move.hasOwnProperty('type')) {
                if (move.move.type === MOVES.END_TURN || move.move.type === MOVES.UNDO) {
                    return false;
                }
                return isValidMovePacket(move.move);
            }
            break;
        default:
            return false;
    }
    return true;
}

/* assume a and b are validated already with isValidMovePacket */
function movesAreSame(a, b) {
    if (a.type !== b.type) {
        return false;
    }
    switch (a.type) {
        case MOVES.PLAY_FROM_HAND:
            return a.handIdx === b.handIdx && a.playIdx == b.playIdx;
        case MOVES.PLAY_FROM_DISCARD:
            return a.discardIdx === b.discardIdx && a.playIdx == b.playIdx;
        case MOVES.PLAY_FROM_STACK:
            return a.playIdx === b.playIdx;
        case MOVES.DISCARD:
            return a.handIdx === b.handIdx && a.discardIdx == b.discardIdx;
        case MOVES.UNDO:
            return movesAreSame(a.move, b.move);
        case MOVES.END_TURN:
            return true;
        default:
            return false;
    }
    return false;
}

function isValidMove(move, gameView) {
    const { playerViews, playPiles, myHand, myId, turn, ended, discarded, undoableMoves } = gameView;
    /* basic validation */
    if (ended) {
        return false;
    }
    if (turn != myId) {
        return false;
    }
    if (!isValidMovePacket(move)) {
        return false;
    }
    const {stackTop, discard} = playerViews[myId];
    switch(move.type) {
        case MOVES.PLAY_FROM_HAND:
            if (move.handIdx < 0 || move.handIdx >= myHand.length) {
                return false;
            }
            if (discarded) {
                return false;
            }
            return canPlayOnPile(myHand[move.handIdx], playPiles[move.playIdx]);
            break;
        case MOVES.PLAY_FROM_DISCARD:
            if (discarded) {
                return false;
            }
            const discardPile = discard[move.discardIdx];
            if (discardPile.length > 0) {
                return canPlayOnPile(discardPile[discardPile.length - 1], playPiles[move.playIdx]);
            }
            break;
        case MOVES.PLAY_FROM_STACK:
            if (discarded) {
                return false;
            }
            return canPlayOnPile(stackTop, playPiles[move.playIdx]);
            break;
        case MOVES.DISCARD:
            if (discarded) {
                return false;
            }
            return true; // any valid move packet is fine
            break;
        case MOVES.END_TURN:
            if (discarded) {
                return true;
            }
            break;
        case MOVES.UNDO:
            if (undoableMoves.length > 0) {
                if (movesAreSame(move.move, undoableMoves[undoableMoves.length-1])) {
                    return true;
                }
            }
            break;
        default:
            console.error(`Invalid move type ${move.type}`);
            return false;
            break;
    }
    return false;
}

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
/* discard */
function moveDiscard(handIdx, discardIdx) {
    return {
        type: MOVES.DISCARD,
        handIdx,
        discardIdx
    };
}
function moveEndTurn() {
    return {
        type: MOVES.END_TURN
    }
}
function moveUndo(move) {
    return {
        type: MOVES.UNDO,
        move // can't undo end turn or undo
    }
}
