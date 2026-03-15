# Snake Game

## Current State
New project with no existing frontend implementation.

## Requested Changes (Diff)

### Add
- Classic Snake game playable in the browser
- Grid-based game board rendered with React + Canvas or CSS grid
- Snake movement controlled by arrow keys
- Food that spawns at random grid positions
- Snake grows by one segment each time food is eaten
- Score display that increments with each food eaten
- Game-over condition: snake hits wall or collides with itself
- Speed increase as score rises (shorter game tick interval)
- Start/restart screen
- Clean, minimal design

### Modify
- None

### Remove
- None

## Implementation Plan
1. Create a single-page React component `SnakeGame` that owns all game state
2. Use a `useInterval` custom hook (or `useEffect` + `setTimeout`) for the game loop
3. Represent the board as a 20x20 grid; snake as an array of `{x, y}` cells
4. Handle `keydown` events for arrow key direction changes
5. On each tick: compute new head, check collisions, extend or trim tail, check food
6. Spawn food at a random cell not occupied by the snake
7. Calculate speed from score: base interval 200ms, decrease by ~5ms per point, capped at 80ms
8. Display score, high score, and game-over overlay with restart button
9. Style with Tailwind CSS for a dark minimal aesthetic
