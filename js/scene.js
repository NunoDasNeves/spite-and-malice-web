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

const PLAY_AND_DRAW_PILES_INC = 3;

const PLAY_AND_DRAW_PILES_WIDTH_2 = (PLAY_AND_DRAW_PILES_INC * 4 + CARD_PLACE_WIDTH)/2
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

    makeTransformRelativeTo(obj, relObj) {
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

    updateMyHandTransform() {
        this.myHandGroup.position.set(0,-9.3,-13);
        this.myHandGroup.quaternion.set(0,0,0,1);
        this.makeTransformRelativeTo(this.myHandGroup, this.camera);
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
        this.animSpeed = 0.04;
        this.animating = false;
        this.anim = {
            obj: null,
            goalObj: null,
            initPos: new THREE.Vector3(),
            initQuat: new THREE.Quaternion(),
            goalPos: new THREE.Vector3(),
            goalQuat: new THREE.Quaternion(),
            curve: null,
            curveObj: null,
            animT: 0,
            startT: -1,
        };
        this.gameViewQueue = [];
        this.leftLastFrame = rawInput.pointer.left;

        const {playerViews, myId} = gameView;
        this.myId = myId;

        /* stuff translated from gameView to */
        this.waitingForUpdate = false;
        this.gameView = {};
        this.playerViews = {};
        this.playPiles = Array.from(Array(4), () => ({ place: null, glow: null, arr: [] }));
        this.playPilesGroup = null;
        this.playPilesCardGroup = null;
        this.drawPileCount = 0;
        this.drawPileCardGroup = null;
        this.myHandGroup = null;
        this.turn = -1;
        this.myHand = [];
        this.ended = false;
        this.winner = -1;
        this.playerIds = [];
        /* sorted list of playerIds rotated with myId first, for drawing the playerViews */
        this.playerIds = Object.keys(playerViews)
                            .sort((a,b) => Number(a) - Number(b));
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
        this.myHandGroup = new THREE.Group();
        this.scene.add(this.myHandGroup);
        this.updateMyHandTransform();

        /* play piles */
        this.playPilesGroup = new THREE.Group();
        /* group just for the cards... */
        this.playPilesCardGroup = new THREE.Group();
        this.playPilesGroup.add(this.playPilesCardGroup);
        this.scene.add(this.playPilesGroup);
        const pileOffset = new THREE.Vector3(-6,0,0);
        for (let i = 0; i < 4; ++i) {
            const playCardPlace = obj3Ds.cardPlace.clone();
            playCardPlace.position.copy(pileOffset);
            this.playPiles[i].place = playCardPlace;
            this.playPilesGroup.add(playCardPlace);
            this.playPiles[i].glow = obj3Ds.cardGlow.yellow.clone();
            pileOffset.x += 3;
        }
        /* draw pile */
        this.drawPileCardGroup = new THREE.Group();
        this.drawPileCardGroup.position.copy(pileOffset);
        this.scene.add(this.drawPileCardGroup);

        /* views */
        const radInc = (1/this.numPlayers) * Math.PI * 2;
        let rotation = 0;

        for (let i = 0; i < this.numPlayers; ++i) {
            const { id } = playerViews[this.playerIds[i]];
            const { name, color, connected } = roomInfo.players[this.playerIds[i]];
            const view = {
                            group: null,
                            label: null,
                            labelCanvas: null,
                            connected,
                            name,
                            color,
                            id,
                            discard: Array.from(Array(4), ()=> ({ place: null, group: null, glow: null, arr: [] })),
                            stack: { count: 0, group: null, topCard: null, topObj: null, },
                            hand: { count: 0, group: null, objArr: [], },
                        };
            this.playerViews[id] = view;

            /* group for relative positioning of the playerView */
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

            /* stack */
            view.stack.group = new THREE.Group();
            view.stack.group.position.set(6,0.5,0);
            group.add(view.stack.group);

            /* discard */
            const discPileOffset = new THREE.Vector3(-6,-1,0);
            for (let j = 0; j < 4; ++j) {
                /* place for empty discard piles */
                const discCardPlace = obj3Ds.cardPlace.clone();
                view.discard[j].place = discCardPlace;
                discCardPlace.position.copy(discPileOffset);
                view.discard[j].glow = obj3Ds.cardGlow.yellow.clone();
                group.add(discCardPlace);
                /* card groups for each discard pile, for zooming and stuff */
                const discardGroup = new THREE.Group();
                discardGroup.position.copy(discPileOffset);
                view.discard[j].group = discardGroup;
                group.add(discardGroup);
                /* the actual pile */
                discPileOffset.x += 3;
            }
        }
        this.started = true;
        this.updateGameView(gameView);
        this.updateRoomInfo(roomInfo);
    }

    updateRoomInfo(roomInfo) {
        Object.values(this.playerViews).forEach((view) => {
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

    queueUpdateGameView(gameView, move) {
        this.waitingForUpdate = false;
        this.gameViewQueue.push([gameView, move]);
    }

    updateGameView(gameView, move) {
        if (!this.started) {
            console.error('GameScene not started!');
            return;
        }
        const {playerViews, playPiles, drawPileCount, turn, myHand, winner, ended, lastCardPlayed} = gameView;
        console.log(`player ${this.myId} updating - card: ${lastCardPlayed ? lastCardPlayed.value : ''}`);

        const prevTurn = this.turn;
        this.startInitMoveAnimation(move, prevTurn);

        this.gameView = gameView;
        this.turn = turn;
        this.winner = winner;
        this.ended = ended;

        /* my hand */
        this.myHandGroup.clear();
        const myHandWidth_2 = ((myHand.length-1) * 1.5)/2;
        this.myHand = myHand.map(card => ({card, obj: cardToCardObj(card)}));
        this.myHand.forEach(({card, obj}, idx) => {
                    /* go from right to left, so the list order has them in front to back sorted order for ray casting */
                    obj.position.x = myHandWidth_2 - idx * 1.5;
                    obj.rotation.y = Math.PI/32;
                    this.myHandGroup.add(obj);
                });

        /* play piles and draw pile */
        this.playPilesCardGroup.clear();
        this.playPiles.forEach((pile, pileIdx) => {
            pile.arr = playPiles[pileIdx].map(card => ({card, obj: cardToCardObj(card)}));
            const playPlace = pile.place;
            pile.arr.forEach(({obj}, idx) => {
                                    obj.position.addVectors(playPlace.position, new THREE.Vector3(0,0,0.01 + CARD_STACK_DIST * idx));
                                    this.playPilesCardGroup.add(obj);
                                });
        });

        /* draw pile */
        this.drawPileCardGroup.clear();
        for (let i = 0; i < drawPileCount; ++i) {
            const obj = obj3Ds.cardStack.clone();
            obj.position.z = i * CARD_STACK_DIST;
            this.drawPileCardGroup.add(obj);
        }

        /* map player view packet to GameScene playerview */
        Object.values(this.playerViews).forEach((view) => {
            if (!playerViews.hasOwnProperty(view.id)) {
                console.error(`missing player ${view.id} from view`);
                return;
            }
            const {handCount, stackTop, stackCount, discard} = playerViews[view.id];

            /* back of hand */
            if (view.id != this.myId) {
                view.hand.group.clear();
                view.hand.objArr.length = 0;
                view.hand.count = handCount;
                const handWidth_2 = ((handCount-1) * 1.5)/2;
                for (let i = 0; i < handCount; ++i) {
                    const obj = obj3Ds.cardStack.clone();
                    obj.position.x = handWidth_2 - i * 1.5;
                    obj.rotation.y = Math.PI/32;
                    view.hand.group.add(obj);
                    view.hand.objArr.push(obj);
                }
            }

            /* stack */
            view.stack.count = stackCount;
            view.stack.group.clear();
            for (let i = 1; i < stackCount; ++i) { /* one less than stackCount... the top card is the last card */
                const obj = obj3Ds.cardStack.clone();
                obj.position.z = i * CARD_STACK_DIST;
                view.stack.group.add(obj);
            }
            if (stackCount > 0) {
                view.stack.topCard = stackTop;
                const topObj = cardToCardObj(stackTop);
                view.stack.topObj = topObj;
                topObj.position.z = stackCount * CARD_STACK_DIST;
                view.stack.group.add(topObj);
            } else {
                view.stack.topObj = null;
                view.stack.topCard = null;
            }

            /* discard */
            view.discard.forEach((viewDiscard, pileIdx) => {
                viewDiscard.group.clear();
                viewDiscard.arr = discard[pileIdx].map(card => ({card, obj: cardToCardObj(card)}));
                const discCardPlace = viewDiscard.place;
                /* index to start showing the cards (fanning them along y axis) */
                const topCardsIdx = viewDiscard.arr.length > DISCARD_SHOW_TOP ? viewDiscard.arr.length - DISCARD_SHOW_TOP : 0;
                viewDiscard.arr.forEach(({obj}, idx) => {
                                        if (idx < topCardsIdx) {
                                            obj.position.set(0,0,0.01 + CARD_STACK_DIST*idx);
                                        } else {
                                            obj.rotation.x = Math.PI/64; // tilt up slightly
                                            const topIdx = idx - topCardsIdx;
                                            obj.position.set(0,
                                                             /* stagger in y axis so you can see DISCARD_SHOW_TOP cards */
                                                             -CARD_SPREAD_DIST_Y * topIdx,
                                                             /* bit of extra spacing because they're tilted up */
                                                             0.01 + CARD_STACK_DIST * topCardsIdx + 0.1);
                                        }
                                        viewDiscard.group.add(obj);
                                    });
            });
        });

        this.endInitMoveAnimation(move, prevTurn, lastCardPlayed);
    }
    /* state is already updated, use the move to determine what is animating and start animating it */
    startInitMoveAnimation(move, playerId) {
        if (playerId < 0 || playerId == this.myId) {
            return;
        }
        const { hand, discard, stack } = this.playerViews[playerId];
        let obj = null;
        let cobj = null;
        switch (move.type) {
            case MOVES.PLAY_FROM_HAND:
                obj = hand.objArr[move.handIdx];
                cobj = obj.clone();
                obj.parent.add(cobj);
                /* for this and discard, need the card to face inward, not outward */
                cobj.rotateY(Math.PI);
                break;
            case MOVES.PLAY_FROM_DISCARD:
                const discardArr = discard[move.discardIdx].arr;
                obj = discardArr[discardArr.length - 1].obj;
                cobj = obj.clone();
                obj.parent.add(cobj);
                /* this will make opposite players' cards not rotate as much */
                /* (may not look good in all cases...) */
                cobj.rotateZ(Math.PI);
                break;
            case MOVES.PLAY_FROM_STACK:
                obj = stack.topObj;
                cobj = obj.clone();
                obj.parent.add(cobj);
                cobj.rotateZ(Math.PI);
                break;
            case MOVES.DISCARD:
                obj = hand.objArr[move.handIdx];
                cobj = obj.clone();
                obj.parent.add(cobj);
                cobj.rotateY(Math.PI);
                cobj.rotateZ(Math.PI);
                break;
        }
        cobj.getWorldPosition(this.anim.initPos);
        cobj.getWorldQuaternion(this.anim.initQuat);
        cobj.removeFromParent();
    }

    endInitMoveAnimation(move, playerId, lastCardPlayed) {
        if (playerId < 0 || playerId == this.myId || !lastCardPlayed) {
            return;
        }
        const { hand, discard, stack } = this.playerViews[playerId];
        let obj = null;
        switch (move.type) {
            case MOVES.PLAY_FROM_HAND:
            case MOVES.PLAY_FROM_DISCARD:
            case MOVES.PLAY_FROM_STACK:
                const playPile = this.playPiles[move.playIdx];
                if (playPile.arr.length > 0) {
                    obj = playPile.arr[playPile.arr.length - 1].obj;
                    obj.getWorldPosition(this.anim.goalPos);
                    obj.getWorldQuaternion(this.anim.goalQuat);
                    this.anim.goalObj = obj;
                } else {
                    obj = new THREE.Object3D();
                    this.playPilesCardGroup.add(obj);
                    obj.position.addVectors(playPile.place.position, new THREE.Vector3(0,0,0.01 + CARD_STACK_DIST * PLAY_PILE_FULL_LENGTH));
                    obj.getWorldPosition(this.anim.goalPos);
                    obj.getWorldQuaternion(this.anim.goalQuat);
                    obj.removeFromParent();
                    this.anim.goalObj = null; // don't know what to do here yet
                }
                break;
            case MOVES.DISCARD:
                const discardArr = discard[move.discardIdx].arr;
                obj = discardArr[discardArr.length - 1].obj;
                obj.getWorldPosition(this.anim.goalPos);
                obj.getWorldQuaternion(this.anim.goalQuat);
                this.anim.goalObj = obj;
                break;
        }

        if (this.anim.goalObj) {
            this.anim.goalObj.visible = false;
        }
        this.anim.obj = cardToCardObj(lastCardPlayed);
        this.scene.add(this.anim.obj);
        this.anim.type = move.type;
        const midControlPoint = this.anim.goalPos.clone().add(new THREE.Vector3(0,0,5));
        this.anim.curve = new THREE.QuadraticBezierCurve3(
            this.anim.initPos,
            midControlPoint,
            this.anim.goalPos,
        );
        //this.anim.curveObj = makeCurveObj(this.anim.curve, 0xff0000, 10);
        //this.scene.add(this.anim.curveObj);
        this.anim.animT = 500; /* time in milliseconds */
        this.anim.startT = performance.now(); /* set when we start playing the animation */
        this.animating = true;

        this.continueAnimation(this.anim.startT);
    }

    continueAnimation(currT) {
        const { obj, goalObj, curveObj, curve, initQuat, goalQuat, animT, startT } = this.anim;
        const t = (currT - startT) / animT;
        if (t < 1) {
            curve.getPointAt(t, obj.position);
            obj.quaternion.slerpQuaternions(this.anim.initQuat, this.anim.goalQuat, t);
        } else {
            //curveObj.removeFromParent();
            obj.removeFromParent();
            this.animating = false;
            if (goalObj) {
                goalObj.visible = true;
            }
        }
    }

    startZoom(type, hover) {
        if (!this.leftLastFrame && rawInput.pointer.left) {
            this.zoomed = true;
            this.zoom.type = type;
            this.hoverGlow.removeFromParent(); // so we don't clone it
            if (type == HOVER.DISCPLACE) {
                const view = this.playerViews[hover.player];
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
            this.makeTransformRelativeTo(obj, this.camera);
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
        const myTurn = this.turn == this.myId;
        const canDrag = !this.ended && myTurn;
        const obj = hover.obj;
        if (
                rawInput.pointer.left &&
                canDrag &&                                          // on my turn
                HOVER_TO_DRAG.hasOwnProperty(type) &&               // draggable object
                (type == HOVER.STACK ? hover.mine : true)           // its MY stack
                ) {
            this.dragging = true;
            this.drag.card = hover.card;
            this.drag.obj = obj;
            this.drag.type = HOVER_TO_DRAG[type];
            this.drag.fromParent = obj.parent;
            this.drag.fromIdx = hover.idx;
            this.drag.fromPos = obj.position.clone();
            this.drag.fromQuat = obj.quaternion.clone();
            obj.removeFromParent();
            obj.position.set(0,0,0);
            obj.quaternion.set(0,0,0,0);
            this.scene.add(obj);
            return true;
        }
        return false;
    }

    hoverClickDragDrop(t) {
        const myTurn = this.turn == this.myId;
        const canDrag = !this.ended && myTurn;
        const intersects = [];
        const myView = this.playerViews[this.myId];
        const pointerPos = new THREE.Vector2(rawInput.pointer.pos.x, rawInput.pointer.pos.y);
        let zooming = false;
        this.raycaster.setFromCamera(pointerPos, this.camera);
        this.statusHTML = null;
        this.hoverGlow.removeFromParent();
        this.ghostCard.removeFromParent();
        if (!this.dragging && !this.zoomed) {
            this.dragGlow.removeFromParent();
            /* TODO only create hoverArrs on update()...not every frame */
            const hoverArrs = [];
            if (canDrag) {
                hoverArrs.push({ type: HOVER.HAND, arr: this.myHand.map((hover,idx) => ({...hover, idx})) });
                hoverArrs.push({
                    type: HOVER.DISCARD,
                    arr: myView.discard
                            .map(({ arr }, idx) => arr.length > 0 ? {...arr[arr.length - 1], idx} : null)
                    });
            }
            const hoverDiscPlace = { type: HOVER.DISCPLACE, arr: [] };
            const hoverStack = { type: HOVER.STACK, arr: [] };
            Object.values(this.playerViews).forEach(({ stack, discard, id }) => {
                const mine = id == this.myId;
                discard.forEach(({ arr }, idx) => {
                    /* TODO constants */
                    const minLen = mine ? DISCARD_SHOW_TOP : 0; /* always glow other players piles */
                    if (arr.length > minLen) {
                        const glowIdx = arr.length > DISCARD_SHOW_TOP ? arr.length - 4: 0;
                        hoverDiscPlace.arr.push({ ...arr[glowIdx], player: id, idx, mine });
                    }
                });
                if (stack.topObj != null) {
                    hoverStack.arr.push({ obj: stack.topObj, card: stack.topCard, size: stack.count, player: id, mine });
                }
            });
            /* order of pushing matters - prioritize draggables */
            hoverArrs.push(hoverStack);
            hoverArrs.push({ type: HOVER.PLAY,
                             arr: this.playPiles
                                    .map(({ arr }, idx) => arr.length > 0 ? { ...arr[arr.length - 1], idx, size: arr.length } : null)
                            });
            hoverArrs.push(hoverDiscPlace);

            let breakFlag = false;
            for (const { type, arr } of hoverArrs) {
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
                                obj.add(this.dragGlow);
                                this.startDrag(type, hover);
                                break;
                            case HOVER.DISCARD:
                                obj.add(this.dragGlow);
                                this.startDrag(type, hover);
                                break;
                            case HOVER.STACK:
                                this.statusHTML = `${hover.size} card${hover.size == 1 ? '' : 's'}`;
                                if (myTurn && hover.mine) {
                                    obj.add(this.dragGlow);
                                    if (!this.startDrag(type, hover)) {
                                        /* nothing */
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
                    moves[DRAGDROP.PLAY] = Array.from(Array(4), (_,idx) => movePlayFromHand(this.drag.fromIdx, idx));
                    moves[DRAGDROP.DISCARD] = Array.from(Array(4), (_,idx) => moveDiscard(this.drag.fromIdx, idx));
                    break;
                case DRAGDROP.DISCARD:
                    moves[DRAGDROP.PLAY] = Array.from(Array(4), (_,idx) => movePlayFromDiscard(this.drag.fromIdx, idx))
                    break;
                case DRAGDROP.STACK:
                    moves[DRAGDROP.PLAY] = Array.from(Array(4), (_,idx) => movePlayFromStack(idx))
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
                    this.drag.obj.position.set(point.x,point.y,this.cardPlane.position.z);
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
                        if (isValidMove(moves[dropType][idx], this.gameView)) {
                            if (arr.length == 0) {
                                place.add(glow);
                                glow.position.z = 0.001;
                            } else {
                                arr[arr.length-1].obj.add(glow);
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
                        arr: this.playPiles.map(({ arr, place }) => arr.length > 0 ? arr[arr.length - 1] : {obj: place}),
                    }
                ];
                if (this.drag.type == DRAGDROP.HAND) {
                    dropArrs.push({
                        type: DRAGDROP.DISCARD,
                        arr: myView.discard.map(({ arr, place }) => arr.length > 0 ? arr[arr.length - 1] : {obj: place}),
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
                if (move != null && isValidMove(move, this.gameView)) {
                    this.waitingForUpdate = true;
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
    }

    animate (t) {
        if (!this.started) {
            console.error('GameScene not started!');
            return;
        }
        /*
         * prioritize playing animations,
         * then updating game based on queued moves
         * then allow interaction
         */
        if (this.animating) {
            this.continueAnimation(t);
        } else if (this.gameViewQueue.length > 0) {
            const [ gameView, move ] = this.gameViewQueue.shift();
            this.updateGameView(gameView, move);
        } else if (!this.waitingForUpdate) {
            this.hoverClickDragDrop(t);
        }

        this.leftLastFrame = rawInput.pointer.left;

        this.renderer.render(this.scene, this.camera);
    }

    getWinnerBannerPos() {
        const v = this.playPilesGroup.position;
        return worldPos3DToCanvasPos(v, this.camera, this.canvas);
    }

    resize() {
        resizeRenderer(this.camera, this.canvas, this.renderer);
    }
}
