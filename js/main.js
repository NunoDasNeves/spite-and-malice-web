let loadingScene = {};
let gameScene = {};

let assets;
let cardObjs;

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

    assets = {};
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
    cardFronts.src = '../assets/card-fronts.png';
    cardBacks.src = '../assets/card-backs.png';
}

function makeTextureFromCanvas(asset) {
    const tex = new THREE.CanvasTexture(asset);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter; // slowest but best
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

function initCardObjs() {
    const geometry = new THREE.PlaneGeometry(2.25,3.5);
    const cardBackMaterial = makeCardMaterial(makeTextureFromCanvas(assets.cardBacks[1]));
    cardObjs = [];
    for (let i = 0; i < DECK.length; ++i) {
        const cardFrontMaterial = makeCardMaterial(makeTextureFromCanvas(assets.cardFronts[i]));
        const front = new THREE.Mesh(geometry, cardFrontMaterial);
        const back = new THREE.Mesh(geometry, cardBackMaterial);
        back.rotation.y += Math.PI;
        const group = new THREE.Group();
        group.add(front);
        group.add(back);
        cardObjs.push(group);
    }
}

function cardsToCardObjs(arr) {
    return arr.map((card) => {
        if (card.value == 14) {
            return cardObjs[cardObjs.length-1].clone();
        }
        let idx = (card.value - 1) + (card.suite * 13);
        console.log(idx);
        return cardObjs[idx].clone();
    });
}

function initLoadingScene() {
    const canvas = document.querySelector('#canvas-loading');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F0F0F);
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({canvas});

    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(-1, 2, 4);

    const cards = cardsToCardObjs(DECK_NO_JOKERS);
    scene.add(...cards);
    scene.add(light);

    for(let i = 0; i < cards.length; ++i) {
        const xPos = (i/cards.length) * 14 - 7;
        cards[i].position.x = xPos;
        cards[i].rotation.y = 0.2;
    }
    camera.position.z = 7;

    loadingScene = {
        renderer,
        scene,
        camera,
        cards,
        animate: (t) => {
            /* resize internal canvas buffer */
            if (canvas.clientHeight != canvas.height || canvas.clientWidth != canvas.width) {
                renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
            }
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();

            let p = (t % 2000)/2000 * Math.PI * 2;
            let r = (t % 4000)/4000 * Math.PI * 2;
            for(let i = 0; i < cards.length; ++i) {
                let o = i / cards.length * Math.PI * 2;
                cards[i].position.y = Math.sin(p + o);
                cards[i].rotation.y = Math.sin(r + o) * Math.PI/18 + 0.2;
            }

            renderer.render(scene, camera);
        }
    };
}

function initGameScene() {
    const canvas = document.querySelector('#canvas-game');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({canvas});

    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    gameScene = {
        renderer,
        animate: (t) => {
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;

            renderer.render(scene, camera);
        }
    };
}

function animate(t) {
    if (appScreen == SCREENS.LOADING || appScreen == SCREENS.GAME) {
        requestAnimationFrame(animate);
    }

    if (appScreen == SCREENS.LOADING) {
        loadingScene.animate(t);
    } else if (appScreen == SCREENS.GAME) {
        gameScene.animate(t);
    }
};

const SCREENS = Object.freeze({
    INVALID: -1,
    LOADING: 0,
    MAIN: 1,
    LOBBY: 2,
    GAME: 3,
});

let appScreen = SCREENS.INVALID;

/* TODO make these packet layouts explicit somehow... */
/* Packet format
 * {
 *  type,
 *  data,
 * }
 * data depends on the packet type
 * 
 * client
 * PLAYERINFO { name }
 * STARTGAME {}
 * MOVE { type, <other fields depending on type> }
 * // EMOTE { type }
 * // ENDGAME {}
 * 
 * host
 * ROOMINFO { players: { [id]: { name, id, isAdmin } ... } }
 * GAMESTART { <game view stuff> }
 * MOVE { playerId, move: { type, <other fields depending on type> }, result: { <stuff to update game view> } }
 * // PLAYERLEFT { playerId }
 * // EMOTE { playerId, type }
 * GAMEEND { winnerId }
 */
const CLIENTPACKET = Object.freeze({
    PLAYERINFO: 0,
    STARTGAME: 1,
    MOVE: 2,
    //EMOTE: 3,
    //ENDGAME: 4,
});

const HOSTPACKET = Object.freeze({
    ROOMINFO: 0,
    GAMESTART: 1,
    MOVE: 2,
    //PLAYERLEFT: 3,
    //EMOTE: 4,
    GAMEEND: 5,
});

/* connection to a local player */
LocalConn.count = 0;
function LocalConn(rcvFn) {
    this.id = `${LocalConn.count}-local`;
    LocalConn.count++;
    /* Host does stuff on these callbacks */
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
    /* Host uses this to send data to client */
    this.send = rcvFn;
}

class Host {
    constructor() {
        this.playerIdCount = 0;
        this.game = null;
        this.players = {};
        this.turn = 0;
        this.peer = new Peer();
        this.onGetHostId = (id) => {};

        this.peer.on('open', (id) => {
            this.hostId = id;
            console.log('Host ID is: ' + id);
            this.onGetHostId(id);
        });
        this.peer.on('connection', (conn) => {
            /* TODO more robust state management? Gotta remember to put game back to null if we return to the lobby... */
            if (this.game == null) {
                this.addRemotePlayer(conn);
            }
        });
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
        });
        this.peer.on('close', () => {
            console.log('Peer closed');
        });
        this.peer.on('error', (err) => {
            console.error('Peer error');
            console.error(err);
        });
    }
    /* Add a player with an existing PeerJs connection */
    addRemotePlayer (conn) {
        let playerId = conn.peer;
        this.players[playerId] = {
            conn,
            name: "Unknown",
            id: this.playerIdCount,
            isAdmin: false,
        };
        this.playerIdCount++;
        console.log('Player connected');

        conn.on('data', (data) => {
            this.receive(playerId, data);
        });
        conn.on('close', () => {
            this.removePlayer(playerId);
        });
        conn.on('error', (err) => {
            console.error('Error in remote player connection');
            console.error(this.players[playerId]);
            console.error(err);
        });
    }
    /* Add a player with a LocalConn */
    addLocalPlayer(conn, info) {
        let playerId = conn.id;
        this.players[playerId] = {
            conn,
            name: "Unknown",
            id: this.playerIdCount,
            isAdmin: true,
        };
        this.playerIdCount++;
        conn.onData = (data) => {
            this.receive(playerId, data);
        }
        conn.onClose = () => {
            this.removePlayer(playerId);
        }
        conn.onError = (err) => {
            console.error('Error in local player connection');
            console.error(this.players[playerId]);
            console.error(err);
        }
        this.receive(playerId, {type: CLIENTPACKET.PLAYERINFO, data: info});
    }

    removePlayer(playerId) {
        delete this.players[playerId];
        let packetRoomInfo = this.packetRoomInfo();
        this.broadcast((_) => packetRoomInfo);
        console.log('Player left');
    }
    close() {
        this.peer.disconnect(); /* TODO - do this once connection established? */
        this.peer.destroy();
    }

    broadcast(packetFn) {
        for (const {conn, id} of Object.values(this.players)) {
            conn.send(packetFn(id));
        };
    }

    packetRoomInfo() {
        return {
            type: HOSTPACKET.ROOMINFO,
            data: { players: Object.values(this.players)
                                .reduce((obj, {name, id, isAdmin}) => {
                                    obj[id] = {name, id, isAdmin};
                                    return obj;
                                }, {})
                  },
        }
    }

    packetGameView(id) {
        return {
            type: HOSTPACKET.GAMESTART,
            data: this.game.toView(id),
        };
    }

    /* Handle messages from the client */
    receive(playerId, data) {
        switch(data.type) {
            case CLIENTPACKET.PLAYERINFO:
                this.players[playerId].name = data.data.name;
                let packetRoomInfo = this.packetRoomInfo();
                this.broadcast((_) => packetRoomInfo);
                break;
            case CLIENTPACKET.STARTGAME:
                if (this.game == null && this.players[playerId].isAdmin) {
                    this.game = new Game(this.players);
                    this.game.start();
                    this.broadcast((id) => this.packetGameView(id));
                }
                break;
            default:
                console.warn('Unknown client packet received');
        }
    }
}

/* The local client who talks to either Host or RemoteHost */
class Client {
    constructor(name, isAdmin) {
        this.playerInfo = { name };
        this.roomInfo = {};
        this.isAdmin = isAdmin;
        this.gameView = null;
    }
    /* Handle messages from the host */
    receive(data) {
        switch(data.type) {
            case HOSTPACKET.ROOMINFO:
                this.roomInfo = data.data;
                populateLobby(Object.values(this.roomInfo.players), this.isAdmin);
                break;
            case HOSTPACKET.GAMESTART:
                this.gameView = data.data;
                goToGame();
                break;
            default:
                console.warn('Unknown host packet received');
        }
    }
}

class LocalClient extends Client {
    constructor(host, name) {
        super(name, true);
        this.host = host;
        this.conn = new LocalConn((data) => { this.receive(data); });
        this.host.onGetHostId = goToLobby;
        this.host.addLocalPlayer(this.conn, this.playerInfo);
    }
    send (data) {
        this.conn.onData(data);
    }
    close () {
        this.conn.onClose();
        this.host.close();
        changeScreen(SCREENS.MAIN);
    }
}

/* create a connection with a remote host, send them player info, forward data to the client */
class RemoteClient extends Client {
    constructor(hostId, name) {
        super(name, false);
        this.hostId = hostId;
        this.peer = new Peer();
        this.conn = null;
        this.closing = false;

        this.peer.on('open', (id) => {
            this.localId = id;
            console.log('My player ID is: ' + id);
            console.log('Attempting to connect to ' + this.hostId);
            this.conn = this.peer.connect(this.hostId, {reliable:true});
            this.conn.on('open', () => {
                console.log('Connected to host');
                this.conn.send({type: CLIENTPACKET.PLAYERINFO, data: this.playerInfo});
                goToLobby(id);
            });
            this.conn.on('data', (data) => {
                this.receive(data);
            });
            this.conn.on('close', () => {
                console.log('Host connection was closed');
                /* Did we expect to close? */
                if (!this.closing) {
                    this.close();
                    alert('You were disconnected from the host!');
                }
            });
            this.conn.on('error', (err) => {
                console.error('Error in host connection')
                console.error(err);
            });
        });
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
        });
        this.peer.on('close', () => {
            console.log('Peer closed');
        });
        this.peer.on('error', (err) => {
            console.error('Peer error');
            console.error(err);
            switch(err.type) {
                case 'invalid-id':
                    alert('Invalid game ID - illegal characters');
                    this.close();
                    break;
                case 'peer-unavailable':
                    alert('Invalid game ID - game does not exist');
                    this.close();
                    break;
                default:
                    break;
            }
        });
    }
    send(data) {
        this.conn.send(data);
    }
    close() {
        this.closing = true;
        this.peer.disconnect(); /* TODO - do this once connection established? */
        this.peer.destroy();
        changeScreen(SCREENS.MAIN);
    }
}

let client = {};

function createGame(name) {
    let host = new Host();

    client = new LocalClient(host, name);
}

function joinGame(hostId, name) {
    client = new RemoteClient(hostId, name);
}

function startGame() {
    client.send({ type: CLIENTPACKET.STARTGAME, data: {} });
}

/* UI */
const mainScreen = document.getElementById('screen-main');
const mainDisplayName = document.getElementById('main-display-name');
const createButton = document.getElementById('button-create');
const mainPeerId = document.getElementById('main-peer-id');
const joinButton = document.getElementById('button-join');

const loadingScreen = document.getElementById('screen-loading');

const lobbyScreen = document.getElementById('screen-lobby');
const lobbyPeerId = document.getElementById('lobby-peer-id');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const startGameButton = document.getElementById('button-start-game');
const disconnectButton = document.getElementById('button-disconnect');

const gameScreen = document.getElementById('screen-game');
const leaveGameButton = document.getElementById('button-leave-game');
const endGameButton = document.getElementById('button-end-game');
const gameSceneContainer = document.getElementById('game-scene-container');

const screens = [mainScreen, lobbyScreen, loadingScreen, gameScreen];
const adminElements = [startGameButton, endGameButton];
const nonAdminElements = [leaveGameButton];

function changeScreen(newScreen) {
    if (newScreen == appScreen) {
        return;
    }
    for (const el of screens) {
        el.hidden = true;
    };
    switch(newScreen) {
        case SCREENS.MAIN:
            mainScreen.hidden = false;
            break;
        case SCREENS.LOADING:
            requestAnimationFrame(animate);
            loadingScreen.hidden = false;
            break;
        case SCREENS.LOBBY:
            lobbyScreen.hidden = false;
            break;
        case SCREENS.GAME:
            requestAnimationFrame(animate);
            gameScreen.hidden = false;
            break;
        default:
            console.error('screen does not exist: ' + screen);
    }
    appScreen = newScreen;
    hideAdminElements(client.isAdmin);
}

function populateLobby(players, isAdmin) {
    while (lobbyPlayerList.firstChild) {
        lobbyPlayerList.removeChild(lobbyPlayerList.firstChild);
    }
    for (const { name } of players) {
        let playerDiv = document.createElement('div');
        playerDiv.innerHTML = name;
        lobbyPlayerList.appendChild(playerDiv);
    };
    if (isAdmin) {
        if (players.length > 1) {
            startGameButton.disabled = false;
        } else {
            startGameButton.disabled = true;
        }
    }
}

function goToLobby(id) {
    lobbyPeerId.value = id;
    changeScreen(SCREENS.LOBBY);
}

function goToGame() {
    changeScreen(SCREENS.GAME);
}

function initUI() {
    mainPeerId.oninput = function() {
        if (mainPeerId.value.length > 0) {
            joinButton.disabled = false;
        } else {
            joinButton.disabled = true;
        }
    };
    mainDisplayName.oninput = function() {
        if (mainDisplayName.value.length> 0) {
            mainPeerId.disabled = false;
            createButton.disabled = false;
            mainPeerId.oninput();
        } else {
            mainPeerId.disabled = true;
            createButton.disabled = true;
            joinButton.disabled = true;
        }
    };
    createButton.onclick = function() {
        changeScreen(SCREENS.LOADING);
        createGame(mainDisplayName.value);
    }
    joinButton.onclick = function() {
        let hostId = mainPeerId.value.trim();
        changeScreen(SCREENS.LOADING);
        joinGame(hostId, mainDisplayName.value);
    }
    disconnectButton.onclick = function() {
        if (confirm("Are you sure?")) {
            client.close();
        }
    }
    startGameButton.onclick = function() {
        startGame();
    }
    leaveGameButton.onclick = function() {
        if (confirm("Are you sure?")) {
            client.close();
        }
    }
    endGameButton.onclick = function() {
        if (confirm("This will end the game for all players! Are you sure?")) {
            client.close();
        }
    }

    changeScreen(SCREENS.LOADING);
}

function hideAdminElements(isAdmin) {
    for (const el of adminElements) {
        el.hidden = !isAdmin;
    }
    for (const el of nonAdminElements) {
        el.hidden = isAdmin;
    }
}

function init() {
    loadAssets(() => {
        initCardObjs();
        initLoadingScene();
        initGameScene();
        initUI();
    });
}

init();