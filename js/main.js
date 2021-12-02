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

const SCREENS = Object.freeze({
    INVALID: -1,
    LOADING: 0,
    MAIN: 1,
    LOBBY: 2,
    GAME: 3,
});

let testing = false;
let appScreen = SCREENS.INVALID;


/* Game animation, 3D stuff */

const loadingScene = {};
const gameScene = {};

function cardToCardObj({value, suite}) {
    if (value == 14) {
        return obj3Ds.cards[obj3Ds.cards.length-1].clone();
    }
    let idx = (value - 1) + (suite * 13);
    return obj3Ds.cards[idx].clone();
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
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
}

function initGameScene() {
    const canvas = document.querySelector('#canvas-game');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F0F0F);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({canvas});

    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.DirectionalLight(0xFFFFFF);
    light.position.set(-1, 2, 4);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    let stuffInScene = [];

    gameScene.animate = (t) => {
            resizeScene(camera, canvas, renderer);
            for (const group of stuffInScene) {
                for (const obj of group.children) {
                    //obj.rotateY(0.01);
                }
            }
            renderer.render(scene, camera);
        };

    gameScene.update = ({playerViews, playPiles, drawPileCount, turn, myId, myHand}) => {
            const viewsSorted = Object.values(playerViews)
                                .sort((a,b) => Number(a.id) - Number(b.id))
            /* rotate until myId is first */
            while(viewsSorted[0].id != myId) {
                let v = viewsSorted.shift();
                viewsSorted.push(v);
            }
            const numPlayers = viewsSorted.length;
            const radInc = (1/numPlayers) * Math.PI * 2;
            const stackTopOffset = new THREE.Vector3(6,0.5,0);
            /* TODO probably need to hardcode these for different player counts */
            const viewDist = -3.3 * numPlayers;
            camera.position.z = 7 * numPlayers;
            let rotation = 0;
            const myHandOffset = new THREE.Vector3(12,viewDist - 4,1);
            const playPilesOffset = new THREE.Vector3(0,0,0);

            scene.remove(...stuffInScene);
            stuffInScene = [];

            /* my hand */
            const myHandGroup = new THREE.Group();
            myHandGroup.position.copy(myHandOffset);
            stuffInScene.push(myHandGroup);
            myHand.map(cardToCardObj).forEach((card, idx) => {
                card.position.x = -3 + idx * 1.5;
                card.rotation.y = Math.PI/32;
                myHandGroup.add(card);
            });

            /* play piles and draw pile */
            const playPilesGroup = new THREE.Group();
            playPilesGroup.position.copy(playPilesOffset);
            stuffInScene.push(playPilesGroup);
            const pileOffset = new THREE.Vector3(-6,0,0);
            for (const pile of playPiles) {
                const playCardPlace = obj3Ds.cardPlace.clone();
                playCardPlace.position.copy(pileOffset);
                playPilesGroup.add(playCardPlace);
                /* the actual pile */
                if (pile.length > 0) {
                    const playCards = pile
                                        .map(cardToCardObj);
                    playCards.forEach((card, idx) => {
                                            card.rotation.x = Math.PI/12; // tilt up slightly
                                            card.position.addVectors(playCardPlace.position, new Vector3(0,-0.5 * idx,0));
                                        });
                    playPilesGroup.add(...playCards);
                }
                pileOffset.x += 3;
            }
            /* TODO draw pile */

            /* player views (including my own view - discard piles + stacks) */
            for (const {name, id, stackTop, stackCount, handCount, discard} of viewsSorted) {
                /* position the player's cards */
                const group = new THREE.Group();
                group.rotateZ(rotation);
                group.translateY(viewDist);
                rotation += radInc;
                stuffInScene.push(group);
                /* stack */
                const stackTopObj = cardToCardObj(stackTop);
                stackTopObj.position.copy(stackTopOffset);
                group.add(stackTopObj);

                /* discard */
                const discPileOffset = new THREE.Vector3(-6,-1,0);
                for (const discPiles of discard) {
                    /* place for empty discard piles */
                    const discCardPlace = obj3Ds.cardPlace.clone();
                    discCardPlace.position.copy(discPileOffset);
                    group.add(discCardPlace);
                    /* the actual pile */
                    if (discPiles.length > 0) {
                        const discCards = discPiles
                                            .map(cardToCardObj);
                        discCards.forEach((card, idx) => {
                                                card.rotation.x = Math.PI/12; // tilt up slightly
                                                card.position.addVectors(discCardPlace.position, new Vector3(0,-0.5 * idx,0));
                                            });
                        group.add(...discCards);
                    }
                    discPileOffset.x += 3;
                }
            }
            scene.add(...stuffInScene);
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

/* Peer to peer, host/client stuff */

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
        this.peer = null;
        this.hostId = 'local-host';
    }
    /* Connect to peering server, open to remote connections */
    open(hostIdCb) {
        this.peer = new Peer();
        this.peer.on('open', (id) => {
            this.hostId = id;
            console.log('Host ID is: ' + id);
            hostIdCb(id);
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
        if (this.peer != null) {
            this.peer.disconnect(); /* TODO - do this once connection established? */
            this.peer.destroy();
        }
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
                gameScene.update(this.gameView);
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

let host = {};
let client = {};
let currLocalClient = 0;
let localClients = [];

const keyDownFunc = {
    left() {
        if (testing) {
            currLocalClient = (currLocalClient + localClients.length - 1) % localClients.length;
            client = localClients[currLocalClient];
            gameScene.update(client.gameView);
        } 
    },
    right() {
        if (testing) {
            currLocalClient = (currLocalClient + 1) % localClients.length;
            client = localClients[currLocalClient];
            gameScene.update(client.gameView);
        }
    },
    refresh() {
        gameScene.update(client.gameView);
    }
};

function testGame(name) {
    testing = true;
    host = new Host();
    localClients = [
        new LocalClient(host, name),
        new LocalClient(host, 'Bob'),
        new LocalClient(host, 'Charlie'),
        new LocalClient(host, 'Denise'),
    ];
    client = localClients[currLocalClient];
    startGame();
    /* fix visual bug of wrong client being displayed */
    gameScene.update(client.gameView);
}

function createGame(name) {
    host = new Host();
    client = new LocalClient(host, name);
    changeScreen(SCREENS.LOBBY);
}

function joinGame(hostId, name) {
    client = new RemoteClient(hostId, name);
}

function startGame() {
    client.send({ type: CLIENTPACKET.STARTGAME, data: {} });
}

function openGame() {
    lobbyIdDiv.hidden = false;
    openGameButton.disabled = true;
    changeScreen(SCREENS.LOADING);
    host.open(goToLobby);
}
function goToLobby(id) {
    changeScreen(SCREENS.LOBBY);
    lobbyPeerId.value = id;
}

/* UI */
const mainScreen = document.getElementById('screen-main');
const mainDisplayName = document.getElementById('main-display-name');
const createButton = document.getElementById('button-create');
const mainPeerId = document.getElementById('main-peer-id');
const joinButton = document.getElementById('button-join');
const testButton = document.getElementById('button-test');

const loadingScreen = document.getElementById('screen-loading');

const lobbyScreen = document.getElementById('screen-lobby');
const lobbyPeerId = document.getElementById('lobby-peer-id');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const lobbyIdDiv = document.getElementById('lobby-id-div');
const startGameButton = document.getElementById('button-start-game');
const disconnectButton = document.getElementById('button-disconnect');
const openGameButton = document.getElementById('button-open-game');
//const addLocalPlayerButton = document.getElementById('button-add-local-player');

const gameScreen = document.getElementById('screen-game');
const leaveGameButton = document.getElementById('button-leave-game');
const endGameButton = document.getElementById('button-end-game');
const gameSceneContainer = document.getElementById('game-scene-container');

const screens = [mainScreen, lobbyScreen, loadingScreen, gameScreen];
const adminElements = [startGameButton, endGameButton, openGameButton];
const nonAdminElements = [leaveGameButton];
const testElements = [testButton/*, addLocalPlayerButton*/];

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
    testButton.onclick = function() {
        changeScreen(SCREENS.LOADING);
        testGame("Alice");
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
    openGameButton.onclick = openGame;
    startGameButton.onclick = startGame;
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
    changeScreen(SCREENS.MAIN);
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
        initObj3Ds();
        initLoadingScene();
        initGameScene();
        initUI();
        initInput();
    });
}

init();