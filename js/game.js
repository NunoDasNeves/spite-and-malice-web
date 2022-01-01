const MOVES = {
    PLAY_FROM_HAND: 0,
    PLAY_FROM_DISCARD: 1,
    PLAY_FROM_STACK: 2,
    DISCARD: 3,
    END_TURN: 4,
};

const PLAY_PILE_FULL_LENGTH = 12;

class Game {
    constructor(players, numDecks, stackSize, handSize) {
        this.ended = false;
        this.winner = -1;

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
            myId: myId,
            myHand: this.players[myId].hand,
            ended: this.ended,
            winner: this.winner,
            lastCardPlayed: this.lastCardPlayed,
            discarded: this.players[myId].discarded,
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
        [MOVES.PLAY_FROM_HAND]({handIdx, playIdx}, playerId) {
            const player = this.players[playerId];
            const hand = player.hand;
            this.lastCardPlayed = hand[handIdx];
            this.playPiles[playIdx].push(hand[handIdx]);
            hand.splice(handIdx, 1);
            this.checkPlayPileFull(playIdx);
            if (hand.length == 0) {
                this.fillHand(hand);
            }
        },
        [MOVES.PLAY_FROM_DISCARD]({discardIdx, playIdx}, playerId) {
            const player = this.players[playerId];
            const discard = player.discard[discardIdx];
            this.lastCardPlayed = discard[discard.length - 1];
            this.playPiles[playIdx].push(discard.pop());
            this.checkPlayPileFull(playIdx);
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
        },
        [MOVES.DISCARD]({handIdx, discardIdx}, playerId) {
            const player = this.players[playerId];
            const hand = player.hand;
            const discard = player.discard[discardIdx];
            this.lastCardPlayed = hand[handIdx];
            discard.push(hand[handIdx]);
            hand.splice(handIdx, 1);
            player.discarded = true;
        },
        [MOVES.END_TURN]({}, playerId) {
            this.turnIdx = (this.turnIdx + 1) % this.playerIds.length;
            this.turn = this.playerIds[this.turnIdx];
            const nextPlayer = this.players[this.turn];
            this.fillHand(nextPlayer.hand);
            nextPlayer.discarded = false;
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

function isValidMove(move, {playerViews, playPiles, myHand, myId, turn, ended, discarded}) {
    /* basic validation */
    if (ended) {
        return false;
    }
    if (turn != myId) {
        return false;
    }
    if (move.hasOwnProperty('handIdx')) {
        if (move.handIdx < 0 || move.handIdx >= myHand.length) {
            return false;
        }
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
    if (move.type != MOVES.END_TURN && discarded) {
        return false;
    }
    let ret = false;
    const {stackTop, discard} = playerViews[myId];
    switch(move.type) {
        case MOVES.PLAY_FROM_HAND:
            if (!move.hasOwnProperty('handIdx') || !move.hasOwnProperty('playIdx')) {
                ret = false;
            } else {
                ret = canPlayOnPile(myHand[move.handIdx], playPiles[move.playIdx]);
            }
            break;
        case MOVES.PLAY_FROM_DISCARD:
            if (!move.hasOwnProperty('discardIdx') || !move.hasOwnProperty('playIdx')) {
                ret = false;
            } else {
                const discardPile = discard[move.discardIdx];
                if (discardPile.length == 0) {
                    ret = false
                } else {
                    ret = canPlayOnPile(discardPile[discardPile.length - 1], playPiles[move.playIdx]);
                }
            }
            break;
        case MOVES.PLAY_FROM_STACK:
            if (!move.hasOwnProperty('playIdx')) {
                ret = false;
            } else {
                ret = canPlayOnPile(stackTop, playPiles[move.playIdx]);
            }
            break;
        case MOVES.DISCARD:
            if (!move.hasOwnProperty('handIdx') || !move.hasOwnProperty('discardIdx')) {
                ret = false;
            } else {
                ret = true;
            }
            break;
        case MOVES.END_TURN:
            if (discarded) {
                ret = true;
            } else {
                ret = false;
            }
            break;
        default:
            console.error(`Invalid move type ${move.type}`);
            ret = false;
            break;
    }
    return ret;
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

