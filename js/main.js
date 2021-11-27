var loadingScene = {};

function initLoadingScene() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();

    renderer.setSize(window.innerWidth, window.innerHeight);

    loadingScreen.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    const animate = function () {
        if (gameScreen == SCREENS.LOADING) {
            requestAnimationFrame(animate);
        }

        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

        renderer.render(scene, camera);
    };
    loadingScene = {
        animate
    };
}

const SCREENS = Object.freeze({
    LOADING: 0,
    MAIN: 1,
    LOBBY: 2,
    GAME: 3,
});

var gameScreen = SCREENS.MAIN;

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
 * MOVE { type, other fields depending on type }
 * EMOTE { type }
 * 
 * host
 * ROOMINFO { players: [ { name, idx }, { name, idx } ... ] }
 * GAMESTART { full game view }
 * MOVE { playerIdx, move: { type, other fields }, result: { stuff to update game view } }
 * PLAYERLEFT { playerIdx }
 * EMOTE { playerIdx, type }
 * GAMEEND { winnerIdx }
 */
const CLIENTPACKET = Object.freeze({
    PLAYERINFO: 0,
    STARTGAME: 1,
    MOVE: 2,
    EMOTE: 3,
});

const HOSTPACKET = Object.freeze({
    ROOMINFO: 0,
    GAMESTART: 1,
    MOVE: 2,
    PLAYERLEFT: 4,
    EMOTE: 4,
    GAMEEND: 5,
});

function Host() {
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

const DEFAULT_PLAYER_INFO = { name: 'Unknown' };

/* Add a player with an existing PeerJs connection */
Host.prototype.addRemotePlayer = function(conn) {
    var playerId = conn.peer;
    this.players[playerId] = {
        conn,
        info: DEFAULT_PLAYER_INFO,
        isAdmin: false,
    };
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

/* Add a player with a LocalConn */
Host.prototype.addLocalPlayer = function(conn, info) {
    var playerId = conn.id;
    this.players[playerId] = {
        conn,
        info: DEFAULT_PLAYER_INFO,
        isAdmin: true,
    };
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

Host.prototype.removePlayer = function(playerId) {
    delete this.players[playerId];
    this.broadcast(this.packetRoomInfo());
    console.log('Player left');
}

Host.prototype.packetRoomInfo = function() {
    return {
        type: HOSTPACKET.ROOMINFO,
        data: { players: Object.values(this.players).map((p) => p.info) },
    }
}

/* Handle messages from the client */
Host.prototype.receive = function(playerId, data) {
    switch(data.type) {
        case CLIENTPACKET.PLAYERINFO:
            this.players[playerId].info = data.data;
            this.broadcast(this.packetRoomInfo());
            break;
        case CLIENTPACKET.STARTGAME:
            if (this.players[playerId].isAdmin) {
                this.game = new Game(this.players.length);
                this.broadcast({
                    type: HOSTPACKET.GAMESTART,
                    data: {},
                });
            }
            break;
        default:
            console.warn('Unknown client packet received');
    }
}

Host.prototype.close = function() {
    this.peer.disconnect(); /* TODO - do this once connection established? */
    this.peer.destroy();
}

Host.prototype.broadcast = function(packet) {
    Object.values(this.players).forEach(({conn}) => {
        conn.send(packet);
    });
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
                populateLobby(this.roomInfo.players);
                break;
            case HOSTPACKET.GAMESTART:
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

/* server */

/*
function onClientAction() {
    if (isgameAction()) {
        doGameAction();// only if it's that players turn etc
    } else {
        doOtherAction();
    }
    sendStateToPlayers();
}
*/

/* client */

/*
function onLocalAction() {
    sendActionToGame();
    updateLocalGameState(); // if possible
}

function onRemoteAction() {
    updateLocalGameState();
}

function gameLoop(t) {
    requestAnimationFrame(gameLoop);
    doAnimations();                     // animate based on local game state
}
*/

/* */

var client = {};

function createGame(name) {
    var host = new Host();

    client = new LocalClient(host, name);
    hideAdminElements(true);
}

function joinGame(hostId, name) {
    client = new RemoteClient(hostId, name);
    hideAdminElements(false);
}

function startGame() {
    client.send({ type: CLIENTPACKET.STARTGAME, data: {} });
}

/* UI */
var mainScreen = document.getElementById('screen-main');
var mainDisplayName = document.getElementById('main-display-name');
var createButton = document.getElementById('button-create');
var mainPeerId = document.getElementById('main-peer-id');
var joinButton = document.getElementById('button-join');

var loadingScreen = document.getElementById('screen-loading');

var lobbyScreen = document.getElementById('screen-lobby');
var lobbyPeerId = document.getElementById('lobby-peer-id');
var lobbyPlayerList = document.getElementById('lobby-player-list');
var startGameButton = document.getElementById('button-start-game');
var disconnectButton = document.getElementById('button-disconnect');

var gameScreen = document.getElementById('screen-game');
var leaveGameButton = document.getElementById('button-leave-game');
var endGameButton = document.getElementById('button-end-game');

var screens = [mainScreen, lobbyScreen, loadingScreen, gameScreen];
var adminElements = [startGameButton, endGameButton];
var nonAdminElements = [leaveGameButton];

function changeScreen(newScreen) {
    if (newScreen == gameScreen) {
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
            requestAnimationFrame(loadingScene.animate);
            loadingScreen.hidden = false;
            break;
        case SCREENS.LOBBY:
            lobbyScreen.hidden = false;
            break;
        case SCREENS.GAME:
            gameScreen.hidden = false;
            break;
        default:
            console.error('screen does not exist: ' + screen);
    }
    gameScreen = newScreen;
}

function populateLobby(players) {
    while (lobbyPlayerList.firstChild) {
        lobbyPlayerList.removeChild(lobbyPlayerList.firstChild);
    }
    players.forEach(({ name }) => {
        var playerDiv = document.createElement('div');
        playerDiv.innerHTML = name;
        lobbyPlayerList.appendChild(playerDiv);
    });
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
        var hostId = mainPeerId.value.trim();
        changeScreen(SCREENS.LOADING);
        joinGame(hostId, mainDisplayName.value);
    }
    disconnectButton.onclick = function() {
        if (confirm("Are you sure?")) {
            client.close();
        }
    }
    startGameButton.onclick = function() {
        changeScreen(SCREENS.LOADING);
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
    changeScreen(SCREENS.MAIN);
}

function hideAdminElements(isAdmin) {
    for (const el of adminElements) {
        el.hidden = isAdmin;
    }
    for (const el of nonAdminElements) {
        el.hidden = !isAdmin;
    }
}

function init(){
    initLoadingScene();
    initUI();
}

init();