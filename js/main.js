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

const localStorage = window.localStorage;

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 1;
const PLAYER_COLORS = [
    '#dc143c','#6495ed','#7fff00', '#ff8c00','#ba55d3','#2e8b57'
];

const MAX_NAME_LEN = 16;

let testing = false;
let appScreen = SCREENS.INVALID;

function animate(t) {
    if (appScreen == SCREENS.LOADING || appScreen == SCREENS.GAME) {
        requestAnimationFrame(animate);
    }

    if (appScreen == SCREENS.LOADING) {
        loadingScene.animate(t);
    } else if (appScreen == SCREENS.GAME) {
        const gameScene = client.gameScene;
        gameScene.animate(t);
    }
};

/* Peer to peer, host/client stuff */

/* connection to a local player */
LocalConn.count = 0;
function LocalConn(rcvFn, closeFn) {
    this.id = `${LocalConn.count}-local`;
    LocalConn.count++;
    /* Host does stuff on these callbacks */
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
    /* Host uses this to send data to client */
    this.send = rcvFn;
    this.close = closeFn;
}

class Host {
    constructor() {
        this.nextPlayerId = 0;
        this.nextColor = 0;
        this.game = null;
        this.players = {};
        this.playersByConn = {};
        this.turn = 0;
        this.peer = null;
        this.hostId = 'local-host';
        this.inLobby = true;
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
            this.addRemotePlayer(conn);
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
    reconnectPlayer(conn, connId, oldConnId) {
        if (this.playersByConn.hasOwnProperty(oldConnId)) {
            const player = this.playersByConn[oldConnId];
            player.conn = conn;
            player.connId = connId;
            player.connected = true;
            player.reconnected = true;
            this.playersByConn[connId] = player;
            delete this.playersByConn[oldConnId];
            return true;
        } else {
            return false;
        }
    }
    addPlayer(conn, connId) {
        if (Object.keys(this.players).length >= MAX_PLAYERS) {
            return false;
        }
        if (!this.inLobby) {
            if (conn.metadata != undefined && conn.metadata.hasOwnProperty('connId')) {
                return this.reconnectPlayer(conn, connId, conn.metadata.connId);
            } else {
                return false;
            }
        }
        const color = this.nextColor;
        const playerId = this.nextPlayerId;
        const player = {
            conn,
            connId,
            name: "Unknown",
            color,
            id: playerId,
            connected: true,
            reconnected: false,
            haveInfo: false,
            isAdmin: false,
        };
        this.players[playerId] = player;
        this.playersByConn[connId] = player;

        while (this.players[this.nextPlayerId] != undefined) {
            this.nextPlayerId = (this.nextPlayerId + 1) % MAX_PLAYERS;
        }
        while (this.players[this.nextColor] != undefined) {
            this.nextColor = (this.nextColor + 1) % MAX_PLAYERS;
        }
        return true;
    }
    /* Add a player with an existing PeerJs connection */
    addRemotePlayer (conn) {
        const connId = conn.peer;
        if (!this.addPlayer(conn, connId)) {
            conn.close();
            return;
        }
        console.log('Player connected');
        conn.on('data', (data) => {
            this.receive(connId, data);
        });
        conn.on('close', () => {
            if (this.inLobby) {
                this.removePlayer(connId);
            } else {
                this.disconnectPlayer(connId);
            }
        });
        conn.on('error', (err) => {
            console.error('Error in remote player connection');
            console.error(this.playersByConn[connId]);
            console.error(err);
        });
    }
    /* Add a player with a LocalConn */
    addLocalPlayer(conn) {
        const connId = conn.id;
        if (!this.addPlayer(conn, connId)) {
            conn.close();
            return;
        }
        conn.onData = (data) => {
            this.receive(connId, data);
        }
        conn.onClose = () => {
            if (this.inLobby) {
                this.removePlayer(connId);
            } else {
                this.disconnectPlayer(connId);
            }
        }
        conn.onError = (err) => {
            console.error('Error in local player connection');
            console.error(this.playersByConn[connId]);
            console.error(err);
        }
    }
    removePlayer(connId) {
        const player = this.playersByConn[connId];
        const playerId = this.playersByConn[connId].id
        player.conn.close();
        delete this.playersByConn[connId];
        delete this.players[playerId];
        this.broadcast((id) => this.packetRoomInfo(id));
        console.log('Player left');
    }
    disconnectPlayer(connId) {
        const player = this.playersByConn[connId];
        player.connected = false;
        player.conn.close();
        this.broadcast((id) => this.packetRoomInfo(id));
        console.log('Player disconnected');
    }
    close() {
        if (this.peer != null) {
            this.peer.disconnect(); /* TODO - do this once connection established? */
            this.peer.destroy();
        }
    }
    broadcast(packetFn) {
        for (const {conn, id, connected} of Object.values(this.players)) {
            if (connected) {
                conn.send(packetFn(id));
            }
        };
    }
    packetRoomInfo(id) {
        const player = this.players[id];
        return {
            type: HOSTPACKET.ROOMINFO,
            data: { 
                    connId: player.connId,
                    players: Object.values(this.players)
                                .filter(({haveInfo}) => haveInfo)
                                .reduce((obj, {name, id, isAdmin, color, connected}) => {
                                    obj[id] = {name, id, isAdmin, color, connected};
                                    return obj;
                                }, {})
                  },
        };
    }
    packetGameStart(id) {
        return {
            type: HOSTPACKET.GAMESTART,
            data: this.game.toView(id),
        };
    }
    packetGameMove(id, move, playerId) {
        return {
            type: HOSTPACKET.MOVE,
            data: {
                move,
                playerId: playerId,
                gameView: this.game.toView(id),
            }
        };
    }
    /* Handle messages from the client */
    receive(connId, data) {
        const player = this.playersByConn[connId];
        switch(data.type) {
            case CLIENTPACKET.PLAYERINFO:
                console.debug('Received player info');
                if (!player.haveInfo) {
                    player.name = data.data.name.replace(/[^a-zA-Z0-9_\- ]+/g, "").slice(0, MAX_NAME_LEN);
                    player.haveInfo = true;
                    /* first player is admin */
                    const numHaveInfo = Object.values(this.players).reduce((prev, {haveInfo}) => haveInfo ? prev + 1 : prev, 0);
                    if (numHaveInfo == 1) {
                        player.isAdmin = true;
                    }
                    this.broadcast((id) => this.packetRoomInfo(id));
                } else if (player.reconnected) {
                    /* tell everyone they reconnected and tell them the room details */
                    this.broadcast((id) => this.packetRoomInfo(id));
                    /* tell reconnected player to start their game and give them the game view */
                    player.conn.send(this.packetGameStart(player.id));
                    player.reconnected = false;
                }
                break;
            case CLIENTPACKET.STARTGAME:
                console.debug('Received start game');
                if (this.game == null && player.isAdmin) {
                    this.inLobby = false;
                    /* remove any players whom we don't have info for yet */
                    const notHaveInfoIds = Object.keys(this.playersByConn).filter(connId => !this.playersByConn[connId].haveInfo);
                    for (const connId of notHaveInfoIds) {
                        const player = this.playersByConn[connId];
                        const playerId = player.id
                        delete this.playersByConn[connId];
                        delete this.players[playerId];
                        player.conn.close();
                    }
                    this.game = new Game(this.players);
                    this.game.start();
                    this.broadcast((id) => this.packetGameStart(id));
                }
                break;
            case CLIENTPACKET.MOVE:
                console.debug('Received game move');
                if (this.game != null && this.game.started) {
                    const playerId = player.id;
                    if (this.game.move(data.data, playerId)) {
                        this.broadcast((id) => this.packetGameMove(id, data.data, playerId));
                    }
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
        this.gameScene = new GameScene(gameCanvas);
        this.inLobby = true;
        this.playerDomNames = {};
    }
    /* Handle messages from the host */
    receive(data) {
        switch(data.type) {
            case HOSTPACKET.ROOMINFO:
                console.debug('Received roomInfo');
                this.roomInfo = data.data;
                if (this.inLobby) {
                    localStorage.setItem('hostConnection', JSON.stringify({hostId: this.hostId, connId: this.roomInfo.connId}));
                    populateLobby(Object.values(this.roomInfo.players), this.isAdmin);
                } else {
                    this.gameScene.updateRoomInfo(this.roomInfo);
                }
                break;
            case HOSTPACKET.GAMESTART:
                console.debug('Received game start');
                if (!this.gameScene.started) {
                    this.gameScene.start(data.data, this.roomInfo);
                    this.inLobby = false;
                    goToGame();
                }
                break;
            case HOSTPACKET.MOVE:
                console.debug('Received game move');
                if (this.gameScene.started) {
                    const {move, gameView, playerId} = data.data;
                    this.gameScene.updateGameView(gameView);
                }
                break;
            default:
                console.warn('Unknown host packet received');
        }
    }

    sendPacketMove(move) {
        this.send({
            type: CLIENTPACKET.MOVE,
            data: move
        });
    }
}

class LocalClient extends Client {
    constructor(host, name, sendInfo) {
        super(name, true);
        this.host = host;
        this.conn = new LocalConn((data) => { this.receive(data); }, () => { this.hostClosed(); });
        this.host.addLocalPlayer(this.conn);
        if (sendInfo == undefined || sendInfo == true) {
            this.send({type: CLIENTPACKET.PLAYERINFO, data: this.playerInfo});
        }
    }
    send (data) {
        this.conn.onData(data);
    }
    hostClosed() {
        console.log(`'${this.playerInfo.name}': Host disconnected me`);
        changeScreen(SCREENS.MAIN);
    }
    close () {
        this.conn.onClose();
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

            const hostConnection = localStorage.getItem('hostConnection');
            this.conn = this.peer.connect(this.hostId, {reliable:true});
            if (hostConnection != null) {
                const { hostId, connId } = JSON.parse(hostConnection);
                if (hostId == this.hostId) {
                    this.conn.metadata = { connId };
                }
            }
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
        } 
    },
    right() {
        if (testing) {
            currLocalClient = (currLocalClient + 1) % localClients.length;
            client = localClients[currLocalClient];
        }
    },
    up() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]++;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
    },
    down() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]--;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
    },
    refresh() {
        //client.gameScene.update(client.gameView);
    }
};

function testGame(num) {
    testing = true;
    host = new Host();
    localClients = Array.from(Array(num), (_,i) => new LocalClient(host, `Bob${i}`));
    /* this client connects but doesn't send info; should be dropped when game starts */
    const fakeClient = new LocalClient(host, 'Charles', false);
    client = localClients[currLocalClient];
    startGame();
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
const loadingCanvas = document.getElementById('canvas-loading');

const lobbyScreen = document.getElementById('screen-lobby');
const lobbyPeerId = document.getElementById('lobby-peer-id');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const lobbyIdDiv = document.getElementById('lobby-id-div');
const startGameButton = document.getElementById('button-start-game');
const disconnectButton = document.getElementById('button-disconnect');
const openGameButton = document.getElementById('button-open-game');
//const addLocalPlayerButton = document.getElementById('button-add-local-player');

const gameScreen = document.getElementById('screen-game');
const gameCanvas = document.getElementById('canvas-game');
const gameSceneContainer = document.getElementById('game-scene-container');
const gameUI = document.getElementById('game-ui');
const leaveGameButton = document.getElementById('button-leave-game');

const screens = [mainScreen, lobbyScreen, loadingScreen, gameScreen];
const adminElements = [startGameButton, openGameButton];
const nonAdminElements = [];
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
        /* TODO show color */
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
        testGame(Number(prompt('Num players:')));
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
        initLoadingScene(loadingCanvas);
        initInput();
        initUI();
    });
}

init();