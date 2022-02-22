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

function animateLerpSlerp(currT, anim) {
    const { animT, startT, obj, initPos, goalPos, initQuat, goalQuat } = anim;
    const t = (currT - startT) / animT;
    if (t < 1) {
        obj.position.lerpVectors(initPos, goalPos, t);
        obj.quaternion.slerpQuaternions(initQuat, goalQuat, t);
        return false;
    } else {
        obj.position.copy(goalPos);
        obj.quaternion.copy(goalQuat);
        return true;
    }
}

function animateCurveLerpSlerp(currT, anim) {
    const { obj, curve, initQuat, goalPos, goalQuat, animT, startT } = anim;
    const t = (currT - startT) / animT;
    if (t < 1) {
        curve.getPointAt(t, obj.position);
        obj.quaternion.slerpQuaternions(anim.initQuat, anim.goalQuat, t);
        return false;
    } else {
        obj.position.copy(goalPos);
        obj.quaternion.copy(goalQuat);
        return true;
    }
}

function animateCurveDivide(currT, anim) {
    const { obj, curve, initQuat, goalPos, goalQuat, animT, startT, animDivT, animDivInc, animDivFactor } = anim;
    const t = (currT - startT) / animT;
    if (t < 1) {
        curve.getPointAt(animDivT, obj.position);
        obj.quaternion.slerpQuaternions(anim.initQuat, anim.goalQuat, animDivT);
        anim.animDivT += animDivInc;
        anim.animDivInc *= animDivFactor;
        return false;
    } else {
        obj.position.copy(goalPos);
        obj.quaternion.copy(goalQuat);
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
        this.drag = null;
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
        this.drawPile = [];
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
                            stack: { count: 0, group: null, arr: [], top: null, glow: null },
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
        if (this.doMoveButton(move)) {
            client.sendPacketMove(move);
        }
    }

    undo() {
        /* the button would be disabled if undoableMoves.length was 0 */
        const move = moveUndo(this.gameView.undoableMoves[this.gameView.undoableMoves.length - 1]);
        if (this.doMoveButton(move)) {
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

    doMoveButton(move) {
        // NOTE this modifies this.history
        const newView = doMove(this.gameView, move, this.myId, this.history);
        if (newView === null) {
            return false;
        }
        this.updateQueue.push(() => {
            this.myTurnUpdate(newView, move, null);
            this.gameView = newView;
            this.updateHTMLUI();
            this.updateHoverArrs(); /* we have to do this because UNDO doesn't work properly with this rn */
        });
        return true;
    }

    /* dropped and maybe made a move */
    doDropCard(move, drag) {
        if (move !== null) {
            // NOTE this modifies this.history
            const newView = doMove(this.gameView, move, this.myId, this.history);
            if (newView !== null) {
                this.myTurnUpdate(newView, move, drag);
                this.gameView = newView;
                this.updateHTMLUI();
                return true;
            }
        }
        /* ret is false if move is null, or the move is illegal */
        this.animQueue.push(
            this.animDropReturn(drag)
        );
        return false;
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
                    obj.position.x = - myHandWidth_2 + idx * 1.5;
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
        stack.arr = [];
        for (let i = 0; i < length; ++i) {
            const obj = obj3Ds.cardStack.clone();
            obj.position.z = i * CARD_STACK_DIST;
            stack.group.add(obj);
            stack.arr.push(obj);
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
        this.drawPile.length = [];
        for (let i = 0; i < length; ++i) {
            const obj = obj3Ds.cardStack.clone();
            obj.position.z = i * CARD_STACK_DIST;
            this.drawPileCardGroup.add(obj);
            this.drawPile.push(obj);
        }
    }

    /* Get world position/quat of next card in play pile... i.e. where we will drop it */
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

    /* Get world position/quat of next card in discard pile.. i.e. where we will drop it, assuming we show DISCARD_SHOW_TOP cards */
    getNextDiscardPileCardPositionAndQuaternion(discardPile) {
        const o = new THREE.Object3D();
        discardPile.group.add(o);
        const arrLen = discardPile.arr.length;
        const topCardsIdx = arrLen > DISCARD_SHOW_TOP ? arrLen - DISCARD_SHOW_TOP : 0;
        const cutIdx = arrLen - topCardsIdx; // index in range [0, DISCARD_SHOW_TOP]
        o.rotation.x = Math.PI/64; // tilt up slightly
        o.position.set(0,
            /* stagger in y axis so you can see DISCARD_SHOW_TOP cards */
            -CARD_SPREAD_DIST_Y * cutIdx,
            /* bit of extra spacing because they're tilted up */
            CARD_STACK_DIST * arrLen + 0.09);
        const v = new THREE.Vector3();
        const q = new THREE.Quaternion();
        o.getWorldPosition(v);
        o.getWorldQuaternion(q);
        o.removeFromParent();
        return [v, q];
    }

    /* Get local position/quat of a given index in discard pile, given we want to only show DISCARD_SHOW_TOP cards */
    getDiscardPositionAndQuaternionFromIdx(discardPile, idx) {
        const arrLen = discardPile.arr.length;
        const topCardsIdx = arrLen > DISCARD_SHOW_TOP ? arrLen - DISCARD_SHOW_TOP : 0;
        const goalPos = new THREE.Vector3(0, 0, CARD_STACK_DIST * idx + 0.09);
        const goalQuat = new THREE.Quaternion();
        if (idx >= topCardsIdx) {
            goalPos.setY(-CARD_SPREAD_DIST_Y * (idx - topCardsIdx));
            goalQuat.setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/64);
        }
        return [goalPos, goalQuat];
    }

    _updateFromServer(gameView, move) {
        /*
         * This is a tad tricky...
         * If I click end turn:
         *  We do a local update, as a result this.gameView.turn != this.myId
         *  We get a server update with gameView.turn != this.myId
         * If someone else clicks end turn (and it goes to someone else's turn):
         *  We get a server update with gameView.turn != this.myId
         * If someone else clicks end turn (and it goes to our turn):
         *  We get a server update with gameView.turn == this.myId
         */
        /* Something I didn't do; it's not my turn now! */
        if (gameView.turn !== this.myId) {
            /* Check history, because if I ended the turn locally, this.gameView.turn !== this.myId anymore */
            const wasMyTurn = this.history.length > 0 ? this.history[this.history.length - 1].turn == this.myId : false;
            /* This is when I clicked the end turn button, and it's no longer my turn; we already did the update locally */
            if (wasMyTurn && move.type == MOVES.END_TURN) {
                console.debug(`Player ${this.myId} - reject end turn packet; already updated locally because I pushed the button`);
                return;
            }
            console.debug(`Player ${this.myId} - not my turn; update from server`);
            this.notMyTurnUpdate(gameView, move);
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
                    const oldDrawPileLength = this.gameView.drawPile.length;
                    /* update historic gameViews */
                    for (const state of statesToUpdate) {
                        const player = state.players[this.myId];
                        player.hand = JSON.parse(JSON.stringify(gameView.players[this.myId].hand));
                        state.drawPile.length = gameView.drawPile.length;
                    }
                    /* update objects */
                    this.animQueue.push(
                        this.animMyHandFill(newPlayer.hand)
                    );

                    if (gameView.playPiles[move.playIdx].length == 0) {
                        this.animQueue.push(
                            this.animShufflePlayPile(move.playIdx)
                        );
                    }
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
                this.animQueue.push(
                    this.animFlipStack(this.myId, newPlayer.stackTop)
                );
                console.debug(`Player ${this.myId} flip stack top from server`);
                break;
            }
            case MOVES.END_TURN:
                /* it's now my turn! fill my hand */
                const oldHand = this.gameView.players[this.myId].hand;
                const newHand = gameView.players[this.myId].hand;
                this.animQueue.push(
                    this.animMyHandUpdate(),
                    this.animMyHandFill(newHand.slice(oldHand.length))
                );
                this.history.push(this.gameView);
                this.gameView = gameView;
                /* these depend on updated this.gameView */
                this.updateHTMLUI();
                this.updateHoverArrs(); 
                break
            default:
                console.debug(`Player ${this.myId} didn't do anything with server update`);
                break;
        }
    }

    /* only call this on my turn */
    /* NOTE critical that this.gameView hasn't been updated yet. transforms scene from this.gameView -> gameView */
    /* TODO is this.history needed here? (I think so because of undo) */
    myTurnUpdate(gameView, move, drag) {
        switch (move.type) {
            case MOVES.PLAY_FROM_HAND:
            {
                /*
                 * hand to play pile
                 * hand update
                 * [NOT DONE HERE - server update] if hand empty, fill hand
                 * if pile full, shuffle pile into deck
                 */
                this.animQueue.push(
                    this.animDropToPlayPile(drag.obj, move.playIdx),
                    this.animMyHandUpdate()
                );
                /* if player has no cards left in hand, we want to fill hand BEFORE shuffling the pile in, so we don't do it here*/
                if (gameView.players[gameView.turn].hand.length > 0 && /* this is a local update, so it will be 0 if hand is empty */
                    gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.PLAY_FROM_DISCARD:
            {
                /*
                 * discard to play pileCheckPlayPileFull
                 * discard update
                 * if pile full, shuffle pile into deck
                 */
                this.animQueue.push(
                    this.animDropToPlayPile(drag.obj, move.playIdx),
                    this.animDiscardUpdate(gameView.turn, move.discardIdx),
                );
                if (gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.PLAY_FROM_STACK:
            {
                /*
                 * stack to play pile
                 * [NOT DONE HERE - server update] flip stack
                 * if pile full, shuffle pile into deck
                 */
                this.animQueue.push(
                    this.animDropToPlayPile(drag.obj, move.playIdx),
                );
                if (gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.DISCARD:
            {

                /*
                 * hand to discard
                 * discard update 
                 * hand update
                 */
                this.animQueue.push(
                    this.animDropToDiscard(drag.obj, move.discardIdx),
                    this.animDiscardUpdate(gameView.turn, move.discardIdx),
                    this.animMyHandUpdate()
                );
                break;
            }
            case MOVES.UNDO:
            {
                this.fullUpdateFromGameView(gameView);
                /* TODO this doesn't work because discarded flag in this.gameView may be true...but we're undoing that */
                //this.updateHoverArrs(); 
                switch (move.move.type) {
                    case MOVES.PLAY_FROM_HAND:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * hand update
                         * play pile to hand
                         */
                        break;
                    }
                    case MOVES.PLAY_FROM_DISCARD:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * play pile to discard
                         * discard update
                         */
                        break;
                    }
                    case MOVES.PLAY_FROM_STACK:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * play pile to stack
                         */
                        break;
                    }
                    case MOVES.DISCARD:
                    {
                        /*
                         * hand update
                         * discard to hand
                         * discard update
                         */
                        break;
                    }
                }
                break;
            }
            case MOVES.END_TURN:
            {
                /*
                 * We pushed the end turn button, so fill next player's hand
                 * (Also check it's not still our turn, in case of 1 player game)
                 */
                if (this.gameView.turn === this.myId && gameView.turn !== this.myId) {
                    this.animQueue.push(
                        this.animNotMyHandUpdate(),
                        this.animNotMyHandFill(gameView.turn)
                    );
                }
                break;
            }
        }
    }

    /* only call this on not my turn */
    /* NOTE critical that this.gameView hasn't been updated yet. transforms scene from this.gameView -> gameView */
    /* TODO is this.history needed here? (I think so because of undo) */
    notMyTurnUpdate(gameView, move) {

        switch (move.type) {
            case MOVES.PLAY_FROM_HAND:
            {
                /*
                 * hand to play pile
                 * hand update
                 * if hand empty, fill hand
                 * if pile full, shuffle pile into deck
                 */
                const card = gameView.lastCardPlayed;
                this.animQueue.push(
                    this.animNotMyHandToPlayPile(card, move.handIdx, move.playIdx, false),
                    this.animNotMyHandUpdate()
                );
                if (gameView.players[gameView.turn].hand.length == gameView.handSize) {
                    this.animQueue.push(
                        this.animNotMyHandFill(gameView.turn)
                    );
                }
                if (gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.PLAY_FROM_DISCARD:
            {
                /*
                 * discard to play pileCheckPlayPileFull
                 * discard update
                 * if pile full, shuffle pile into deck
                 */
                this.animQueue.push(
                    this.animDiscardToPlayPile(move.discardIdx, move.playIdx, false),
                    this.animDiscardUpdate(gameView.turn, move.discardIdx)
                );
                if (gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.PLAY_FROM_STACK:
            {
                /*
                 * stack to play pile
                 * flip stack
                 * if pile full, shuffle pile into deck
                 */
                const player = gameView.players[gameView.turn];
                this.animQueue.push(
                    this.animStackToPlayPile(move.playIdx, false),
                    this.animFlipStack(gameView.turn, player.stackTop)
                );
                if (gameView.playPiles[move.playIdx].length == 0) {
                    this.animQueue.push(
                        this.animShufflePlayPile(move.playIdx)
                    );
                }
                break;
            }
            case MOVES.DISCARD:
            {

                /*
                 * hand to discard
                 * discard update
                 * hand update
                 */
                const card = gameView.lastCardPlayed;
                this.animQueue.push(
                    this.animNotMyHandToDiscard(card, move.handIdx, move.discardIdx, false),
                    this.animDiscardUpdate(gameView.turn, move.discardIdx),
                    this.animNotMyHandUpdate()
                );
                break;
            }
            case MOVES.UNDO:
            {
                this.fullUpdateFromGameView(gameView);
                /* TODO this doesn't work because discarded flag in this.gameView may be true...but we're undoing that */
                //this.updateHoverArrs(); 
                switch (move.move.type) {
                    case MOVES.PLAY_FROM_HAND:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * hand update
                         * play pile to hand
                         */
                        break;
                    }
                    case MOVES.PLAY_FROM_DISCARD:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * play pile to discard
                         * discard update
                         */
                        break;
                    }
                    case MOVES.PLAY_FROM_STACK:
                    {
                        /*
                         * if pile was full, unshuffle pile from deck
                         * play pile to stack
                         */
                        break;
                    }
                    case MOVES.DISCARD:
                    {
                        /*
                         * hand update
                         * discard to hand
                         * discard update
                         */
                        break;
                    }
                }
                break;
            }
            case MOVES.END_TURN:
            {
                /*
                 * This is only for when someone else pressed end turn, and it's still another player's turn
                 * If I pushed end turn, we DON'T end up here - we fill next player's hand in myTurnUpdate
                 * If it's now my turn, we DON'T end up here - we fill my hand in _updateFromServer()
                 */
                this.animQueue.push(
                    this.animNotMyHandUpdate(),
                    this.animNotMyHandFill(gameView.turn)
                );
                break;
            }
        }
    }

    makeMoveAnim() {
        return {
            /* the animation 'api' - startFn, fn, doneFn, done, started */
            startFn: (currT, anim) => {
                anim.startT = currT;
                const midControlPoint = anim.goalPos.clone().add(new THREE.Vector3(0,0,5));
                anim.curve = new THREE.QuadraticBezierCurve3(
                    anim.initPos,
                    midControlPoint,
                    anim.goalPos,
                );
                this.scene.add(anim.obj);
                /* debug visualization */
                if (testing) {
                    anim.curveObj = makeCurveObj(anim.curve, 0xff0000, 10);
                    this.scene.add(anim.curveObj);
                }
                anim.animT = 500;
            },
            fn: animateCurveLerpSlerp,
            doneFn: (currT, anim) => {
                if (anim.curveObj !== null) {
                    anim.curveObj.removeFromParent();
                }
            },
            done: false,
            started: false,
            /* rest of fields depend on the animation functions */
            initPos: new THREE.Vector3(),
            initQuat: new THREE.Quaternion(),
            goalPos: new THREE.Vector3(),
            goalQuat: new THREE.Quaternion(),
            curve: null,
            curveObj: null,
            animT: 0, /* time in milliseconds */
            startT: 0 /* set when we start playing the animation */
        };
    }

    animNotMyHandToPlayPile(card, handIdx, playIdx, reverse) {
        const { hand } = this.players[this.gameView.turn];
        const playPile = this.playPiles[playIdx];
        const anim = this.makeMoveAnim();
        const obj = cardToCardObj(card);
        anim.obj = obj;
        /* wait until anim starts before actually changing stuff */
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            const obj = anim.obj;
            /* there's a blank card we need to replace with obj, which has the card face */
            const blankObj = hand.objArr[handIdx];
            blankObj.parent.add(obj);
            obj.position.copy(blankObj.position);
            obj.rotation.copy(blankObj.rotation);
            /* for this and discard, need the card to face inward, not outward */
            obj.rotateY(Math.PI);
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
            hand.objArr.splice(handIdx, 1);
            blankObj.removeFromParent();
            defaultStartFn(t, anim);
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            this.playPilesCardGroup.attach(anim.obj);
            playPile.arr.push(anim.obj);
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animDiscardToPlayPile(discardIdx, playIdx, reverse) {
        const { discard } = this.players[this.gameView.turn];
        const discardArr = discard[discardIdx].arr;
        const playPile = this.playPiles[playIdx];
        const anim = this.makeMoveAnim();
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            const obj = discardArr.pop();//[discardArr.length - 1];
            anim.obj = obj;
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            obj.removeFromParent(); /* hide it until it is time to start the animation */
            [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
            defaultStartFn(t, anim);
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            this.playPilesCardGroup.attach(anim.obj);
            playPile.arr.push(anim.obj);
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animStackToPlayPile(playIdx, reverse) {
        const { stack } = this.players[this.gameView.turn];
        const playPile = this.playPiles[playIdx];
        const anim = this.makeMoveAnim();
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            const obj = stack.top;
            stack.top = null;
            anim.obj = obj;
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            obj.removeFromParent(); /* hide it until it is time to start the animation */
            [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
            defaultStartFn(t, anim);
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            this.playPilesCardGroup.attach(anim.obj);
            playPile.arr.push(anim.obj);
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animNotMyHandToDiscard(card, handIdx, discardIdx, reverse) {
        const { hand, discard } = this.players[this.gameView.turn];
        const discardPile = discard[discardIdx];
        const obj = cardToCardObj(card);
        const anim = this.makeMoveAnim();
        anim.obj = obj;
        /* wait until anim starts before actually changing stuff */
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            /* there's a blank card we need to replace with obj, which has the card face */
            const obj = anim.obj;
            const blankObj = hand.objArr[handIdx];
            blankObj.parent.add(obj);
            obj.position.copy(blankObj.position);
            obj.rotation.copy(blankObj.rotation);
            /* blank card was facing forward, real card has to face back */
            obj.rotateY(Math.PI);
            /* also spin it upside down so it's the right way around wrt the play piles */
            obj.rotateZ(Math.PI);
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            obj.removeFromParent(); /* hide it until it is time to start the animation */
            [anim.goalPos, anim.goalQuat] = this.getNextDiscardPileCardPositionAndQuaternion(discardPile);
            hand.objArr.splice(handIdx, 1);
            blankObj.removeFromParent();
            defaultStartFn(t, anim);
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            discardPile.group.attach(anim.obj);
            discardPile.arr.push(anim.obj);
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    makeDropAnim() {
        return {
            /* the animation 'api' - startFn, fn, doneFn, done, started */
            startFn: (currT, anim) => {
                anim.startT = currT;
                anim.curve = new THREE.LineCurve3(
                    anim.initPos,
                    anim.goalPos,
                );
                this.scene.add(anim.obj);
                /* debug visualization */
                if (testing) {
                    anim.curveObj = makeCurveObj(anim.curve, 0xff0000, 10);
                    this.scene.add(anim.curveObj);
                }
                anim.animT = 200;
            },
            fn: animateCurveDivide,
            doneFn: (currT, anim) => {
                if (anim.curveObj !== null) {
                    anim.curveObj.removeFromParent();
                }
            },
            done: false,
            started: false,
            /* rest of fields depend on the animation functions */
            initPos: new THREE.Vector3(),
            initQuat: new THREE.Quaternion(),
            goalPos: new THREE.Vector3(),
            goalQuat: new THREE.Quaternion(),
            curve: null,
            curveObj: null,
            animT: 0, /* time in milliseconds - set in startFn */
            startT: 0, /* set when we start playing the animation */
            animDivT: 0,
            animDivInc: 0.5,
            animDivFactor: 0.5,
        };
    }

    animDropReturn(drag) {
        const anim = this.makeDropAnim();
        const obj = drag.obj;
        obj.getWorldPosition(anim.initPos);
        obj.getWorldQuaternion(anim.initQuat);
        anim.goalPos.copy(drag.fromWorldPos);
        anim.goalQuat.copy(drag.fromWorldQuat);
        anim.obj = obj;
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            drag.putBack(drag);
            this.updateHoverArrs();
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animDropToDiscard(obj, discardIdx) {
        const discardPile = this.players[this.myId].discard[discardIdx];
        const anim = this.makeDropAnim();
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            anim.obj = obj;
            [anim.goalPos, anim.goalQuat] = this.getNextDiscardPileCardPositionAndQuaternion(discardPile);
            defaultStartFn(t, anim);
            anim.animT = 100;
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            discardPile.group.attach(obj);
            discardPile.arr.push(obj);
            this.updateHoverArrs();
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animDropToPlayPile(obj, playIdx) {
        const playPile = this.playPiles[playIdx];
        const anim = this.makeDropAnim();
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            anim.obj = obj;
            [anim.goalPos, anim.goalQuat] = this.getNextPlayPileCardPositionAndQuaternion(playPile);
            defaultStartFn(t, anim);
            anim.animT = 100;
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            this.playPilesCardGroup.attach(obj);
            playPile.arr.push(obj);
            this.updateHoverArrs();
            defaultDoneFn(t, anim);
        };
        return anim;
    }

    animDiscardUpdate(playerId, discardIdx) {
        const discardPile = this.players[playerId].discard[discardIdx];
        return {
            startFn: (currT, anim) => {
                anim.startT = currT;
                anim.curve = new THREE.LineCurve3(
                    anim.initPos,
                    anim.goalPos,
                );
                anim.animT = 200;
                discardPile.arr.forEach((_, idx) => {
                    const [goalPos, goalQuat] = this.getDiscardPositionAndQuaternionFromIdx(discardPile, idx);
                    anim.goalPoses.push(goalPos);
                    anim.goalQuats.push(goalQuat);
                });
            },
            fn: (currT, anim) => {
                const t = (currT - anim.startT) / anim.animT;
                if (t < 1) {
                    discardPile.arr.forEach((obj, idx) => {
                        obj.position.lerp(anim.goalPoses[idx], 0.3);
                        obj.quaternion.slerp(anim.goalQuats[idx], 0.3);
                    });
                    return false;
                } else {
                    discardPile.arr.forEach((obj, idx) => {
                        obj.position.copy(anim.goalPoses[idx]);
                        obj.quaternion.copy(anim.goalQuats[idx]);
                    });
                    return true;
                }
            },
            doneFn: (currT, anim) => {},
            done: false,
            started: false,
            /* */
            goalPoses: [],
            goalQuats: [],
            animT: 0, /* time in milliseconds - set in startFn */
            startT: 0, /* set when we start playing the animation */
        };
    }

    /*
     * If hand objects have been modified or exhausted (hand emptied), fix it
     * finalLength == handObjArr.length, unless we're prepping to put a new card in
     */
    animHandUpdate(handObjArr, finalLength, reverse) {
        const anim = {
            /* the animation 'api' - startFn, fn, doneFn, done, started */
            startFn: (currT, anim) => {
                const handWidth_2 = ((anim.finalLength-1) * 1.5)/2;
                anim.startT = currT;
                anim.curve = new THREE.LineCurve3(
                    anim.initPos,
                    anim.goalPos,
                );
                anim.animT = 200;
                const goalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/32);
                let idx = 0;
                for (const obj of handObjArr) {
                    const x = reverse ? (handWidth_2 - idx * 1.5) : (-handWidth_2 + idx * 1.5);
                    const goalPos = new THREE.Vector3(x, 0, 0);
                    anim.goalPoses.push(goalPos);
                    anim.goalQuats.push(goalQuat);
                    idx++;
                };
            },
            fn: (currT, anim) => {
                const t = (currT - anim.startT) / anim.animT;
                if (t < 1) {
                    handObjArr.forEach((obj, idx) => {
                        obj.position.lerp(anim.goalPoses[idx], 0.3);
                        obj.quaternion.slerp(anim.goalQuats[idx], 0.3);
                    });
                    return false;
                } else {
                    handObjArr.forEach((obj, idx) => {
                        obj.position.copy(anim.goalPoses[idx]);
                        obj.quaternion.copy(anim.goalQuats[idx]);
                    });
                    return true;
                }
            },
            doneFn: (currT, anim) => {},
            done: false,
            started: false,
            /* rest of fields depend on the animation functions */
            finalLength,
            goalPoses: [],
            goalQuats: [],
            animT: 0, /* time in milliseconds - set in startFn */
            startT: 0, /* set when we start playing the animation */
        };
        return anim;
    }

    animNotMyHandUpdate() {
        const { hand } = this.players[this.gameView.turn];
        return this.animHandUpdate(hand.objArr, hand.objArr.length, true);
    }

    animMyHandUpdate() {
        return this.animHandUpdate(this.myHand, this.myHand.length, false);
    }

    animNone() {
        return {
            startFn: (t, anim) => {},
            fn: (t, anim) => { return true; },
            doneFn: (t, anim) => {},
            done: false,
            started: false,
        };
    }

    animHandFill(handObjArr, handGroup, cards /* null if not my hand */) {
        const handSize = this.gameView.handSize;
        const isMyHand = cards !== null;
        return {
            startFn: (t, anim) => {
                let startLength = handObjArr.length;
                let cardsLeft = handSize - startLength;
                /*
                 * TODO maybe unjankify this case
                 * This happens if we start dragging before animHandFill starts
                 */
                if (isMyHand && cards.length !== cardsLeft) {
                    //console.error("cardsLeft !== cards.length!");
                    cardsLeft = cards.length;
                    startLength += (this.dragging ? 1 : 0);
                }
                /* only do hand update if there are cards...otherwise there is a needless delay */
                if (handObjArr.length > 0) {
                    const handUpdateAnim = this.animHandUpdate(handObjArr, handSize, !isMyHand);
                    anim.animQueue.push(handUpdateAnim);
                }
                for (let i = 0; i < cardsLeft; ++i) {
                    const drawAnim = {
                        startFn: (t, anim) => {
                            const handWidth_2 = ((handSize - 1) * 1.5)/2;
                            const obj = this.drawPile.pop();
                            obj.getWorldPosition(anim.initPos);
                            if (isMyHand) {
                                // card has to be upside down
                                obj.rotateY(Math.PI);
                            }
                            obj.getWorldQuaternion(anim.initQuat);
                            handGroup.add(obj);
                            const x = isMyHand ? (-handWidth_2 + (i + startLength) * 1.5) : (handWidth_2 - (i + startLength) * 1.5 );
                            obj.position.set(x, 0, 0);
                            obj.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/32);
                            obj.getWorldPosition(anim.goalPos);
                            obj.getWorldQuaternion(anim.goalQuat);
                            if (isMyHand) {
                                obj.removeFromParent();
                                anim.obj = cardToCardObj(cards[i]);
                            } else {
                                anim.obj = obj;
                            }
                            anim.obj.position.copy(anim.initPos);
                            anim.obj.quaternion.copy(anim.initQuat);
                            this.scene.add(anim.obj);
                            let midControlPoint = null;
                            if (isMyHand) {
                                midControlPoint = anim.goalPos.clone().add(new THREE.Vector3(3,0,-1));
                            } else {
                                midControlPoint = anim.goalPos.clone().add(new THREE.Vector3(0,0,5));
                            }
                            anim.curve = new THREE.QuadraticBezierCurve3(
                                anim.initPos,
                                midControlPoint,
                                anim.goalPos,
                            );
                            anim.startT = t;
                            anim.animT = 400; /* i think this works better as a static value */
                            /* debug visualization */
                            if (testing) {
                                anim.curveObj = makeCurveObj(anim.curve, 0xff0000, 10);
                                this.scene.add(anim.curveObj);
                            }
                        },
                        fn: animateCurveLerpSlerp,
                        doneFn: (t, anim) => {
                            handGroup.attach(anim.obj);
                            handObjArr.push(anim.obj);
                            if (anim.curveObj !== null) {
                                anim.curveObj.removeFromParent();
                            }
                            /*
                             * NOTE this is super fragile if other logic in here is changed (possibly drag logic too)
                             * But, you can play cards as they're dealt, or before they're dealt!
                             */
                            if (isMyHand) {
                                this.updateHoverArrs();
                            }
                        },
                        done: false,
                        started: false,
                        initPos: new THREE.Vector3(),
                        initQuat: new THREE.Quaternion(),
                        goalPos: new THREE.Vector3(),
                        goalQuat: new THREE.Quaternion(),
                        curve: null,
                        curveObj: null,
                        animT: 0, /* time in milliseconds - set in startFn */
                        startT: 0, /* set when we start playing the animation */
                    };
                    anim.animQueue.push(drawAnim);
                }
            },
            fn: (t, anim) => {
                /* anims within anims */
                if (anim.animQueue.length > 0) {
                    const subAnim = anim.animQueue[0];
                    if (!subAnim.started) {
                        subAnim.startFn(t, subAnim);
                        subAnim.started = true;
                    }
                    if (subAnim.fn(t, subAnim)) {
                        subAnim.doneFn(t, subAnim);
                        anim.animQueue.shift();
                    }
                }
                if (anim.animQueue.length == 0) {
                    return true;
                }
                return false;
            },
            doneFn: (t, anim) => {
            },
            done: false,
            started: false,
            /* */
            animQueue: [],
        };
    }

    animNotMyHandFill(playerId) {
        const { hand } = this.players[playerId];
        return this.animHandFill(hand.objArr, hand.group, null);
    }

    animMyHandFill(newCards) {
        return this.animHandFill(this.myHand, this.myHandGroup, newCards);
    }

    animShufflePlayPile(playIdx) {
        const playPile = this.playPiles[playIdx];
        return {
            startFn: (t, anim) => {
                const movePileAnim = {
                    startFn: (t, anim) => {
                        const group = new THREE.Group();
                        const vFirst = new THREE.Vector3();
                        const vLast = new THREE.Vector3();
                        playPile.arr[0].getWorldPosition(vFirst);
                        playPile.arr[playPile.arr.length - 1].getWorldPosition(vLast);
                        this.scene.add(group);
                        group.position.lerpVectors(vFirst, vLast, 0.5);
                        for (const obj of playPile.arr) {
                            group.attach(obj);
                        }
                        anim.obj = group;
                        anim.initQuat = new THREE.Quaternion();
                        anim.goalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI);
                        anim.initPos = group.position.clone();
                        anim.goalPos = this.drawPileCardGroup.position.clone().add(new THREE.Vector3(-5.5, 3, 7));
                        anim.animT = 700;
                        anim.startT = t;
                    },
                    fn: animateLerpSlerp,
                    doneFn: (t, anim) => {
                        for (const obj of playPile.arr) {
                            this.scene.attach(obj);
                        }
                        anim.obj.removeFromParent();
                    },
                    done: false,
                    started: false,
                };
                anim.animArrayQueue.push([movePileAnim]);
                const moveCardAnims = [];
                playPile.arr.forEach((obj, idx) => {
                    moveCardAnims.push({
                        startFn: (t, anim) => {
                            const bottomCardPos = new THREE.Vector3();
                            const topCardPos = new THREE.Vector3();
                            this.drawPile[0].getWorldPosition(bottomCardPos);
                            this.drawPile[this.drawPile.length - 1].getWorldPosition(topCardPos);
                            anim.obj = obj;
                            anim.initPos = new THREE.Vector3();
                            anim.goalPos = new THREE.Vector3()
                            anim.initQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI);
                            anim.goalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI);
                            obj.getWorldPosition(anim.initPos);
                            anim.goalPos.lerpVectors(bottomCardPos, topCardPos, Math.random());
                            anim.animT = 300;
                            anim.startT = t + idx * 150;
                        },
                        fn: (t, anim) => {
                            if (t >= anim.startT) {
                                return animateLerpSlerp(t, anim);
                            }
                            return false;
                        },
                        doneFn: (t, anim) => {
                            anim.obj.removeFromParent();
                            this.updateDrawPile(this.drawPile.length + 1);
                        },
                        done: false,
                        started: false,
                    });
                });
                anim.animArrayQueue.push(moveCardAnims);
            },
            fn: (t, anim) => {
                /* anims within anims...and in parallel? */
                if (anim.animArrayQueue.length > 0) {
                    const subAnimArray = anim.animArrayQueue[0];
                    let numDone = 0;
                    for (const subAnim of subAnimArray) {
                        if (!subAnim.started) {
                            subAnim.startFn(t, subAnim);
                            subAnim.started = true;
                        }
                        if (subAnim.done) {
                            numDone++;
                        } else if (subAnim.fn(t, subAnim)) {
                            subAnim.doneFn(t, subAnim);
                            subAnim.done = true;
                            numDone++;
                        }
                    }
                    if (numDone == subAnimArray.length) {
                        anim.animArrayQueue.shift();
                    }
                }
                if (anim.animArrayQueue.length == 0) {
                    return true;
                }
                return false;
            },
            doneFn: (t, anim) => {
                playPile.arr = [];
            },
            done: false,
            started: false,
            /* */
            animArrayQueue: [],
        };
    }

    animFlipStack(playerId, newStackTop) {
        const player = this.players[playerId];
        if (player.stack.arr.length === 0) {
            return this.animNone();
        }
        const anim = this.makeMoveAnim();
        const defaultStartFn = anim.startFn;
        anim.startFn = (t, anim) => {
            const obj = cardToCardObj(newStackTop);
            const blankObj = player.stack.arr.pop();
            blankObj.parent.add(obj);
            obj.position.copy(blankObj.position);
            obj.rotation.copy(blankObj.rotation);
            /* for this and discard, need the card to face down */
            obj.rotateY(Math.PI);
            obj.getWorldPosition(anim.initPos);
            obj.getWorldQuaternion(anim.initQuat);
            blankObj.getWorldPosition(anim.goalPos);
            blankObj.getWorldQuaternion(anim.goalQuat);
            anim.obj = obj;
            blankObj.removeFromParent();
            defaultStartFn(t, anim);
            anim.animT = 400;
        };
        const defaultDoneFn = anim.doneFn;
        anim.doneFn = (t, anim) => {
            player.stack.group.attach(anim.obj);
            player.stack.top = anim.obj;
            this.updateHoverArrs();
            defaultDoneFn(t, anim);
        };
        return anim;
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
                discardPile.arr = discard[pileIdx].map(card => cardToCardObj(card));
                discardPile.arr.forEach(
                    (obj, idx) => {
                        const [v, q] = this.getDiscardPositionAndQuaternionFromIdx(discardPile, idx);
                        obj.position.copy(v);
                        obj.quaternion.copy(q);
                        discardPile.group.add(obj);
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
            hoverArrs.push({ type: HOVER.HAND, arr: this.myHand.map((obj,idx) => ({obj, idx})).reverse() });
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
                arr.forEach((obj, idx) => {
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

    /* start dragging based on a hover obj, return the drag obj, or null if can't drag */
    startDrag(type, hover) {
        const obj = hover.obj;
        if (    this.canDrag() &&
                rawInput.pointer.left &&
                HOVER_TO_DRAG.hasOwnProperty(type) &&               // draggable object
                (type == HOVER.STACK ? hover.mine : true)           // its MY stack
                ) {
            obj.add(this.dragGlow);
            const drag = {
                obj,
                type: HOVER_TO_DRAG[type],
                fromParent: obj.parent,
                fromIdx: hover.idx,
                fromPos: obj.position.clone(),
                fromQuat: obj.quaternion.clone(),
                fromWorldPos: new THREE.Vector3(),
                fromWorldQuat: new THREE.Quaternion(),
                /* TODO fix this for dragging while hand filling case */
                putBack: (drag) => {
                    drag.fromParent.add(drag.obj);
                    drag.obj.position.copy(drag.fromPos);
                    drag.obj.quaternion.copy(drag.fromQuat);
                }
            };
            obj.getWorldPosition(drag.fromWorldPos);
            obj.getWorldQuaternion(drag.fromWorldQuat);
            this.scene.add(obj);
            obj.position.copy(drag.fromWorldPos);
            obj.quaternion.copy(drag.fromWorldQuat);
            /* remove from the relevant array, and set putBack function so it back be put back */
            const defaultPutBack = drag.putBack;
            switch(type) {
                case HOVER.HAND:
                    this.myHand.splice(hover.idx, 1);
                    drag.putBack = (drag) => {
                        this.myHand.splice(drag.fromIdx, 0, drag.obj);
                        defaultPutBack(drag);
                    }
                    break;
                case HOVER.DISCARD:
                    const discardPile = this.players[this.myId].discard[hover.idx];
                    discardPile.arr.pop();
                    drag.putBack = (drag) => {
                        discardPile.arr.push(drag.obj);
                        defaultPutBack(drag);
                    }
                    break;
                case HOVER.STACK:
                    this.players[this.myId].stack.top = null;
                    drag.putBack = (drag) => {
                        this.players[this.myId].stack.top = drag.obj;
                        defaultPutBack(drag);
                    }
                    break;
            }
            /* get possible moves */
            const moves = {};
            switch(drag.type) {
                case DRAGDROP.HAND:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromHand(drag.fromIdx, idx));
                    moves[DRAGDROP.DISCARD] = Array.from(Array(NUM_DISCARD_PILES), (_,idx) => moveDiscard(drag.fromIdx, idx));
                    break;
                case DRAGDROP.DISCARD:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromDiscard(drag.fromIdx, idx))
                    break;
                case DRAGDROP.STACK:
                    moves[DRAGDROP.PLAY] = Array.from(Array(NUM_PLAY_PILES), (_,idx) => movePlayFromStack(idx))
                    break;
                default:
                    console.warn(`unknown dragdrop ${drag.type}`);
                    break;
            }
            drag.moves = moves;
            return drag;
        }
        return null;
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
                    let drag = null;
                    intersects.length = 0;
                    this.raycaster.intersectObject(obj, true, intersects);
                    if (intersects.length > 0) {
                        breakFlag = true;
                        switch (type) {
                            case HOVER.HAND:
                                drag = this.startDrag(type, hover);
                                break;
                            case HOVER.DISCARD:
                                drag = this.startDrag(type, hover);
                                break;
                            case HOVER.STACK:
                                this.statusHTML = `${hover.size} card${hover.size == 1 ? '' : 's'} left`;
                                if (this.myTurn() && hover.mine) {
                                    drag = this.startDrag(type, hover);
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
                        if (drag !== null) {
                            this.drag = drag;
                            this.dragging = true;
                            /* update hover arrays so the dragged object can't be hovered on! */
                            this.updateHoverArrs();
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
                        if (isValidMove(this.gameView, this.drag.moves[dropType][idx], this.myId)) {
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
                const move = dropType != DRAGDROP.NONE ? this.drag.moves[dropType][dropIdx] : null;
                /* move can be null */
                if (this.doDropCard(move, this.drag)) {
                    client.sendPacketMove(move);
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
        if (this.animQueue.length > 0) {
            const anim = this.animQueue[0];
            if (!anim.started) {
                anim.startFn(t, anim);
                anim.started = true;
            }
            if (anim.fn(t, anim)) {
                anim.doneFn(t, anim);
                this.animQueue.shift();
            }
        }
        /* don't do any updates until anim queue is cleared */
        if (this.animQueue.length === 0 && this.updateQueue.length > 0) {
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
