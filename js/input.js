const keyToInputMap = Object.freeze({
    'ArrowLeft':    'left',
    'ArrowRight':   'right',
    'ArrowDown':    'down',
    'ArrowUp':      'up',
    'Escape':       'esc',
    'p':            'pause',
    ' ':            'refresh',
    '`':            'debug',
    '.':            'nextFrame',
    'x':            'x',
    'y':            'y',
    'z':            'z',
});

const rawInput = {
    pointer: {
        pos: {x: 0, y: 0},
        left: false,
        right: false,
    },
    activeTouch: null,
    touches: {},
    left: false,
    right: false,
    down: false,
    up: false,
    esc: false,
    pause: false,
    refresh: false,
    debug: false,
    nextFrame: false,
    x: false,
    y: false,
    z: false,
};

function resetRawInput() {
    Object.values(keyToInputMap).forEach((k) => {
        rawInput[k] = false;
    });
    rawInput.pointer.left = false;
    rawInput.pointer.right = false;
    rawInput.pointer.activeTouch = null;
    rawInput.pointer.touches = {};
}

function mouseEventPosToNormalizeDevicePos(x,y) {
    const xPixel = x - gameCanvas.offsetLeft;
    const yPixel = y - gameCanvas.offsetTop;
    return {
        x: xPixel/gameCanvas.clientWidth * 2 - 1,
        y: - yPixel/gameCanvas.clientHeight * 2 + 1
    };
}

const inputFn = {
keydown(event) {
    var inputName = keyToInputMap[event.key];
    if (inputName) {
        if (!rawInput[inputName]) {
            if (testing && testingKeyDownFunc[inputName]) {
                testingKeyDownFunc[inputName]();
            }
            rawInput[inputName] = true;
        }
    }
},
keyup(event) {
    var inputName = keyToInputMap[event.key];
    if (inputName) {
        rawInput[inputName] = false;
    }
},
mousemove(event) {
    event.preventDefault();
    rawInput.pointer.pos = mouseEventPosToNormalizeDevicePos(event.x, event.y);
},
mousedown(event) {
    event.preventDefault();
    rawInput.pointer.pos = mouseEventPosToNormalizeDevicePos(event.x, event.y);
    switch (event.button) {
        case 0:
            rawInput.pointer.left = true;
            break;
        case 2:
            rawInput.pointer.right = true;
            break;
    }
},
mouseup(event) {
    event.preventDefault();
    rawInput.pointer.pos = mouseEventPosToNormalizeDevicePos(event.x, event.y);
    switch (event.button) {
        case 0:
            rawInput.pointer.left = false;
            break;
        case 2:
            rawInput.pointer.right = false;
            break;
    }
},
touchstart(event) {
    event.preventDefault();
    for (touch of event.changedTouches) {
        const pos = mouseEventPosToNormalizeDevicePos(touch.pageX, touch.pageY);
        rawInput.touches[touch.identifier] = {
            pos
        };
        if (rawInput.activeTouch == null) {
            rawInput.activeTouch = touch.identifier;
            rawInput.pointer.pos = pos;
            rawInput.pointer.left = true;
        }
    }
},
touchmove(event) {
    event.preventDefault();
    for (touch of event.changedTouches) {
        const touchObj = rawInput.touches[touch.identifier];
        touchObj.pos = mouseEventPosToNormalizeDevicePos(touch.pageX, touch.pageY);
        if (rawInput.activeTouch == touch.identifier) {
            rawInput.pointer.pos = touchObj.pos;
        }
    }
},
touchend(event) {
    doTouchEnd(event);
},
touchcancel(event) {
    doTouchEnd(event);
}
};

function doTouchEnd(event) {
    event.preventDefault();
    for (touch of event.changedTouches) {
        delete rawInput.touches[touch.identifier];
    }
    if (!rawInput.touches.hasOwnProperty(rawInput.activeTouch)) {
        const ids = Object.keys(rawInput.touches);
        if (ids.length > 0) {
            rawInput.activeTouch = parseInt(ids[0], 10);
            rawInput.pointer.pos = rawInput.touches[rawInput.activeTouch].pos;
        } else {
            rawInput.activeTouch = null;
            rawInput.pointer.left = false;
        }
    }
}

function initInput() {
    [
        'mousemove',
        'mousedown',
        'mouseup',
        'touchstart',
        'touchmove',
        'touchend',
        'touchcancel',
    ].forEach(s => {
        gameCanvas.addEventListener(s, inputFn[s], false);
    });
    [
        'keydown',
        'keyup',
    ].forEach(s => {
        window.addEventListener(s, inputFn[s], false);
    });
    document.addEventListener('mouseout', (e) => {resetRawInput();}, false);
}