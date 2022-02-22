# TODO

## recent
- [x] remove lighting - it doesn't serve much purpose
- [x] fix play piles centering
- [x] whose turn indicator
- [x] reverse turn direction
- [x] move held card close to pile to indicate where it will play (discard or play pile)
- [x] glow for end turn button
- [x] redo animation system and existing animations to be more flexible
- [x] animate card putting
- [x] draw cards (fill hand) animation
- [x] stack card flip over animation
- [x] shuffle play pile into stack animation
- [x] drop card and return it to where it was animation
- [x] shift cards in hand to restore spacing animation
- [x] move discard pile cards to only show a few at a time animation
- [x] handle undo of full play pile - need to implement undo differently I suppose - restore entire gameView
- [x] animate card dragging, smoothly
- [x] don't pause hovering/etc while animating/updating
- [x] randomize starting player
- [x] allow local moves regardless of latency
- [x] show colors in lobby
- [x] lobby link instead of code
- [x] undo button - undo any moves that don't reveal stack or draw pile cards
- [x] End turn button (in case you want to undo discard)
- [x] fix local testing with 5-6 players - infinite loop or recursion happening
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
- [] kick player button
- [] card places should be outlines, maybe?
- [] skip buffered animations
- [] scroll through zoomed discard pile
- [] undo animation
- [] deal start of game animation
- [] move UI stuff away from iOS exit fullscreen button
- [] save logs to text file
- [] my turn indicator - maybe glow all playable cards?
- [] border or glow around base of stack
- [] undo last move (with click/drag) ?
- [] prevent swipe to refresh/zoom - use some css stuff
- [] better pile shuffle animation - doesn't look good with short draw pile
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
- [] handle a tied game - no cards left in draw pile, can't discard
- [] performance - stop using tonnes of CPU while idle

## browser compatibility
- I mainly care about it working on mainstream modern up-to-date browsers
    - it needs to work well in ios/android...this is difficult
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

