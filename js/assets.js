const assets = {};
const obj3Ds = {};

function createCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function loadAssets(next) {
    const SPACING = 30;
    const CARD_WIDTH = 360;
    const CARD_HEIGHT = 540;
    const CANVAS_WIDTH = 225;
    const CANVAS_HEIGHT = 350;
    const NUM_CARDBACKS = 2;
    const cardFronts = new Image();
    const cardBacks = new Image();

    assets.cardFronts = [];
    assets.cardBacks = [];

    let count = 2;
    const doNext = function() {
        count--;
        if (count == 0) {
            next();
        }
    }
    cardFronts.onload = function() {
        var coords = []
        for (let r = 0; r < SUITS.length; r++) {
            for (let c = 0; c < 13; c++) {
                coords.push({r,c})
            }
        }
        coords.push({r: 4, c: 0}, {r: 4, c:1});
        coords.forEach(({r,c}) => {
            let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            let ctx = canvas.getContext('2d');
            ctx.drawImage(
                cardFronts,
                SPACING + c * (CARD_WIDTH + SPACING),
                SPACING + r * (CARD_HEIGHT + SPACING),
                CARD_WIDTH,
                CARD_HEIGHT,
                0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
            assets.cardFronts.push(canvas);
            loadingScreen.appendChild(canvas);
        });
        doNext();
    };
    cardBacks.onload = function() {
        for (let i = 0; i < NUM_CARDBACKS; ++i) {
            let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            let ctx = canvas.getContext('2d');
            ctx.drawImage(
                cardBacks,
                SPACING + i * (CARD_WIDTH + SPACING),
                SPACING,
                CARD_WIDTH,
                CARD_HEIGHT,
                0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
            assets.cardBacks.push(canvas);
            loadingScreen.appendChild(canvas);
        }
        doNext();
    }
    cardFronts.src = 'assets/card-fronts.png';
    cardBacks.src = 'assets/card-backs.png';
}

function makeTextureFromCanvas(asset) {
    const tex = new THREE.CanvasTexture(asset);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter; // seems to be sharpest
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

function makeCardMaterial(texture) {
    return new THREE.MeshPhysicalMaterial({ // slowest but best
                    side: THREE.FrontSide,
                    flatShading: false,
                    metalness: 0,
                    roughness: 0.1,
                    clearcoat: 1,
                    clearcoatRoughness: 0.5,
                    alphaTest: 0.5,
                    map: texture,
                });
}

function makeGlowMaterial(texture, color) {
    return new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    alphaMap: texture,
                    transparent: true,
                    color,
                });
}

const CARD_OBJ_WIDTH = 2.25;
const CARD_OBJ_HEIGHT = 3.5;
const CARD_PLACE_WIDTH = 2.35;
const CARD_PLACE_HEIGHT = 3.6;

function initObj3Ds() {
    const loader = new THREE.TextureLoader();
    const cardGeometry = new THREE.PlaneGeometry(2.25,3.5);
    const cardBackMaterial = makeCardMaterial(makeTextureFromCanvas(assets.cardBacks[1]));

    obj3Ds.cardStack = new THREE.Mesh(cardGeometry, cardBackMaterial);

    obj3Ds.cards = [];
    for (let i = 0; i < DECK.length; ++i) {
        const cardFrontMaterial = makeCardMaterial(makeTextureFromCanvas(assets.cardFronts[i]));
        const front = new THREE.Mesh(cardGeometry, cardFrontMaterial);
        const back = new THREE.Mesh(cardGeometry, cardBackMaterial);
        back.rotation.y += Math.PI;
        const group = new THREE.Group();
        group.add(front);
        group.add(back);
        obj3Ds.cards.push(group);
    }

    const cardPlaceGeometry = new THREE.PlaneGeometry(2.35,3.6);
    const cardPlaceMaterial = new THREE.MeshStandardMaterial({
        side: THREE.FrontSide,
        flatShading: false,
        color: 0x884422,
        metalness: 0,
        roughness: 1,
    });
    const cardPlace = new THREE.Mesh(cardPlaceGeometry, cardPlaceMaterial);
    obj3Ds.cardPlace = cardPlace;

    obj3Ds.cardGlow = {};
    const cardGlowTexture = loader.load('assets/card-glow.png');
    for (const [name,color] of [['yellow', 0xFFBB00],['cyan', 0x00FFFF]]) {
        const cardGlowMaterial = makeGlowMaterial(cardGlowTexture, color);
        obj3Ds.cardGlow[name] = new THREE.Mesh(cardPlaceGeometry, cardGlowMaterial);
        obj3Ds.cardGlow[name].scale.set(1.05,1.05,1.05);
        obj3Ds.cardGlow[name].position.set(0,0,-0.001);
    }

    const cardPlaneGeom = new THREE.PlaneGeometry(9999,9999);
    obj3Ds.cardPlane = new THREE.Mesh(cardPlaneGeom, new THREE.MeshBasicMaterial());
    obj3Ds.cardPlane.visible = false;
}