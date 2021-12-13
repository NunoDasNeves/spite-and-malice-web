const ASSETS_DIR = '/assets'

const canvases = {};
const textures = {};
const obj3Ds = {};

function createCanvas(width, height) {
    var canvas = document.createElement('canvas');
    if (width != undefined) {
        canvas.width = width;
    }
    if (height != undefined) {
        canvas.height = height;
    }
    return canvas;
}

const CARD_PIXEL_WIDTH = 360;
const CARD_PIXEL_HEIGHT = 540;

function loadAssets(next) {
    const SPACING = 30;
    const CANVAS_WIDTH = 225;
    const CANVAS_HEIGHT = 350;
    const NUM_CARDBACKS = 2;
    const cardFronts = new Image();
    const cardBacks = new Image();

    canvases.cardFronts = [];
    canvases.cardBacks = [];

    let count = 3;
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
                SPACING + c * (CARD_PIXEL_WIDTH + SPACING),
                SPACING + r * (CARD_PIXEL_HEIGHT + SPACING),
                CARD_PIXEL_WIDTH,
                CARD_PIXEL_HEIGHT,
                0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
            canvases.cardFronts.push(canvas);
            //loadingScreen.appendChild(canvas);
        });
        doNext();
    };
    cardBacks.onload = function() {
        for (let i = 0; i < NUM_CARDBACKS; ++i) {
            let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            let ctx = canvas.getContext('2d');
            ctx.drawImage(
                cardBacks,
                SPACING + i * (CARD_PIXEL_WIDTH + SPACING),
                SPACING,
                CARD_PIXEL_WIDTH,
                CARD_PIXEL_HEIGHT,
                0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
            canvases.cardBacks.push(canvas);
            //loadingScreen.appendChild(canvas);
        }
        doNext();
    }
    cardFronts.src = `${ASSETS_DIR}/card-fronts.png`;
    cardBacks.src = `${ASSETS_DIR}/card-backs.png`;

    const loadManager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(loadManager);
    textures.cardGlow = loader.load(`${ASSETS_DIR}/card-glow.png`);
    textures.whiteStone = loader.load(`${ASSETS_DIR}/White_stone_texture.jpg`);
    loadManager.onLoad = () => {
        doNext();
    }
}

const forceTextureInitialization = function() {
    const material = new THREE.MeshBasicMaterial();
    const geometry = new THREE.PlaneGeometry();
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();

    return function forceTextureInitialization(texture, renderer) {
        material.map = texture;
        renderer.render(scene, camera);
    };
}();

const NAMECARD_FONT_SIZE = 32;
const NAMECARD_SQUARE_SIZE = NAMECARD_FONT_SIZE;
const NAMECARD_BORDER_SIZE = 8;
const NAMECARD_SPACING = NAMECARD_BORDER_SIZE;
const NAMECARD_FONT = `${NAMECARD_FONT_SIZE}px bold Helvetica, Arial, sans-serif`;

function drawNameCard(canvas, name, color, connected) {
    const ctx = canvas.getContext('2d');
    ctx.font = NAMECARD_FONT;
    const textWidth = ctx.measureText(name).width;
    ctx.textBaseline = 'top';
    ctx.fillStyle = connected ? 'white' : 'red';
    ctx.clearRect(0,0,canvas.width,canvas.height); /* since we're reusing this canvas, need to clear it */
    ctx.fillText(name, NAMECARD_BORDER_SIZE/2, NAMECARD_BORDER_SIZE/2);
    ctx.fillStyle = color;
    ctx.fillRect(NAMECARD_BORDER_SIZE/2 + textWidth + NAMECARD_SPACING, NAMECARD_BORDER_SIZE/2, NAMECARD_SQUARE_SIZE, NAMECARD_SQUARE_SIZE);
}

function makeNameCard(name, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = NAMECARD_FONT;
    const textWidth = ctx.measureText(name).width;
    const width = textWidth + NAMECARD_SPACING + NAMECARD_SQUARE_SIZE + NAMECARD_BORDER_SIZE;
    const height = NAMECARD_FONT_SIZE + NAMECARD_BORDER_SIZE;
    canvas.width = width;
    canvas.height = height;

    drawNameCard(canvas, name, color, true)

    const texture = makeTextureFromCanvas(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.FrontSide,
        transparent: true,
    });
    const mesh = new THREE.Mesh(obj3Ds.labelGeometry, material);
    mesh.scale.set(width * 0.025, height * 0.025, 1);
    return {mesh, canvas};
}

function makeTextureFromCanvas(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
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

function makeTableMaterial(texture) {
    return new THREE.MeshPhysicalMaterial({
                    side: THREE.FrontSide,
                    flatShading: false,
                    metalness: 0.2,
                    roughness: 0.9,
                    clearcoat: 0,
                    map: texture,
    });
}

const CARD_OBJ_WIDTH = 2.25;
const CARD_OBJ_HEIGHT = 3.5;
const CARD_PLACE_WIDTH = 2.35;
const CARD_PLACE_HEIGHT = 3.6;

const GHOST_CARD_FONT = `${CARD_PIXEL_HEIGHT-32}px bold Helvetica, Arial, sans-serif`;

function initObj3Ds() {
    const cardGeometry = new THREE.PlaneGeometry(CARD_OBJ_WIDTH,CARD_OBJ_HEIGHT);
    const cardBackMaterial = makeCardMaterial(makeTextureFromCanvas(canvases.cardBacks[1]));

    obj3Ds.cardStack = new THREE.Mesh(cardGeometry, cardBackMaterial);

    obj3Ds.cards = [];
    for (let i = 0; i < DECK.length; ++i) {
        const cardFrontMaterial = makeCardMaterial(makeTextureFromCanvas(canvases.cardFronts[i]));
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
    const cardGlowTexture = textures.cardGlow;
    for (const [name,color] of [['yellow', 0xFFBB00],['cyan', 0x00FFFF],['green', 0x00FF44]]) {
        const cardGlowMaterial = makeGlowMaterial(cardGlowTexture, color);
        obj3Ds.cardGlow[name] = new THREE.Mesh(cardPlaceGeometry, cardGlowMaterial);
        obj3Ds.cardGlow[name].scale.set(1.05,1.05,1.05);
        obj3Ds.cardGlow[name].position.set(0,0,-0.001);
    }

    const cardPlaneGeom = new THREE.PlaneGeometry(9999,9999);
    obj3Ds.cardPlane = new THREE.Mesh(cardPlaneGeom, new THREE.MeshBasicMaterial());
    obj3Ds.cardPlane.visible = false;

    obj3Ds.labelGeometry = new THREE.PlaneGeometry(1,1);

    obj3Ds.ghostCards = {};
    for (let i = 1; i < 13; ++i) {
        /* TODO use shared canvas? */
        const text = VALUE_TO_CARD_NAME[i][0];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = GHOST_CARD_FONT;
        const textWidth = ctx.measureText(text).width;
        const borderLeft = (CARD_PIXEL_WIDTH - textWidth)/2;
        const borderTop = borderLeft;
        canvas.width = CARD_PIXEL_WIDTH;
        canvas.height = CARD_PIXEL_HEIGHT;
        ctx.font = GHOST_CARD_FONT;
        ctx.textBaseline = 'top';
        //ctx.clearRect(0,0,canvas.width,canvas.height); /* since we're reusing this canvas, need to clear it */
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillText(text, borderLeft, borderTop);

        const ghostTexture = makeTextureFromCanvas(canvas);
        const ghostMaterial = new THREE.MeshBasicMaterial({
                                            side: THREE.FrontSide,
                                            transparent: true,
                                            alphaMap: cardGlowTexture,
                                            map: ghostTexture});
        const ghost = new THREE.Mesh(cardGeometry, ghostMaterial);
        ghost.position.set(0,0,0.001);
        obj3Ds.ghostCards[i] = ghost;
    }

    const tableGeometry = new THREE.PlaneGeometry(38.4*2,25.57*2);
    obj3Ds.tables = {};
    obj3Ds.tables.whiteStone = new THREE.Mesh(tableGeometry, makeTableMaterial(textures.whiteStone));
    obj3Ds.tables.whiteStone.position.set(0,0,-0.001);
}