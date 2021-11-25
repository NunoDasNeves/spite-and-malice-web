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

var amHosting = false;

const CLIENTPACKET = {
    INFO: 0,
};

const HOSTPACKET = {
   PLAYERS: 0,
};

var peer = null;

var host = {};

var client = {
    conn: null,
    hostId: '',
    players: [],
};

var playerInfo = {
    name: '',
};

function makePeer() {
    peer = new Peer();
    peer.on('error', function(err) {
        console.error('Peer error');
        console.error(err);
    });
}

function broadcastPlayerList() {
    var packet = {
        type: HOSTPACKET.PLAYERS,
        data: Object.values(host.players).map((p) => p.info)
    };
    Object.values(host.players).forEach(({conn}) => {
        if (conn != null) {
            conn.send(packet);
        }
    });
}

function createGame(callback) {
    makePeer();
    peer.on('open', function(id) {
        callback();
        console.log('Host ID is: ' + id);
        lobbyPeerId.value = id;
    });

    amHosting = true;
    host = {
        players: {},
    };

    /* TODO connection abstraction for local player/AI */
    host.players['local'] = {
        info: playerInfo,
        conn: null,
    };

    peer.on('connection', function(conn) {
        var playerId = conn.peer;
        host.players[playerId] = {
            info: {},
            conn,
        };
        console.log('Player connected');
        conn.on('data', function(data) {
            console.log(data);
            switch(data.type) {
                case CLIENTPACKET.INFO:
                    host.players[playerId].info = data.data;
                    broadcastPlayerList();
                    break;
                default:
                    console.warn('Unknown packet received');
            }
        });
        conn.on('close', function() {
            delete host.player[playerId];
            broadcastPlayerList();
            console.log('Player left');
        });
    });
}

function joinGame(callback) {
    makePeer();
    peer.on('open', function(id) {
        console.log('My player ID is: ' + id);
        console.log('Attempting to connect to ' + client.hostId);
        client.conn = peer.connect(client.hostId, {reliable:true});
        client.conn.on('open', function() {
            lobbyPeerId.value = client.hostId;
            callback();
            console.log('Connected to host');
            client.conn.send({type: CLIENTPACKET.INFO, data: playerInfo});
        });
        client.conn.on('data', function(data) {
            switch(data.type) {
                case HOSTPACKET.PLAYERS:
                    client.players = data.data;
                    break;
                default:
                    console.warn('Unknown packet received');
            }
            console.log(data);
        });
        client.conn.on('close', function() {
            console.log('Host connection was closed');
        });
        client.conn.on('error', function(err) {
            console.error('Error in host connection')
            console.error(err);
        });
    });
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
        playerInfo.name = mainDisplayName.value;
    };
    createButton.onclick = function() {
        changeScreen(SCREENS.LOADING);
        createGame(() => {changeScreen(SCREENS.LOBBY)});
    }
    joinButton.onclick = function() {
        client.hostId = mainPeerId.value.trim();
        changeScreen(SCREENS.LOADING);
        joinGame(() => {changeScreen(SCREENS.LOBBY)});
    }
    changeScreen(SCREENS.MAIN);
}

function init(){
    initLoadingScene();
    initUI();
}

init();