
const fullscreenAPIs = Object.freeze({
    enabled: ["fullscreenEnabled", "webkitFullscreenEnabled", "mozFullScreenEnabled", "msFullscreenEnabled"],
    element: ["fullscreenElement", "webkitCurrentFullScreenElement", "mozFullScreenElement", "msFullscreenElement"],
    request: ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen", "msRequestFullscreen"],
    exit:    ["exitFullscreen", "webkitExitFullscreen", "mozCancelFullScreen", "msExitFullscreen",],
    change: ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"],
    error:  ["fullscreenerror", "webkitfullscreenerror","mozfullscreenerror", "MSFullscreenError"],
});

function supportsFullscreen() {
    for (const en of fullscreenAPIs.enabled) {
        if (document[en] !== undefined) {
            console.debug(en);
            return document[en];
        }
    }
    return false;
}

function isFullscreen() {
    for (const el of fullscreenAPIs.element) {
        if (document[el] !== undefined) {
            console.debug(el);
            return Boolean(document[el]);
        }
    }
    return false;
}

function goFullscreen() {
    for (const req of fullscreenAPIs.request) {
        if (document.documentElement[req] !== undefined) {
            console.debug(req);
            document.documentElement[req]();
            break;
        }
    }
}

function exitFullscreen() {
    for (const exit of fullscreenAPIs.exit) {
        if (document[exit] !== undefined) {
            console.debug(exit);
            document[exit]();
            break;
        }
    }
}

function addFullscreenChangeHandler(fn) {
    for (const change of fullscreenAPIs.change) {
        const onchange = `on${change}`;
        if (document[onchange] !== undefined) {
            console.debug(change);
            document.addEventListener(change, fn);
            break;
        }
    }
}

function addFullscreenErrorHandler(fn) {
    for (const error of fullscreenAPIs.error) {
        const onerror = `on${error}`;
        if (document[onerror] !== undefined) {
            console.debug(error);
            document.addEventListener(error, fn);
            break;
        }
    }
}


