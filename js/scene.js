/* Game animation, 3D stuff */

const loadingScene = {};

function cardToCardObj({value, suite}) {
    if (value == 14) {
        return obj3Ds.cards[obj3Ds.cards.length-1].clone();
    }
    let idx = (value - 1) + (suite * 13);
    return obj3Ds.cards[idx].clone();
}

function initLoadingScene(canvas) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F0F0F);
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({canvas});

    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(-1, 2, 4);

    const cards = DECK_NO_JOKERS.map(cardToCardObj);
    scene.add(...cards);
    scene.add(light);

    for(let i = 0; i < cards.length; ++i) {
        const xPos = (i/cards.length) * 14 - 7;
        cards[i].position.x = xPos;
        cards[i].rotation.y = 0.2;
    }
    camera.position.z = 7;

    loadingScene.animate = (t) => {
        let p = (t % 2000)/2000 * Math.PI * 2;
        let r = (t % 4000)/4000 * Math.PI * 2;
        for(let i = 0; i < cards.length; ++i) {
            let o = i / cards.length * Math.PI * 2;
            cards[i].position.y = Math.sin(p + o);
            cards[i].rotation.y = Math.sin(r + o) * Math.PI/18 + 0.2;
        }

        renderer.render(scene, camera);
    };

    loadingScene.resize = () => {
        resizeRenderer(camera, canvas, renderer);
    };
}

/* 
* Resize internal canvas buffer
* Remember, canvas.width and canvas.height are the buffer size
* canvas.clientWidth and canvas.clientHeight are the size on the page
* The client size should be handled by css (or we could set updateStyle arg in renderer.setSize to true)
*/
function resizeRenderer(camera, canvas, renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
}

/* stuff you can hover on */
const HOVER = Object.freeze({
    NONE: 0,
    HAND: 1,
    DISCARD: 2,
    STACK: 3,
    PLAY: 4,
    DISCPLACE: 5,
});

/* stuff you can drag + drop */
const DRAGDROP = Object.freeze({
    NONE: 0,
    HAND: 1,
    DISCARD: 2,
    STACK: 3,
    PLAY: 4
});

/* stuff you can hover on to stuff you can drag */
const HOVER_TO_DRAG = Object.freeze({
    [HOVER.HAND]: DRAGDROP.HAND,
    [HOVER.DISCARD]: DRAGDROP.DISCARD,
    [HOVER.STACK]: DRAGDROP.STACK,
});

const PLAY_AND_DRAW_PILES_INC = 2.7;
const DISCARD_AND_STACK_PILES_INC = 2.7;

const PLAY_AND_DRAW_PILES_WIDTH_2 = (PLAY_AND_DRAW_PILES_INC * NUM_PLAY_PILES + CARD_PLACE_WIDTH)/2
const PLAY_AND_DRAW_PILES_HEIGHT_2 = (CARD_PLACE_HEIGHT)/2

const DISCARD_SHOW_TOP = 3;

const VIEWCAM = Object.freeze({
    //1: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-13,12) },
    1: { xOff: 4, yOff: 4, camPos: new THREE.Vector3(0,0,19) },
    //2: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-11,11) },
    2: { xOff: 4, yOff: 4, camPos: new THREE.Vector3(0,0,19) },
    //3: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-12,11) },
    3: { xOff: 4, yOff: 4, camPos: new THREE.Vector3(0,0,19) },
    //4: { xOff: 4.5, yOff: 4.5, camPos: new THREE.Vector3(0,-10,13) },
    4: { xOff: 4, yOff: 4, camPos: new THREE.Vector3(0,0,18) },
    //5: { xOff: 7, yOff: 7, camPos: new THREE.Vector3(0,-13,13) },
    5: { xOff: 7, yOff: 7, camPos: new THREE.Vector3(0,0,22) },
    //6: { xOff: 9, yOff: 11, camPos: new THREE.Vector3(0,-17,15) },
    6: { xOff: 9, yOff: 11, camPos: new THREE.Vector3(0,0,24) },
});

const CARD_STACK_DIST = 0.025;
const CARD_SPREAD_DIST_Y = 1.6; // dist between each card - spreading a stack out on the table, lengthwise (see discard pile)

function angleToPointOnEllipse(xRadius, yRadius, angle) {
    const t = Math.atan2(yRadius, xRadius * Math.tan(angle));
    return {x: xRadius * Math.cos(t), y: yRadius * Math.sin(t)};
}

function worldPos3DToCanvasPos(vec, camera, canvas) {
    const mat = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)
    const clipPos = vec.clone().applyMatrix4(mat);
    return {
        x: ((clipPos.x + 1) / 2) * canvas.clientWidth,
        y: (1 - ((clipPos.y + 1) / 2)) * canvas.clientHeight
    };
}

function makeCurveObj(curve, color, nPoints) {
    const points = curve.getPoints(nPoints);
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    const material = new THREE.LineBasicMaterial({ color });
    const obj = new THREE.Line(geometry, material);
    return obj;
}

function makeTransformRelativeTo(obj, relObj) {
    const p = obj.parent;
    const v = new THREE.Vector3();
    const q = new THREE.Quaternion();
    relObj.add(obj);
    obj.getWorldPosition(v);
    obj.getWorldQuaternion(q);
    obj.removeFromParent();
    obj.quaternion.copy(q);
    obj.position.copy(v);
    if (p) {
        p.add(obj);
    }
}

function animLerpSlerp(currT, anim) {
    const { obj, goalObj, curveObj, curve, initQuat, goalQuat, animT, startT } = anim;
    const t = (currT - startT) / animT;
    if (t < 1) {
        curve.getPointAt(t, obj.position);
        obj.quaternion.slerpQuaternions(anim.initQuat, anim.goalQuat, t);
        return false;
    } else {
        curveObj.removeFromParent();
        return true;
    }
}

const ANIM_SPEED_MAX = 0.1;
const ANIM_SPEED_MIN = 0.001;

class GameScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0F0F0F);
        this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.cameraLookAtPoint = null;
        this.renderer = new THREE.WebGLRenderer({canvas});
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);

        this.lightD = new THREE.DirectionalLight(0xFFFFFF);
        this.lightD.position.set(-1, -8, 12);
        this.lightA = new THREE.AmbientLight(0x404040)

        this.cardPlane = obj3Ds.cardPlane.clone();
        this.cardPlane.position.set(0,0,5.5);

        this.raycaster = new THREE.Raycaster();
        this.dragGlow = obj3Ds.cardGlow.cyan.clone();
        this.hoverGlow = obj3Ds.cardGlow.green.clone();
        this.ghostCards = Object.entries(obj3Ds.ghostCards)
                            .reduce((obj, [key, cardObj]) => {
                                obj[key] = cardObj.clone();
                                return obj;
                            }, {});
        this.ghostCard = this.ghostCards[1];
        this.statusHTML = null;

        this.table = obj3Ds.tables.default.clone();
        this.started = false;
    }

    updateMyHandTransform() {
        this.myHandGroup.position.set(0,-9.3,-13);
        this.myHandGroup.quaternion.set(0,0,0,1);
        makeTransformRelativeTo(this.myHandGroup, this.camera);
    }

    start(gameView, roomInfo) {

        this.scene.clear();
        this.scene.add(this.table);
        this.scene.add(this.cardPlane);
        this.scene.add(this.lightD);
        this.scene.add(this.lightA);

        this.dragging = false;
        this.drag = {
            card: null,
            obj: null,
            type: DRAGDROP.NONE,
            fromIdx: 0,
            fromPos: null,
            fromQuat: null,
            fromParent: null,
        };
        this.zoomed = false;
        this.zoom = {
            type: HOVER.NONE,
            zoomedObj: null,
            oldObj: null,
            /* TODO for DISCPLACE */
            scrollPos: 0,
            maxScrollPos: 0,
        };

        // animQueue gates updateQueue
        this.animQueue = [];

        this.updateQueue = [];
        this.leftLastFrame = rawInput.pointer.left;
        this.hoverArrs = [];

        const {playerIds, players, myId, turn, ended, winner} = gameView;
        this.myId = myId;

        this.gameView = gameView;
        this.history = [];

        /* stuff translated from gameView */
        this.players = {};
        this.playPiles = Array.from(Array(NUM_PLAY_PILES), () => ({ place: null, glow: null, arr: [] }));
        this.playPilesGroup = null;
        this.playPilesCardGroup = null;
        this.drawPileCardGroup = null;
        this.myHandGroup = null;
        this.myHand = [];
        /* sorted list of playerIds rotated with myId first, for drawing the players */
        this.playerIds = playerIds.map(x => x); // have to clone it or it messed with gameView
        while(this.playerIds[0] != myId) {
            let id = this.playerIds.shift();
            this.playerIds.push(id);
        }
        this.numPlayers = this.playerIds.length;

        /* camera (reuse some of this for views) */
        const { xOff, yOff, camPos } = VIEWCAM.hasOwnProperty(this.numPlayers) ? VIEWCAM[this.numPlayers] : VIEWCAM.default(this.numPlayers);
        const xRadius = PLAY_AND_DRAW_PILES_WIDTH_2 + xOff;
        const yRadius = PLAY_AND_DRAW_PILES_HEIGHT_2 + yOff;
        this.camera.position.copy(camPos);
        this.cameraLookAtPoint = new THREE.Vector3(0,0,0);//(0,-(PLAY_AND_DRAW_PILES_HEIGHT_2 + yOff/2),0);
        this.camera.lookAt(this.cameraLookAtPoint);

        /* hand */
        this.myHandGlows = Array.from(Array(gameView.handSize), () => (obj3Ds.cardGlow.cyan.clone()) );
        this.myHandGroup = new THREE.Group();
        this.scene.add(this.myHandGroup);
        this.updateMyHandTransform();

        /* play piles */
        this.playPilesGroup = new THREE.Group();
        /* group just for the cards... */
        this.playPilesCardGroup = new THREE.Group();
        this.playPilesGroup.add(this.playPilesCardGroup);
        this.scene.add(this.playPilesGroup);
        const pileOffset = new THREE.Vector3(-PLAY_AND_DRAW_PILES_WIDTH_2,0,0);
        for (let i = 0; i < 4; ++i) {
            const playCardPlace = obj3Ds.cardPlace.clone();
            playCardPlace.position.copy(pileOffset);
            this.playPiles[i].place = playCardPlace;
            this.playPilesGroup.add(playCardPlace);
            this.playPiles[i].glow = obj3Ds.cardGlow.yellow.clone();
            pileOffset.x += PLAY_AND_DRAW_PILES_INC;
        }
        /* draw pile */
        this.drawPileCardGroup = new THREE.Group();
        this.drawPileCardGroup.position.copy(pileOffset);
        this.scene.add(this.drawPileCardGroup);

        /* views */
        const radInc = (1/this.numPlayers) * Math.PI * 2;
        let rotation = 0;

        for (let i = 0; i < this.numPlayers; ++i) {
            const id = this.playerIds[i];
            const { name, color, connected } = roomInfo.players[id];
            const view = {
                            group: null,
                            label: null,
                            labelCanvas: null,
                            connected,
                            name,
                            color,
                            id,
                            discard: Array.from(Array(NUM_DISCARD_PILES), () => ({
                                place: null,
                                group: null,
                                turnGlow: null,
                                glow: null,
                                arr: []
                            })),
                            stack: { count: 0, group: null, top: null, glow: null },
                            hand: { count: 0, group: null, objArr: [], },
                        };
            this.players[id] = view;

            /* group for relative positioning of the player */
            const group = new THREE.Group();
            view.group = group;
            group.rotateZ(rotation); // note the rotation won't be normal to the ellipse, but it's fine
            const {x, y} = angleToPointOnEllipse(xRadius, yRadius, rotation);
            const vec = new THREE.Vector2(x,y);
            group.translateY(-vec.length());
            rotation += radInc;
            /* only add the group, not the rest of the player view */
            this.scene.add(group);

            /* player name cards */
            const {mesh, canvas} = makeNameCard(name, PLAYER_COLORS[view.color]);
            view.label = mesh;
            view.labelCanvas = canvas;
            view.label.rotation.z = Math.PI;
            view.label.position.set(0,1.5,0);
            group.add(view.label);

            /* hand */
            view.hand.group = new THREE.Group();
            /* face inward, because these are card _backs_ */
            view.hand.group.rotation.x = Math.PI * (2 - 3/5);
            view.hand.group.position.set(0,-4.5,2);
            group.add(view.hand.group);

            const discStartX = (DISCARD_AND_STACK_PILES_INC*NUM_DISCARD_PILES)/2;
            const discPileOffset = new THREE.Vector3(-discStartX,-1,0);
            const stackPileOffset = new THREE.Vector3(discStartX,0.5,0);
            /* stack */
            view.stack.group = new THREE.Group();
            view.stack.group.position.set(discStartX,0.5,0);
            group.add(view.stack.group);
            view.stack.glow = obj3Ds.cardGlow.cyan.clone();

            /* discard */
            for (let j = 0; j < NUM_DISCARD_PILES; ++j) {
                /* place for empty discard piles */
                const discCardPlace = obj3Ds.cardPlace.clone();
                view.discard[j].place = discCardPlace;
                discCardPlace.position.copy(discPileOffset);
                view.discard[j].glow = obj3Ds.cardGlow.yellow.clone();
                view.discard[j].turnGlow = obj3Ds.cardGlow.cyan.clone();
                group.add(discCardPlace);
                /* card groups for each discard pile, for zooming and stuff */
                const discardGroup = new THREE.Group();
                discardGroup.position.copy(discPileOffset);
                view.discard[j].group = discardGroup;
                group.add(discardGroup);
                /* the actual pile */
                discPileOffset.x += DISCARD_AND_STACK_PILES_INC;
            }
        }

        this.started = true;
        this.updateRoomInfo(roomInfo);
        this.fullUpdateFromGameView(gameView);
        this.updateHTMLUI();
        this.updateHoverArrs();
    }

    updateRoomInfo(roomInfo) {
        Object.values(this.players).forEach((view) => {
            if (!roomInfo.players.hasOwnProperty(view.id)) {
                console.error(`missing player ${view.id} from roomInfo`);
                return;
            }

            /* update namecard */
            const { connected } = roomInfo.players[view.id];
            if (connected != view.connected) {
                view.connected = connected;
                drawNameCard(view.labelCanvas, view.name, PLAYER_COLORS[view.color], view.connected);
                /* make the texture update */
                view.label.material.map.needsUpdate = true;
            }
        });
    }

    endTurn() {
        const move = moveEndTurn();
        if (this.doMoveLocally(move)) {
            client.sendPacketMove(move);
        }
    }

    undo() {
        /* the button would be disabled if undoableMoves.length was 0 */
        const move = moveUndo(this.gameView.undoableMoves[this.gameView.undoableMoves.length - 1]);
        if (this.doMoveLocally(move)) {
            client.sendPacketMove(move);
        }
    }

    updateHTMLUI() {
        if (!this.gameView) { // test shenanigans
            return;
        }

        if (isValidMove(this.gameView, moveEndTurn(), this.myId)) {
            endTurnButton.disabled = false;
        } else {
            endTurnButton.disabled = true;
        }

        if (this.myTurn() && this.gameView.undoableMoves.length > 0) {
            undoButton.disabled = false;
        } else {
            undoButton.disabled = true;
        }
    }

    doMoveLocally(move) {
        // NOTE this modifies this.history
        const newView = doMove(this.gameView, move, this.myId, this.history);
        if (newView === null) {
            return false;
        }
        this.updateQueue.push(() => {
            this.myTurnUpdate(newView, move);
            this.gameView = newView;
            this.updateHTMLUI();
            this.updateHoverArrs();
        });
        return true;
    }

    doMoveFromServer(gameView, move) {
        this.updateQueue.push(() => {
            this._updateFromServer(gameView, move);
        });
    }

    updateMyHand(hand) {
        this.myHandGroup.clear();
        const myHandWidth_2 = ((hand.length-1) * 1.5)/2;
        this.myHand = hand.map(cardToCardObj);
        this.myHand.forEach((obj, idx) => {
                    /* go from right to left, so the list order has them in front to back sorted order for ray casting */
                    obj.position.x = myHandWidth_2 - idx * 1.5;
                    obj.rotation.y = Math.PI/32;
                    this.myHandGroup.add(obj);
                });
    }

    updateMyTurnGlows() {
        const myView = this.players[this.myId];

        if (this.canDrag() && !this.dragging) {
            this.myHand.forEach((obj, idx) => {
                obj.add(this.myHandGlows[idx]);
            });
            if (myView.stack.top !== null) {
                myView.stack.top.add(myView.stack.glow);
            }
            myView.discard.forEach(({ arr, turnGlow }) => {
                if (arr.length > 0) {
                    arr[arr.length - 1].add(turnGlow);
                }
            });
        } else {
            this.myHandGlows.forEach(glow => {glow.removeFromParent();});
            myView.stack.glow.removeFromParent();
            myView.discard.forEach(({ turnGlow }) => {
                turnGlow.removeFromParent();
            });
        }
    }

    updatePlayerStack(playerId, length, stackTop) {
        const stack = this.players[playerId].stack;
        stack.count = length + (stackTop === null ? 0 : 1); /* for hover */
        stack.group.clear();
        for (let i = 0; i < length; ++i) {
            const obj = obj3Ds.cardStack.clone();
            obj.position.z = i * CARD_STACK_DIST;
            stack.group.add(obj);
        }
        if (stackTop !== null) {
            const topObj = cardToCardObj(stackTop);
            stack.top = topObj;
            topObj.position.z = length * CARD_STACK_DIST;
            stack.group.add(topObj);
        } else {
            stack.top = null;
        }
    }

    updateDrawPile(length) {
        this.drawPileCardGroup.clear();
        for (let i = 0; i < length; ++i) {
            const obj = obj3Ds.cardStack.clone();
            obj.position.z = i * CARD_STACK_DIST;
            this.drawPileCardGroup.add(obj);
        }
    }

    getNextPlayPileCardPositionAndQuaternion(playPile) {
        const o = new THREE.Object3D();
        this.playPilesCardGroup.add(o);
        o.position.copy(playPile.place.position);
        o.translateZ(CARD_STACK_DIST * (playPile.arr.length + 1));
        const v = new THREE.Vector3();
        const q = new THREE.Quaternion();
        o.getWorldPosition(v);
        o.getWorldQuaternion(q);
        o.removeFromParent();
        return [v, q];
    }

    /* TODO this doesn't work properly... need to animate discard pile, hide cards when too full! */
    getNextDiscardPileCardPositionAndQuaternion(discardPile) {
        const o = new THREE.Object3D();
        discardPile.group.add(o);
        const nextIdx = discardPile.arr.length;
        /* TODO */
        /* index of first visible card */
        /*const topCardsIdx = discardPile.arr.length > DISCARD_SHOW_TOP ? discardPile.arr.length - DISCARD_SHOW_TOP : 0;
        if (nextIdx <= topCardsIdx) {
            o.position.setZ(CARD_STACK_DIST * (discardPile.arr.length + 1));
        } else {
            const topIdx = nextIdx - topCardsIdx;
        }*/
        o.rotation.x = Math.PI/64; // tilt up slightly
        o.position.set(0,
            /* stagger in y axis so you can see DISCARD_SHOW_TOP cards */
            -CARD_SPREAD_DIST_Y * nextIdx,
            /* bit of extra spacing because they're tilted up */
            CARD_STACK_DIST * nextIdx + 0.09);
        const v = new THREE.Vector3();
        const q = new THREE.Quaternion();
        o.getWorldPosition(v);
        o.getWorldQuaternion(q);
        o.removeFromParent();
        return [v, q];
    }

    _updateFromServer(gameView, move) {

        /* Something I didn't do; not my turn */
        if (this.gameView.turn !== this.myId) {
            console.debug(`Player ${this.myId} - not my turn; update from server`);
            this.notMyTurnUpdate(gameView, move);
            this.history.push(this.gameView);
            this.gameView = gameView;
            /* these depend on updated this.gameView */
            this.updateHTMLUI();
            this.updateHoverArrs();
            return;
        }

        /* It's my turn, but it wasn't my turn last turn! */
        if (move.type == MOVES.END_TURN) {
            console.debug(`Player ${this.myId} turn started; full update from server`);
            this.fullUpdateFromGameView(gameView);
            this.history.push(this.gameView);
            this.gameView = gameView;
            /* these depend on updated this.gameView */
            this.updateHTMLUI();
            this.updateHoverArrs();
            return;
        }

        /* It's my turn, it's a partial update. Only update what needs to be updated */

        /* Figure out which gameview/s to update (could be in history) */
        const statesToUpdate = [this.gameView]; /* always update the latest... */
        const numHistoriesToUpdate = this.gameView.moveCount - gameView.moveCount;
        for (let i = 0; i < numHistoriesToUpdate; i++) {
            const idx = this.history.length - 1 - i
            const state = this.history[idx];
            statesToUpdate.push(state);
        }
        switch(move.type) {
            case MOVES.PLAY_FROM_HAND:
            {
                /*
                 * If this update has a full hand, it must be because hand was emptied.
                 * No other moves involving hand could have been made locally since.
                 */
                const newPlayer = gameView.players[this.myId];
                if (newPlayer.hand.length === this.gameView.handSize) {
                    /* update historic gameViews */
                    for (const state of statesToUpdate) {
                        const player = state.players[this.myId];
                        player.hand = JSON.parse(JSON.stringify(gameView.players[this.myId].hand));
                        state.drawPile.length = gameView.drawPile.length;
                    }
                    /* update objects */
                    this.updateMyHand(newPlayer.hand);
                    this.updateDrawPile(gameView.drawPile.length);
                    this.updateHoverArrs();
                    console.debug(`Player ${this.myId} fill hand from server`);
                }
                break;
            }
            case MOVES.PLAY_FROM_STACK:
            {
                /* update historic gameViews */
                const newPlayer = gameView.players[this.myId];
                for (const state of statesToUpdate) {
                    const player = state.players[this.myId];
                    player.stack.length = newPlayer.stack.length;
                    player.stackTop = JSON.parse(JSON.stringify(newPlayer.stackTop));
                }
                /* update objects */
                this.updatePlayerStack(this.myId, newPlayer.stack.length, newPlayer.stackTop);
                this.updateHoverArrs();
                console.debug(`Player ${this.myId} flip stack top from server`);
                break;
            }
            default:
                break;
        }
    }

    myTurnUpdate(gameView, move) {

        this.fullUpdateFromGameView(gameView);
    }

    /* only call this on not my turn */
    notMyTurnUpdate(gameView, move) {
        const anim = this.notMyMoveAnimation(gameView, move, this.gameView.turn);
        /* it's null if its like, end turn or undo animation. we do the full update as usual */
        if (anim != null) {
            this.animQueue.push(anim);
            return;
        }
        this.fullUpdateFromGameView(gameView);
    }

    fullUpdateFromGameView(gameView) {

        const {players, playPiles, drawPile, turn, winner, ended, lastCardPlayed} = gameView;
        const player = players[this.myId];
        const discarded = player.discarded;

        /* my hand */
        this.updateMyHand(player.hand);

        /* play piles and draw pile */
        this.playPilesCardGroup.clear();
        this.playPiles.forEach((pile, pileIdx) => {
            pile.arr = [];
            playPiles[pileIdx].forEach(
                (card, idx) => {
                    const [v, q] = this.getNextPlayPileCardPositionAndQuaternion(pile);
                    const obj = cardToCardObj(card);
                    obj.position.copy(v);
                    obj.quaternion.copy(q);
                    this.playPilesCardGroup.attach(obj);
                    pile.arr.push(obj);
                }
            );
        });

        /* draw pile */
        this.updateDrawPile(drawPile.length);

        /* map player view packet to GameScene playerview */
        Object.values(this.players).forEach((view) => {
            if (!players.hasOwnProperty(view.id)) {
                console.error(`missing player ${view.id} from view`);
                return;
            }
            const {hand, stackTop, stack, discard} = players[view.id];

            /* back of hand */
            if (view.id != this.myId) {
                view.hand.group.clear();
                view.hand.objArr.length = 0;
                view.hand.count = hand.length;
                const handWidth_2 = ((hand.length-1) * 1.5)/2;
                for (let i = 0; i < hand.length; ++i) {
                    const obj = obj3Ds.cardStack.clone();
                    obj.position.x = handWidth_2 - i * 1.5;
                    obj.rotation.y = Math.PI/32;
                    view.hand.group.add(obj);
                    view.hand.objArr.push(obj);
                }
            }

            /* stack */
            this.updatePlayerStack(view.id, stack.length, stackTop);

            /* discard */
            view.discard.forEach((discardPile, pileIdx) => {
                discardPile.group.clear();
                discardPile.arr = [];
                discard[pileIdx].forEach(
                    (card) => {
                        const obj = cardToCardObj(card);
                        const [v, q] = this.getNextDiscardPileCardPositionAndQuaternion(discardPile);
                        obj.position.copy(v);
                        obj.quaternion.copy(q);
                        discardPile.group.attach(obj);
                        discardPile.arr.push(obj);
                    }
                );
            });
        });
    }
    /* create arrays of stuff that can be interacted with (for raycasting) */
    updateHoverArrs() {
        const myView = this.players[this.myId];
        const hoverArrs = [];
        if (this.canDrag()) {
            hoverArrs.push({ type: HOVER.HAND, arr: this.myHand.map((obj,idx) => ({obj, idx})) });
            hoverArrs.push({
                type: HOVER.DISCARD,
                arr: myView.discard
                        .map(({ arr }, idx) => arr.length > 0 ? {obj: arr[arr.length - 1], idx} : null)
                });
        }
        const hoverDiscPlace = { type: HOVER.DISCPLACE, arr: [] };
        const hoverStack = { type: HOVER.STACK, arr: [] };
        Object.values(this.players).forEach(({ stack, discard, id }) => {
            const mine = id == this.myId;
            discard.forEach(({ arr }, idx) => {
                const minLen = mine ? DISCARD_SHOW_TOP : 0; /* always glow other players piles */
                if (arr.length > minLen) {
                    const glowIdx = arr.length > DISCARD_SHOW_TOP ? arr.length - DISCARD_SHOW_TOP: 0;
                    hoverDiscPlace.arr.push({ obj: arr[glowIdx], player: id, idx, mine });
                }
            });
            if (stack.top != null) {
                hoverStack.arr.push({ obj: stack.top, size: stack.count, player: id, mine });
            }
        });
        /* order of pushing matters - prioritize draggables */
        hoverArrs.push(hoverStack);
        hoverArrs.push({ type: HOVER.PLAY,
                         arr: this.playPiles
                                .map(({ arr }, idx) => arr.length > 0 ? { obj: arr[arr.length - 1], idx, size: arr.length } : null)
                        });
        hoverArrs.push(hoverDiscPlace);
        this.hoverArrs = hoverArrs;

        /* update world matrices, or raycasting won't work until next frame */
        for (const { type, arr } of this.hoverArrs) {
            for (let i = 0; i < arr.length; ++i) {
                const hover = arr[i];
                if (hover == null) {
                    continue;
                }
                const obj = hover.obj;
                obj.updateMatrixWorld();
            }
        }
    }
    /* state is already updated, use the move to determine what is animating and start animating it */
    notMyMoveAnimation(newState, move, prevTurn) {
        const anim = {};
        const { hand, discard, stack } = this.players[prevTurn];

        anim.fn = animLerpSlerp;
        anim.doneFn = () => {};
        anim.done = false;
        anim.goalObj = null;
        anim.initPos = new THREE.Vector3();
        anim.initQuat = new THREE.Quaternion();
        anim.goalPos = new THREE.Vector3();
        anim.goalQuat = new THREE.Quaternion();
        switch (move.type) {
            case MOVES.PLAY_FROM_HAND:
            {
                const playPile = this.playPiles[move.playIdx];
                const statePlayPile = newState.playPiles[move.playIdx];
                const obj = cardToCardObj(statePlayPile[statePlayPile.length - 1]);
                /* there's a blank card we need to replace with obj, which has the card face */
                const blankObj = hand.objArr[move.handIdx];
                blankObj.parent.add(obj);
                obj.position.copy(blankObj.position);
                obj.rotation.copy(blankObj.rotation);
                blankObj.removeFromParent();
                /* for this and discard, need the card to face inward, not outward */
                obj.rotateY(Math.PI);
                obj.getWorldPosition(anim.initPos);
                obj.getWorldQuaternion(anim.initQuat);
                this.scene.add(obj);
                anim.obj = obj;
                [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
                anim.doneFn = (t, {obj}) => {
                    this.playPilesCardGroup.attach(obj);
                    playPile.arr.push(obj);
                    hand.objArr.splice(move.handIdx, 1);
                };
                break;
            }
            case MOVES.PLAY_FROM_DISCARD:
            {
                const discardArr = discard[move.discardIdx].arr;
                const obj = discardArr[discardArr.length - 1];
                const playPile = this.playPiles[move.playIdx];
                /* this will make opposite players' cards not rotate as much */
                /* (may not look good in all cases...) */
                obj.rotateZ(Math.PI);
                obj.getWorldPosition(anim.initPos);
                obj.getWorldQuaternion(anim.initQuat);
                this.scene.add(obj);
                anim.obj = obj;
                [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
                anim.doneFn = (t, {obj}) => {
                    this.playPilesCardGroup.attach(obj);
                    playPile.arr.push(obj);
                };
                break;
            }
            case MOVES.PLAY_FROM_STACK:
            {
                const obj = stack.top;
                const playPile = this.playPiles[move.playIdx];
                obj.rotateZ(Math.PI);
                obj.getWorldPosition(anim.initPos);
                obj.getWorldQuaternion(anim.initQuat);
                this.scene.add(obj);
                anim.obj = obj;
                [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
                anim.doneFn = (t, {obj}) => {
                    this.playPilesCardGroup.attach(obj);
                    playPile.arr.push(obj);
                };
                break;
            }
            case MOVES.DISCARD:
            {
                const discardPile = discard[move.discardIdx];
                const stateDiscard = newState.players[prevTurn].discard[move.discardIdx];
                const obj = cardToCardObj(stateDiscard[stateDiscard.length - 1]);
                /* there's a blank card we need to replace with obj, which has the card face */
                const blankObj = hand.objArr[move.handIdx];
                blankObj.parent.add(obj);
                obj.position.copy(blankObj.position);
                obj.rotation.copy(blankObj.rotation);
                blankObj.removeFromParent();
                obj.rotateY(Math.PI);
                obj.rotateZ(Math.PI);
                obj.getWorldPosition(anim.initPos);
                obj.getWorldQuaternion(anim.initQuat);
                this.scene.add(obj);
                anim.obj = obj;
                [anim.goalPos, anim.goalQuat] = this.getNextDiscardPileCardPositionAndQuaternion(discardPile);
                anim.doneFn = (t, {obj}) => {
                    discardPile.group.attach(obj);
                    discardPile.arr.push(obj);
                    hand.objArr.splice(move.handIdx, 1);
                };
                break;
            }
            case MOVES.END_TURN:
            case MOVES.UNDO:
                return null;
        }
        const midControlPoint = anim.goalPos.clone().add(new THREE.Vector3(0,0,5));
        anim.curve = new THREE.QuadraticBezierCurve3(
            anim.initPos,
            midControlPoint,
            anim.goalPos,
        );
        anim.curveObj = makeCurveObj(anim.curve, 0xff0000, 10);
        this.scene.add(anim.curveObj);
        anim.animT = 500; /* time in milliseconds */
        anim.startT = performance.now(); /* set when we start playing the animation */

        anim.done = anim.fn(anim.startT, anim);

        return anim;
    }

    startZoom(type, hover) {
        if (!this.leftLastFrame && rawInput.pointer.left) {
            this.zoomed = true;
            this.zoom.type = type;
            this.hoverGlow.removeFromParent(); // so we don't clone it
            if (type == HOVER.DISCPLACE) {
                const view = this.players[hover.player];
                const { group, arr } = view.discard[hover.idx];
                this.zoom.oldObj = group;
                this.zoom.zoomedObj = new THREE.Group();
                const yEnd = (arr.length - 1) * CARD_SPREAD_DIST_Y;
                arr.forEach(({obj}, idx) => {
                    const newObj = obj.clone();
                    newObj.rotation.x = Math.PI/64; // tilt up slightly
                    newObj.position.set(0,yEnd - CARD_SPREAD_DIST_Y * idx,0);
                    this.zoom.zoomedObj.add(newObj);
                });
            } else { // STACK
                this.zoom.oldObj = hover.obj;
                this.zoom.zoomedObj = hover.obj.clone();
            }
            const obj = this.zoom.zoomedObj;
            this.scene.add(obj);
            obj.position.set(0,-1,-7);
            obj.quaternion.set(0,0,0,1);
            makeTransformRelativeTo(obj, this.camera);
            this.zoom.oldObj.visible = false;
            return true;
        }
        return false;
    }

    endZoom() {
        if (!this.leftLastFrame && rawInput.pointer.left) {
            this.zoomed = false;
            this.zoom.oldObj.visible = true;
            this.zoom.zoomedObj.removeFromParent();
        }
    }

    startDrag(type, hover) {
        const obj = hover.obj;
        if (
                rawInput.pointer.left &&
                HOVER_TO_DRAG.hasOwnProperty(type) &&               // draggable object
                (type == HOVER.STACK ? hover.mine : true)           // its MY stack
                ) {
            hover.obj.add(this.dragGlow);
            this.dragging = true;
            this.drag.obj = obj;
            this.drag.type = HOVER_TO_DRAG[type];
            this.drag.fromParent = obj.parent;
            this.drag.fromIdx = hover.idx;
            this.drag.fromPos = obj.position.clone();
            this.drag.fromQuat = obj.quaternion.clone();
            const v = new THREE.Vector3();
            const q = new THREE.Quaternion();
            obj.getWorldPosition(v);
            obj.getWorldQuaternion(q);
            obj.removeFromParent();
            obj.quaternion.copy(q);
            obj.position.copy(v);
            //obj.position.set(0,0,0);
            //obj.quaternion.set(0,0,0,0);
            this.scene.add(obj);
            return true;
        }
        return false;
    }

    myTurn() {
        return this.gameView.turn == this.myId;
    }

    canDrag() {
        return !this.gameView.ended && this.myTurn() && !this.gameView.players[this.myId].discarded;
    }

    hoverClickDragDrop(t) {
        const intersects = [];
        const myView = this.players[this.myId];
        const pointerPos = new THREE.Vector2(rawInput.pointer.pos.x, rawInput.pointer.pos.y);
        let zooming = false;
        this.raycaster.setFromCamera(pointerPos, this.camera);
        this.statusHTML = null;
        this.hoverGlow.removeFromParent();
        this.ghostCard.removeFromParent();
        if (!this.dragging && !this.zoomed) {
            this.dragGlow.removeFromParent();
            let breakFlag = false;
            for (const { type, arr } of this.hoverArrs) {
                for (let i = 0; i < arr.length; ++i) {
                    const hover = arr[i];
                    if (hover == null) {
                        continue;
                    }
                    const obj = hover.obj;
                    intersects.length = 0;
                    this.raycaster.intersectObject(obj, true, intersects);
                    if (intersects.length > 0) {
                        breakFlag = true;
                        switch (type) {
                            case HOVER.HAND:
                                if (this.canDrag()) {
                                    this.startDrag(type, hover);
                                }
                                break;
                            case HOVER.DISCARD:
                                if (this.canDrag()) {
                                    this.startDrag(type, hover);
                                }
                                break;
                            case HOVER.STACK:
                                this.statusHTML = `${hover.size} card${hover.size == 1 ? '' : 's'} left`;
                                if (this.myTurn() && hover.mine) {
                                    if (this.canDrag()) {
                                        this.startDrag(type, hover);
                                    }
                                } else {
                                    obj.add(this.hoverGlow);
                                    //zooming = this.startZoom(type, hover);
                                }
                                break;
                            case HOVER.DISCPLACE:
                                this.statusHTML = 'click to zoom';
                                obj.add(this.hoverGlow);
                                zooming = this.startZoom(type, hover);
                                break;
                            case HOVER.PLAY:
                                this.ghostCard = this.ghostCards[hover.size]
                                obj.add(this.ghostCard);
                                break;
                        }
                        break;
                    }
                }
                if (breakFlag) {
                    break;
                }
            }
        }
        if (this.dragging) {
            /* get possible moves */
            const moves = {};
            switch(this.drag.type) {
                case DRAGDROP.HAND:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromHand(this.drag.fromIdx, idx));
                    moves[DRAGDROP.DISCARD] = Array.from(Array(NUM_DISCARD_PILES), (_,idx) => moveDiscard(this.drag.fromIdx, idx));
                    break;
                case DRAGDROP.DISCARD:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromDiscard(this.drag.fromIdx, idx))
                    break;
                case DRAGDROP.STACK:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromStack(idx))
                    break;
                default:
                    console.warn(`unknown dragdrop ${this.drag.type}`);
                    break;
            }

            if (rawInput.pointer.left) {
                intersects.length = 0;
                this.raycaster.intersectObject(this.cardPlane, false, intersects);
                if (intersects.length > 0) {
                    const { point } = intersects[0];
                    const pos = this.drag.obj.position;
                    const dir = new THREE.Vector3(point.x, point.y, this.cardPlane.position.z);
                    dir.sub(pos);
                    const dist = dir.length();
                    dir.multiplyScalar(0.3);
                    pos.add(dir);
                } else {
                    console.warn("raytrace didn't intersect cardplane!");
                }
                /* glow legal moves */
                /* TODO only when dragging starts and stops */
                const drops = [{ pileArr: this.playPiles, dropType: DRAGDROP.PLAY }];
                if (this.drag.type == DRAGDROP.HAND) {
                    drops.push({ pileArr: myView.discard, dropType: DRAGDROP.DISCARD });
                }
                for (const { pileArr, dropType } of drops) {
                    pileArr.forEach(({ glow, arr, place }, idx) => {
                        glow.removeFromParent();
                        if (isValidMove(this.gameView, moves[dropType][idx], this.myId)) {
                            if (arr.length == 0) {
                                place.add(glow);
                                glow.position.z = 0.001;
                            } else {
                                arr[arr.length-1].add(glow);
                                glow.position.z = -0.001;
                            }
                        }
                    });
                }
            } else {
                this.dragging = false;

                /* stop glow */
                this.playPiles.forEach(({ glow }) => { glow.removeFromParent(); });
                myView.discard.forEach(({ glow }) => { glow.removeFromParent(); });

                const dropArrs = [
                    {
                        type: DRAGDROP.PLAY,
                        arr: this.playPiles.map(({ arr, place }) => ({obj: arr.length > 0 ? arr[arr.length - 1] : place})),
                    }
                ];
                if (this.drag.type == DRAGDROP.HAND) {
                    dropArrs.push({
                        type: DRAGDROP.DISCARD,
                        arr: myView.discard.map(({ arr, place }) => ({obj: arr.length > 0 ? arr[arr.length - 1] : place})),
                    });
                }
                let dropType = DRAGDROP.NONE;
                let dropIdx = 0;
                for (const {type, arr} of dropArrs) {
                    for (let i = 0; i < arr.length; ++i) {
                        const {obj} = arr[i];
                        intersects.length = 0;
                        this.raycaster.intersectObject(obj, true, intersects);
                        if (intersects.length > 0) {
                            dropType = type;
                            dropIdx = i;
                            break;
                        }
                    }
                    if (dropType != DRAGDROP.NONE) {
                        break;
                    }
                }
                const move = dropType != DRAGDROP.NONE ? moves[dropType][dropIdx] : null;
                if (move !== null && this.doMoveLocally(move)) {
                    /* then send to server */
                    client.sendPacketMove(move);
                    const obj = this.drag.obj;
                    this.scene.remove(obj);
                } else {
                    const obj = this.drag.obj;
                    obj.position.copy(this.drag.fromPos);
                    obj.quaternion.copy(this.drag.fromQuat);
                    this.drag.fromParent.add(obj);
                }
            }
        } else if (this.zoomed && !zooming) {
            this.statusHTML = 'click to dismiss';
            this.endZoom();
        }
        this.updateMyTurnGlows();
    }

    animate (t) {
        if (!this.started) {
            console.error('GameScene not started!');
            return;
        }
        /* gating animation + game state update */
        let animDone = true;
        if (this.animQueue.length > 0) {
            const anim = this.animQueue[0];
            animDone = anim.fn(t, anim);
            if (animDone) {
                anim.doneFn(t, anim);
                this.animQueue.shift();
            }
        }
        if (animDone && this.updateQueue.length > 0) {
            this.updateQueue.shift()(); // call it
        }
        /* interaction */
        this.hoverClickDragDrop(t);

        this.leftLastFrame = rawInput.pointer.left;

        this.renderer.render(this.scene, this.camera);
    }

    getWinnerBannerPos() {
        const v = this.playPilesGroup.position;
        return worldPos3DToCanvasPos(v, this.camera, this.canvas);
    }

    resize() {
        resizeRenderer(this.camera, this.canvas, this.renderer);
        this.updateHTMLUI();
    }
}

function countObjChildrenRecursively(obj) {
    if (obj.children.length > 0) {
        return obj.children.reduce((acc, child) => acc + countObjChildrenRecursively(child), 0);
    } else {
        return 1; // leaf
    }
}
