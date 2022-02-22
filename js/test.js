const TEST_LOCAL_LATENCY = 500;
let testing = false;

const testingKeyDownFunc = {
    k() {
        const kingHand = [{value:13, suite:0},{value:13, suite:1},{value:13, suite:2},{value:13, suite:3}];
        host.game.state.players[currLocalClient].hand = kingHand;
        client.gameScene.gameView.players[currLocalClient].hand = kingHand;
    },
    left() {
        currLocalClient = (currLocalClient + 1) % localClients.length;
        client = localClients[currLocalClient];
        client.gameScene.updateHTMLUI();
        windowResize();
    },
    right() {
        currLocalClient = (currLocalClient + localClients.length - 1) % localClients.length;
        client = localClients[currLocalClient];
        client.gameScene.updateHTMLUI();
        windowResize();
    },
    up() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]++;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
        client.gameScene.updateMyHandTransform();
    },
    down() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]--;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
        client.gameScene.updateMyHandTransform();
    },
    plus() {
        client.gameScene.animSpeed *= 1.3;
        client.gameScene.animSpeed = client.gameScene.animSpeed > ANIM_SPEED_MAX ? ANIM_SPEED_MAX : client.gameScene.animSpeed;
        client.gameScene.animSpeed = client.gameScene.animSpeed < ANIM_SPEED_MIN ? ANIM_SPEED_MIN : client.gameScene.animSpeed;
    },
    minus() {
        client.gameScene.animSpeed *= 0.7;
        client.gameScene.animSpeed = client.gameScene.animSpeed > ANIM_SPEED_MAX ? ANIM_SPEED_MAX : client.gameScene.animSpeed;
        client.gameScene.animSpeed = client.gameScene.animSpeed < ANIM_SPEED_MIN ? ANIM_SPEED_MIN : client.gameScene.animSpeed;
    },
    refresh() {
        windowResize();
    }
};

function testGame(num) {
    testing = true;
    host = new Host();
    localClients = Array.from(Array(num), (_,i) =>
        new LocalClient(host,
                        `Bob${i}`,
                        (id) => {
                            if (i == 0) {
                                goToLobby(id);
                            }
                        },
                        (roomInfo, _) => {
                            if (i == 0) {
                                populateLobby(roomInfo, true);
                            }
                        },
                        () => {
                            if (i == 0) {
                                changeScreen(SCREENS.MAIN);
                            }
                        },
                        true));
    /* this client connects but doesn't send info; should be dropped when game starts */
    const fakeClient = new LocalClient(host, 'Charles', () => {}, () => {}, () => {}, false);
    currLocalClient = 0;
    client = localClients[currLocalClient];
}

function test() {
    const num = parseInt(prompt('Num players:'), 10);
    if (num != NaN && num >= MIN_PLAYERS && num <= MAX_PLAYERS) {
        testGame(num);
    }
}
