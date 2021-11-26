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

const SCREENS = {
    INVALID: -1,
    LOADING: 0,
    MAIN: 1,
    LOBBY: 2,
    GAME: 3,
};

var gameScreen = SCREENS.INVALID;

const CLIENTPACKET = {
    PLAYERINFO: 0,
};

const HOSTPACKET = {
    ROOMINFO: 0,
};

function Host() {
    this.localCount = 0;
    this.players = {};
    this.turn = 0;
    this.peer = new Peer();
    this.onGetHostId = () => {};

    this.peer.on('open', (id) => {
        this.hostId = id;
        console.log('Host ID is: ' + id);
        this.onGetHostId(id);
    });
    this.peer.on('connection', (conn) => {
        this.addRemotePlayer(conn);
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
    };
    console.log('Player connected');

    conn.on('data', (data) => {
        this.send(playerId, data);
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

LocalConn.count = 0;
function LocalConn(sendFn) {
    this.id = `${LocalConn.count}-local`;
    /* Host does stuff on these callbacks */
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
    /* Host uses this to send data to client */
    this.send = sendFn;
}

/* Add a player with a LocalConn */
Host.prototype.addLocalPlayer = function(conn, info) {
    var playerId = conn.id;
    this.localCount++;
    this.players[playerId] = {
        conn,
        info: DEFAULT_PLAYER_INFO,
    };
    conn.onData = (data) => {
        this.send(playerId, data);
    }
    conn.onClose = () => {
        this.removePlayer(playerId);
    }
    conn.onError = (err) => {
        console.error('Error in local player connection');
        console.error(this.players[playerId]);
        console.error(err);
    }
    this.send(playerId, {type: CLIENTPACKET.PLAYERINFO, data: info});
}

Host.prototype.removePlayer = function(playerId) {
    delete this.player[playerId];
    this.broadcastPlayerList();
    console.log('Player left');
}

/* receive data...it's called send() though */
Host.prototype.send = function(playerId, data) {
    switch(data.type) {
        case CLIENTPACKET.PLAYERINFO:
            this.players[playerId].info = data.data;
            this.broadcastRoomInfo();
            break;
        default:
            console.warn('Unknown packet received');
    }
}

Host.prototype.broadcastRoomInfo = function() {
    var packet = {
        type: HOSTPACKET.ROOMINFO,
        data: Object.values(host.players).map((p) => p.info)
    };
    Object.values(host.players).forEach(({conn}) => {
        conn.send(packet);
    });
}

/* create a connection with a remote host, send them player info, forward data to the client */
function RemoteHost(hostId, client) {
    this.playerId = '';
    this.hostId = hostId;
    this.peer = new Peer();
    this.conn = null;
    this.client = client;
    this.onGetHostId = (id) => {};

    this.peer.on('open', (id) => {
        this.playerId = id;
        console.log('My player ID is: ' + id);
        console.log('Attempting to connect to ' + this.hostId);
        this.conn = this.peer.connect(this.hostId, {reliable:true});
        this.conn.on('open', () => {
            console.log('Connected to host');
            this.conn.send({type: CLIENTPACKET.PLAYERINFO, data: client.playerInfo});
            this.onGetHostId(hostId);
        });
        this.conn.on('data', (data) => {
            this.client.send(data);
        });
        this.conn.on('close', () => {
            console.log('Host connection was closed');
        });
        this.conn.on('error', (err) => {
            console.error('Error in host connection')
            console.error(err);
        });
    });
    this.peer.on('error', (err) => {
        console.error('Peer error');
        console.error(err);
    });
}

RemoteHost.prototype.send = function(data) {
    this.conn.send(data);
}

/* The local client who talks to either Host or RemoteHost */
function Client(name) {
    this.playerInfo = { name };
    this.roomInfo = {};
}

Client.prototype.send = function(data) {
    switch(data.type) {
        case HOSTPACKET.ROOMINFO:
            this.roomInfo = data.data;
            break;
        default:
            console.warn('Unknown packet received');
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

var host = {};
var client = {};

function goToLobby(id) {
    lobbyPeerId.value = id;
    changeScreen(SCREENS.LOBBY);
}

function createGame(name) {
    client = new Client(name);
    host = new Host();
    host.onGetHostId = goToLobby;
    var localConn = new LocalConn((data) => { client.send(data); });
    host.addLocalPlayer(localConn, client.playerInfo);
}

function joinGame(hostId, name) {
    client = new Client(name);
    host = new RemoteHost(hostId, client);
    host.onGetHostId = goToLobby;
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

var screens = [mainScreen, lobbyScreen, loadingScreen];

function changeScreen(newScreen) {
    if (newScreen == gameScreen) {
        return;
    }
    screens.forEach(function(el) {
        el.hidden = true;
    });
    gameScreen = newScreen;
    switch(newScreen) {
        case SCREENS.MAIN:
            mainScreen.hidden = false;
            break;
        case SCREENS.LOADING:
            loadingScene.animate();
            loadingScreen.hidden = false;
            break;
        case SCREENS.LOBBY:
            lobbyScreen.hidden = false;
            break;
        default:
            console.error('screen does not exist: ' + screen);
    }
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
    changeScreen(SCREENS.MAIN);
}

function init(){
    initLoadingScene();
    initUI();
}

init();