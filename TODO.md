# TODO

## recent
- [x] Add font for cards to maintain consistency (not final font)
- [x] better (but still not final) joker card - hat on top where text is for other cards
- [x] disable zoom on stack - not needed now, due to big cards
    - this also fixes the issue where you touch to see stack size, but it zooms instead
- [x] discard only show top 3 (because cards are way bigger)
- [x] change hover to see pile size - ghost font matches normal card font
- [x] repro and fix discard 'stuck' card glitch - happened when new drag initiated while waiting for game update
- [x] bigger card numbers/suites
- [x] other player's moves animation
- [x] switch to overhead cam (for now)
- [x] lobby highlight your player
- [x] click to zoom on stack
- [x] click to zoom on discard pile, unstack it
- [x] stop discards getting too big; only show last 4ish (depend on camera/number of players?)
- [x] full screen button
- [x] loading progress bar
- [x] click to copy to clipboard
- [x] touch controls
- [x] show stack size e.g."10 cards" on hover
- [x] show play pile value ('A','2-10','J','Q') on hover
- [x] show back of other players' hands (hand size)
- [x] update resolution on window resize events
- [x] end game stuff (display winner)
- [x] button back to lobby when game ends
- [x] reconnect to game
- [x] player names
- [x] random player colors or something
- [x] limit number of players (1-6)
- [x] card stacks - draw pile and player stacks
- [x] better player view positioning and camera
- [x] glow valid moves orange/gold
- [x] no glow/drag if not your turn
- [x] glow held card cyan
- [x] host on github

## next up
- [] fix local testing with 5-6 players - infinite loop or recursion happening
- [] lobby link instead of code
- [] move held card close to pile to indicate where it will play (discard or play pile)
- [] animate card dragging, putting etc smoothly (simple animation)
- [] undo last move (with click/drag)
    - Need an end turn button in case you want to undo discard
    - Maybe with a timer
- [] scroll through zoomed discard pile
- [] move UI stuff away from iOS exit fullscreen button
- [] show colors in lobby
- [] save logs to text file
- [] whose turn indicator
- [] my turn indicator - maybe glow all playable cards?
- [] border or glow around base of stack
- [] prevent swipe stuff in iOS etc by putting event.preventDefault() on touchmove event (everywhere)
- [] allow host to customize game (num decks, stack size) from lobby
- [] support back button - or disable it
- [] Try to automatically re-create Host peer on disconnect (e.g. on iOS when in another app for too long)
    - If we can't get the same ID, recreate peer with new ID
        - Host needs to be able to share a new link to continue the same game
        - Maybe host goes back to lobby screen...? But then more lobby screen work is required
            - Maybe first rework the lobby so it can be viewed at any time during an ongoing game
- [] Try to automatically re-create remote peer & reconnect to Host on disconnect
    - Try periodically for some time (30 seconds?) then give up
- [] native device sharing for link - navigator.share()
- [] cycle through colors in lobby on click

## browser compatibility
- I mainly care about it working on mainstream modern up-to-date browsers
    - firefox, chrome, safari, (edge maybe)
    - windows, mac, linux, ios, android versions of these
- [] check what ES6 features I may be using that aren't compatible
    - []
- [] check what DOM APIs etc I need to support in multiple browsers and write code to support em
    - [] fullscreen api
    - []  
- may be easier to:
- [] npm-ify the project if needed
- [] module-ify the project if needed
- [] webpack or something if needed
- [] babel it - this doesn't fix DOM api stuff afaik, just polyfills ES6 stuff



## future
- [] emotes
- [] automated tests using local players/test game function

