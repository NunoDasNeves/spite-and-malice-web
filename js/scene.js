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
            resizeScene(camera, canvas, renderer);
            let p = (t % 2000)/2000 * Math.PI * 2;
            let r = (t % 4000)/4000 * Math.PI * 2;
            for(let i = 0; i < cards.length; ++i) {
                let o = i / cards.length * Math.PI * 2;
                cards[i].position.y = Math.sin(p + o);
                cards[i].rotation.y = Math.sin(r + o) * Math.PI/18 + 0.2;
            }

            renderer.render(scene, camera);
        };
}

function resizeScene(camera, canvas, renderer) {
    /* resize internal canvas buffer */
    if (canvas.clientHeight != canvas.height || canvas.clientWidth != canvas.width) {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
}

const DRAGDROP = Object.freeze({
    NONE: 0,
    HAND: 1,
    DISCARD: 2,
    STACK: 3,
    PLAY: 4
});

const PLAY_AND_DRAW_PILES_INC = 3;

const PLAY_AND_DRAW_PILES_WIDTH_2 = (PLAY_AND_DRAW_PILES_INC * 4 + CARD_PLACE_WIDTH)/2
const PLAY_AND_DRAW_PILES_HEIGHT_2 = (CARD_PLACE_HEIGHT)/2

const VIEWCAM = Object.freeze({
    /* TODO probably remove this function - limit max players to 6 or so */
    default(num) {
        const xOff = 1.5 * num;
        const yOff = 2.2 * num;
        return { xOff, yOff, camPos: new THREE.Vector3(0,-(yOff*1.3),18) };
    },
    1: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-13,12) },
    2: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-11,11) },
    3: { xOff: 5, yOff: 5, camPos: new THREE.Vector3(0,-12,11) },
    4: { xOff: 4.5, yOff: 4.5, camPos: new THREE.Vector3(0,-10,13) },
    5: { xOff: 7, yOff: 7, camPos: new THREE.Vector3(0,-13,13) },
    6: { xOff: 9, yOff: 11, camPos: new THREE.Vector3(0,-17,15) },
});

const CARD_STACK_DIST = 0.025;

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

class GameScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0F0F0F);
        this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.cameraLookAtPoint = null;
        this.renderer = new THREE.WebGLRenderer({canvas});
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);

        const light = new THREE.DirectionalLight(0xFFFFFF);
        light.position.set(-1, -8, 12);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));

        this.cardPlane = obj3Ds.cardPlane.clone();
        this.cardPlane.position.set(0,0,3);
        this.scene.add(this.cardPlane);

        this.raycaster = new THREE.Raycaster();
        this.hoverGlow = obj3Ds.cardGlow.cyan.clone();

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

        this.started = false;
    }

    start(gameView, roomInfo) {
        const {playerViews, myId} = gameView;
        this.myId = myId;

        this.gameBoard = []; /* TODO - remove? objects that don't change throughout the game */
        /* stuff translated from gameView to */
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
        this.cameraLookAtPoint = new THREE.Vector3(0,-(PLAY_AND_DRAW_PILES_HEIGHT_2 + yOff/2),0);
        this.camera.lookAt(this.cameraLookAtPoint);

        /* hand */
        this.myHandGroup = new THREE.Group();
        this.gameBoard.push(this.myHandGroup);
        this.myHandGroup.lookAt(this.camera.position);
        /* Get relative to camera (by parenting). Then unparent and use that position */
        this.myHandGroup.position.set(0,-5.5,-8);
        this.camera.add(this.myHandGroup);
        const v = new THREE.Vector3();
        this.myHandGroup.getWorldPosition(v);
        this.camera.clear();
        this.myHandGroup.position.copy(v);

        /* play piles */
        this.playPilesGroup = new THREE.Group();
        /* group just for the cards... */
        this.playPilesCardGroup = new THREE.Group();
        this.playPilesGroup.add(this.playPilesCardGroup);
        this.gameBoard.push(this.playPilesGroup);
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
        this.gameBoard.push(this.drawPileCardGroup);

        /* views */
        const radInc = (1/this.numPlayers) * Math.PI * 2;
        let rotation = 0;

        for (let i = 0; i < this.numPlayers; ++i) {
            const { id } = playerViews[this.playerIds[i]];
            const { name, color } = roomInfo.players[this.playerIds[i]];
            const view = {
                            group: null,
                            cardGroup: null,
                            label: null,
                            labelCanvas: null,
                            name,
                            color,
                            id,
                            discard: Array.from(Array(4), ()=> ({ place: null, glow: null, arr: [] })),
                            stackTop: { card: null, obj: null },
                            stackCount: 0,
                            stackCardGroup: null,
                            handCount: 0,
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
            this.gameBoard.push(group);

            /* player name cards */
            const {mesh, canvas} = makeNameCard(name, 32, PLAYER_COLORS[view.color]);
            view.label = mesh;
            view.labelCanvas = canvas;
            view.label.rotation.z = Math.PI;
            view.label.position.set(0,1.5,0);
            group.add(view.label);

            /* group for only the cards - so we can remove them each update */
            view.cardGroup = new THREE.Group();
            group.add(view.cardGroup);

            /* stack */
            view.stackCardGroup = new THREE.Group();
            view.stackCardGroup.position.set(6,0.5,0);
            group.add(view.stackCardGroup);

            /* discard */
            const discPileOffset = new THREE.Vector3(-6,-1,0);
            for (let j = 0; j < 4; ++j) {
                /* place for empty discard piles */
                const discCardPlace = obj3Ds.cardPlace.clone();
                view.discard[j].place = discCardPlace;
                discCardPlace.position.copy(discPileOffset);
                view.discard[j].glow = obj3Ds.cardGlow.yellow.clone();
                group.add(discCardPlace);
                /* the actual pile */
                discPileOffset.x += 3;
            }
        }
        this.scene.add(...this.gameBoard);
        this.started = true;
        this.update(gameView, roomInfo);
    }

    update (gameView, roomInfo) {
        if (!this.started) {
            console.error('GameScene not started!');
            return;
        }
        const {playerViews, playPiles, drawPileCount, turn, myHand} = gameView;
        this.gameView = gameView;
        this.turn = turn;

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
                                    obj.position.addVectors(playPlace.position, new THREE.Vector3(0,0,0.01 + 0.01 * idx));
                                    this.playPilesCardGroup.add(obj);
                                });
        });

        /* draw pile */
        this.drawPileCardGroup.clear();
        for (let i = 0; i < drawPileCount; ++i) {
            const stack = obj3Ds.cardStack.clone();
            stack.position.z = i * CARD_STACK_DIST;
            this.drawPileCardGroup.add(stack);
        }

        /* map player view packet to GameScene playerview */
        Object.values(this.playerViews).forEach((view) => {
            if (!playerViews.hasOwnProperty(view.id)) {
                console.error(`missing player ${view.id}`);
                return;
            }
            view.cardGroup.clear();
            const newView = playerViews[view.id];

            /* stack */
            view.stackCount = newView.stackCount;
            view.stackCardGroup.clear();
            for (let i = 0; i < newView.stackCount; ++i) {
                const stack = obj3Ds.cardStack.clone();
                stack.position.z = i * CARD_STACK_DIST;
                view.stackCardGroup.add(stack);
            }
            const stackTopObj = cardToCardObj(newView.stackTop);
            view.stackTop = { card: newView.stackTop, obj: stackTopObj };
            stackTopObj.position.z = view.stackCount * CARD_STACK_DIST;
            view.stackCardGroup.add(stackTopObj);

            /* discard */
            view.discard.forEach((discard, pileIdx) => {
                discard.arr = newView.discard[pileIdx].map(card => ({card, obj: cardToCardObj(card)}));
                const discCardPlace = discard.place;
                discard.arr.forEach(({obj}, idx) => {
                                        obj.rotation.x = Math.PI/64; // tilt up slightly
                                        obj.position.addVectors(discCardPlace.position, new THREE.Vector3(0,-0.6*idx,0.1));
                                        view.cardGroup.add(obj);
                                    });
            });
        });
    }

    itsMyTurn(t) {
        const intersects = [];
        const myView = this.playerViews[this.myId];
        const mousePos = new THREE.Vector2(rawInput.mouse.pos.x, rawInput.mouse.pos.y);
        this.raycaster.setFromCamera(mousePos, this.camera);
        if (!this.dragging) {
            this.hoverGlow.removeFromParent();
            const hoverArrs = [
                { type: DRAGDROP.HAND, arr: this.myHand },
                {
                    type: DRAGDROP.DISCARD,
                    arr: myView.discard.map(({ arr }) => arr.length > 0 ? arr[arr.length - 1] : null) },
                { type: DRAGDROP.STACK, arr: [ myView.stackTop ] },
            ];
            let breakFlag = false;
            for (const {type, arr} of hoverArrs) {
                for (let i = 0; i < arr.length; ++i) {
                    if (arr[i] == null) {
                        continue;
                    }
                    const {card, obj} = arr[i];
                    intersects.length = 0;
                    this.raycaster.intersectObject(obj, true, intersects);
                    if (intersects.length > 0) {
                        breakFlag = true;
                        if (rawInput.mouse.left) {
                            this.dragging = true;
                            this.drag.card = card;
                            this.drag.obj = obj;
                            this.drag.type = type;
                            this.drag.fromParent = obj.parent;
                            this.drag.fromIdx = i;
                            this.drag.fromPos = obj.position.clone();
                            this.drag.fromQuat = obj.quaternion.clone();
                            obj.removeFromParent();
                            obj.position.set(0,0,0);
                            obj.quaternion.set(0,0,0,0);
                            this.scene.add(obj);
                        }
                        obj.add(this.hoverGlow);
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

            if (rawInput.mouse.left) {
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
        }
    }

    animate (t) {
        if (!this.started) {
            console.error('GameScene not started!');
            return;
        }
        resizeScene(this.camera, this.canvas, this.renderer);

        if (this.turn == this.myId) {
            this.itsMyTurn(t);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
