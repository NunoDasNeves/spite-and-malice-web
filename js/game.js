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

function newGameState(playerIds, numDecks, stackSize, handSize) {
    const drawPile = makeDecks(numDecks);
    shuffleArray(drawPile);
    const players = playerIds.reduce(
            (obj, id) => {
                obj[id] = {
                    id,
                    stack: [],
                    stackTop: null,
                    hand: [],
                    discard: Array.from(Array(4), () => []),
                    discarded: false,
                };
                return obj;
            }, {});

    /* deal */
    for (let j = 0; j < stackSize; ++j) {
        for (const k of Object.keys(players)) {
            players[k].stack.push(drawPile.pop());
        }
    }
    for (let j = 0; j < handSize; ++j) {
        for (const k of Object.keys(players)) {
            players[k].hand.push(drawPile.pop());
        }
    }
    Object.values(players).forEach(p => { p.stackTop = p.stack.pop(); });

    const turnIdx = 0;
    const turn = playerIds[turnIdx];

    return {
        /* parameters of new game */
        playerIds,
        numDecks,
        stackSize,
        handSize,
        /* high level stuff */
        turnIdx,
        turn,
        ended: false,
        winner: -1,
        moveCount: 0,
        /* cards and moves stuff */
        undoableMoves: [],
        lastCardPlayed: null,
        drawPile,
        playPiles: Array.from(Array(4), () => []),
        players
    };
}

/* Game state as seen by one player at a given point in time */
function gameStateToView(state, myId) {
    /* deep copy */
    const view = JSON.parse(JSON.stringify(state));
    /* who am i */
    view.myId = myId;
    /* clear draw pile */
    const drawPileLength = view.drawPile.length;
    view.drawPile = [];
    view.drawPileLength = drawPileLength;
    /* clear player hands, stacks */
    Object.values(view.players).forEach(player => {
        const { id, stack, stackTop, hand, discard } = player;
        player.stack = [];
        player.stack.length = stack.length;
        if (id != myId) {
            player.hand = [];
            player.hand.length = hand.length;
        }
    });
    return view;
}

class Game {
    constructor(players, numDecks, stackSize, handSize) {
        /* player ids in ascending order, for determining turn */
        const playerIds = Object.keys(players)
                            .map((id) => Number(id))
                            .sort((a,b) => a - b);

        this.state = newGameState(playerIds, numDecks, stackSize, handSize);
    }
    toView(myId) {
        return gameStateToView(this.state, myId);
    }
    ended() {
        return this.state.ended;
    }
    move(move, playerId) {
        const result = doMove(this.state, move, playerId);
        /* do game state-only stuff if move went through */
        if (result && !this.state.ended) {
            /* check if hand needs refilling */
            if (    move.type === MOVES.END_TURN ||
                   (move.type === MOVES.PLAY_FROM_HAND && this.state.players[playerId].hand.length === 0)) {
                const hand = this.state.players[this.state.turn].hand;
                while (hand.length < this.state.handSize && this.state.drawPile.length > 0) {
                    hand.push(this.state.drawPile.pop());
                }
            } else if (move.type === MOVES.PLAY_FROM_STACK) {
                const player = this.state.players[this.state.turn];
                if (player.stackTop === null) {
                    player.stackTop = player.stack.pop();
                }
            }
            /* check play piles full */
            for (const pile of this.state.playPiles) {
                if (pile.length === PLAY_PILE_FULL_LENGTH) {
                    this.state.drawPile.concat.push(...pile);
                    pile.length = 0;
                    shuffleArray(this.state.drawPile);
                }
            }
        }
        return result;
    }
};

/* pre-validated with isValidMove */
const _moveFn = {
    [MOVES.PLAY_FROM_HAND](state, move, playerId) {
        const { handIdx, playIdx } = move;
        const player = state.players[playerId];
        const hand = player.hand;
        state.lastCardPlayed = hand[handIdx];
        state.playPiles[playIdx].push(hand[handIdx]);
        hand.splice(handIdx, 1);
        if (hand.length === 0) {
            state.undoableMoves.length = 0;
        } else {
            state.undoableMoves.push(move);
        }
    },
    [MOVES.PLAY_FROM_DISCARD](state, move, playerId) {
        const { discardIdx, playIdx } = move;
        const player = state.players[playerId];
        const discard = player.discard[discardIdx];
        state.lastCardPlayed = discard[discard.length - 1];
        state.playPiles[playIdx].push(discard.pop());
        state.undoableMoves.push(move);
    },
    [MOVES.PLAY_FROM_STACK](state, move, playerId) {
        const { playIdx } = move;
        const player = state.players[playerId];
        state.lastCardPlayed = player.stackTop;
        state.playPiles[playIdx].push(player.stackTop);
        player.stackTop = null;
        state.undoableMoves.length = 0;
        if (player.stack.length === 0) {
            state.ended = true;
            state.winner = playerId;
        }
    },
    [MOVES.DISCARD](state, move, playerId) {
        const { handIdx, discardIdx } = move;
        const player = state.players[playerId];
        const hand = player.hand;
        const discard = player.discard[discardIdx];
        state.lastCardPlayed = hand[handIdx];
        discard.push(hand[handIdx]);
        hand.splice(handIdx, 1);
        player.discarded = true;
        state.undoableMoves.push(move);
    },
    [MOVES.END_TURN](state, move, playerId) {
        state.turnIdx = (state.turnIdx + 1) % state.playerIds.length;
        state.turn = state.playerIds[state.turnIdx];
        const nextPlayer = state.players[state.turn];
        nextPlayer.discarded = false;
        state.undoableMoves.length = 0;
    },
    [MOVES.UNDO](state, { move }, playerId) {
        const player = state.players[playerId];
        switch(move.type) {
            case MOVES.PLAY_FROM_HAND:
                {
                    const hand = player.hand;
                    const card = state.playPiles[move.playIdx].pop();
                    hand.splice(move.handIdx, 0, card);
                }
                break;
            case MOVES.PLAY_FROM_DISCARD:
                {
                    const discard = player.discard[move.discardIdx];
                    const card = state.playPiles[move.playIdx].pop();
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
        state.undoableMoves.pop();
    }
};

function doMove(gameStateOrView, move, playerId) {
    if (isValidMove(gameStateOrView, move, playerId)) {
        _moveFn[move.type](gameStateOrView, move, playerId);
        gameStateOrView.moveCount++;
        return true;
    }
    return false;
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

function isValidMove(gameStateOrView, move, playerId) {
    const { players, playPiles, turn, ended, undoableMoves } = gameStateOrView;
    const player = players[playerId];
    const { stackTop, discard, discarded } = player;
    const myHand = player.hand;
    /* basic validation */
    if (ended) {
        return false;
    }
    if (turn != playerId) {
        return false;
    }
    if (!isValidMovePacket(move)) {
        return false;
    }
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
