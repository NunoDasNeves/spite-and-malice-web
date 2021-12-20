const SCREENS = Object.freeze({
    INVALID: -1,
    INIT: 0,
    MAIN: 1,
    LOADING: 2,
    LOBBY: 3,
    GAME: 4,
});

const localStorage = window.localStorage;

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 1;
const PLAYER_COLORS = [
    '#dc143c','#6495ed','#7fff00', '#ff8c00','#ba55d3','#2e8b57'
];

const MAX_NAME_LEN = 16;

let appScreen = SCREENS.INVALID;

function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen()
                .catch((err) => {
                    console.error(`Fullscreen request failed due to '${err.name}':\n ${err.message}`);
                });
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

const LOG_LEVELS = [
    ['log','#dcdcdc'],
    ['warn','#ffaa00'],
    ['error','#ff3333'],
    ['debug','#2288ff'],
];
function initLog() {
    console.logs = [];
    console.prevMsg = '';
    for (const [level, color] of LOG_LEVELS) {
        const replaceFnName = `std${level}`;
        console[replaceFnName] = console[level].bind(console);
        console[level] = function() {
            console[replaceFnName].apply(console, arguments);
            const str = Array.from(arguments)
                            .map((v) => {
                                    if (v === undefined) {
                                        return 'undefined';
                                    }
                                    if (v === null) {
                                        return 'null';
                                    }
                                    if (typeof v === 'object') { 
                                        return JSON.stringify(v);
                                    }
                                    return v.toString();
                                })
                            .join(' ');
            if (str === console.prevMsg) {
                const msg = consoleMessages.lastElementChild;
                const counter = msg.lastElementChild;
                const count = parseInt(counter.innerText, 10);
                counter.innerHTML = (count + 1).toString(10);
                counter.hidden = false;
            } else {
                console.prevMsg = str;
                const msg = document.createElement('div');
                msg.style.backgroundColor = color;
                msg.className = 'console-message';
                msg.innerHTML = `<span>${str}</span><span style='float:right' hidden>1</span>`;
                consoleMessages.appendChild(msg);
                consoleMessages.scrollTo({top: consoleMessages.scrollHeight, left: 0, behavior: 'smooth'});
            }
        }
    }
}

let resizing = false;
const RESIZE_DELAY_MS = 200;

function windowResize() {
    resizing = false;
    switch (appScreen) {
        case (SCREENS.INIT):
        case (SCREENS.MAIN):
        case (SCREENS.LOBBY):
            break;
        case (SCREENS.LOADING):
            loadingScene.resize();
            break;
        case (SCREENS.GAME):
            client.gameScene.resize();
            break;
        default:
            console.warn('unknown screen');
    }
}

window.addEventListener('resize', () => {
    if (resizing) {
        return;
    }
    resizing = true;
    setTimeout(() => {windowResize();}, RESIZE_DELAY_MS);
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        fullscreenButton.value = 'enter fullscreen';
    } else {
        fullscreenButton.value = 'exit fullscreen';
    }
    windowResize();
});

function lerpColor(c0, c1, t) {
    const r0 = (c0 & 0xff0000) >> 16,
          g0 = (c0 & 0x00ff00) >> 8,
          b0 = (c0 & 0x0000ff);
    const r1 = (c1 & 0xff0000) >> 16,
          g1 = (c1 & 0x00ff00) >> 8,
          b1 = (c1 & 0x0000ff);
    const r = Math.floor(r0 + (r1 - r0) * t),
          g = Math.floor(g0 + (g1 - g0) * t),
          b = Math.floor(b0 + (b1 - b0) * t);
    return r << 16 | g << 8 | b;
}

function animate(t) {
    if (appScreen == SCREENS.LOADING || appScreen == SCREENS.GAME) {
        requestAnimationFrame(animate);
    }

    if (appScreen == SCREENS.LOADING) {
        loadingScene.animate(t);
    } else if (appScreen == SCREENS.GAME) {
        const gameScene = client.gameScene;
        gameScene.animate(t);

        if (gameScene.statusHTML != null) {
            statusMessage.hidden = false;
            statusMessage.innerHTML = gameScene.statusHTML;
        } else {
            statusMessage.hidden = true;
        }

        if (winnerBanner.hidden == false) {
            {
                const p = (t % 1000)/1000 * Math.PI * 2;
                const s = Math.sin(p);
                winnerBanner.style.fontSize = `${2.5 + 0.3*s}em`;
            }
            {
                const p = (t % 3000)/3000 * Math.PI * 2;
                const s = Math.sin(p);
                const a = (s + 1) / 2;
                const color = `#${Math.floor(lerpColor(0xffff00, 0xff00ff, a)).toString(16).padStart(6,'0')}`
                winnerBanner.style.color = color;
            }
        }
    }
};

let host = null;
let client = null;
let currLocalClient = 0;
let localClients = null;

function createGame(name) {
    host = new Host();
    client = new LocalClient(host, name, goToLobby, () => {changeScreen(SCREENS.MAIN);}, true);
}

function joinGame(hostId, name) {
    client = new RemoteClient(hostId, name, goToLobby, () => {changeScreen(SCREENS.MAIN);});
}

function startGame() {
    client.send({ type: CLIENTPACKET.STARTGAME, data: {} });
}

/* open game to remote players */
function openGame() {
    lobbyIdDiv.hidden = false;
    openGameButton.disabled = true;
    changeScreen(SCREENS.LOADING);
    host.open((id) => {
        changeScreen(SCREENS.LOBBY);
        lobbyPeerId.value = id;
    });
}

function goToLobby(id) {
    changeScreen(SCREENS.LOBBY);
    lobbyPeerId.value = id;
    lobbyIdDiv.hidden = true;
    openGameButton.disabled = false;
}

function showWinner(name) {
    winnerBanner.innerHTML = `${name} wins!`;
    winnerBanner.hidden = false;
    const {x, y} = client.gameScene.getWinnerBannerPos();
    /* use vw/vh in case aspect changes after we show it... */
    //winnerBanner.style.left = `${x/gameCanvas.width*100}vw`;
    winnerBanner.style.top = `${y/gameCanvas.height*100}vh`;
    backToLobbyButton.hidden = false;
    leaveGameButton.hidden = true;
}

function goToGame() {
    winnerBanner.hidden = true;
    backToLobbyButton.hidden = true;
    leaveGameButton.hidden = false;
    resetRawInput();
    changeScreen(SCREENS.GAME);
}

/* UI */
const initScreen = document.getElementById('screen-init');
const loadingBar = document.getElementById('loading-bar');

const globalUI = document.getElementById('ui-global');
const consoleMessages = document.getElementById('console-messages');
const consoleButton = document.getElementById('button-console');
const fullscreenButton = document.getElementById('button-fullscreen');

const mainScreen = document.getElementById('screen-main');
const mainDisplayName = document.getElementById('main-display-name');
const createButton = document.getElementById('button-create');
const mainPeerId = document.getElementById('main-peer-id');
const joinButton = document.getElementById('button-join');
const testButton = document.getElementById('button-test');

const loadingScreen = document.getElementById('screen-loading');
const loadingCanvas = document.getElementById('canvas-loading');

const lobbyScreen = document.getElementById('screen-lobby');
const lobbyStatus = document.getElementById('lobby-status');
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
const backToLobbyButton = document.getElementById('button-back-to-lobby');
const winnerBanner = document.getElementById('winner-banner');
const statusMessage = document.getElementById('status-message');

const screens = [initScreen, mainScreen, lobbyScreen, loadingScreen, gameScreen];
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
        case SCREENS.INIT:
            initScreen.hidden = false;
            break;
        case SCREENS.MAIN:
            mainScreen.hidden = false;
            testing = false;
            break;
        case SCREENS.LOADING:
            requestAnimationFrame(animate);
            loadingScreen.hidden = false;
            break;
        case SCREENS.LOBBY:
            hideAdminElements(client.isAdmin);
            lobbyScreen.hidden = false;
            break;
        case SCREENS.GAME:
            requestAnimationFrame(animate);
            hideAdminElements(client.isAdmin);
            gameScreen.hidden = false;
            break;
        default:
            console.error('screen does not exist: ' + screen);
    }
    appScreen = newScreen;
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
        if (players.length >= MIN_PLAYERS) {
            startGameButton.disabled = false;
        } else {
            startGameButton.disabled = true;
        }
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
        createGame(mainDisplayName.value);
    }
    testButton.onclick = test;
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
        if (host != null) {
            if (confirm("Are you sure? This will end the game for all players!")) {
                if (testing) {
                    for (const c of localClients) {
                        c.close();
                    }
                } else {
                    client.close();
                }
                host.close();
            }
        } else {
            if (confirm("Are you sure?")) {
                client.close();
            }
        }
    }
    backToLobbyButton.onclick = function() {
        changeScreen(SCREENS.LOBBY);
    }
    consoleButton.onclick = function() {
        consoleMessages.hidden = !consoleMessages.hidden;
    }
    lobbyPeerId.onclick = function() {
        lobbyPeerId.select();
        lobbyPeerId.setSelectionRange(0,999);
        const msg = 'Copied to clipboard';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(lobbyPeerId.value)
                .then(function() {
                    lobbyStatus.innerHTML = msg;
                });
        } else {
            if (document.execCommand('copy')) {
                lobbyStatus.innerHTML = msg;
            }
        }
    }
    fullscreenButton.onclick = toggleFullscreen;
    globalUI.hidden = false;
}

function hideAdminElements(isAdmin) {
    for (const el of adminElements) {
        el.hidden = !isAdmin;
    }
    for (const el of nonAdminElements) {
        el.hidden = isAdmin;
    }
}

const progressTick = function() {
    const PROGRESS_TICKS = getAssetLoaderTicks() + 4;
    const PROGRESS_TICK_WIDTH = 100/PROGRESS_TICKS;
    let progress = 0;
    return function progressTick() {
        progress += PROGRESS_TICK_WIDTH;
        loadingBar.style.width = `${progress}%`;
    }
}();

const INIT_DELAY_MS = 200;

function init() {
    changeScreen(SCREENS.INIT);
    initLog();
    progressTick();
    loadAssets(() => {
        initObj3Ds();
        progressTick();
        initLoadingScene(loadingCanvas);
        progressTick();
        initInput();
        progressTick();
        initUI();
        /* put a teeny delay so you see the full loading bar */
        setTimeout(() => {changeScreen(SCREENS.MAIN);}, INIT_DELAY_MS);
    }, progressTick);
}

init();
