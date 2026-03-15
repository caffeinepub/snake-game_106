# Car Racing Game

## Current State
The project currently has a Snake Game web app built with React + TypeScript + Canvas.

## Requested Changes (Diff)

### Add
- Full car racing game replacing the Snake Game
- Scrolling road with lane markings
- Player car controlled by left/right arrow keys (desktop) and touch drag (mobile)
- Enemy cars spawning from top, moving downward at increasing speed
- Collision detection between player and enemy cars
- Score counter that increments as enemy cars are dodged
- Progressive difficulty: enemy cars spawn faster and move faster over time
- Game Over screen with final score and restart button
- High score saved to localStorage

### Modify
- App.tsx: replace Snake Game with Car Racing Game
- index.css: update theme/design tokens for racing aesthetic

### Remove
- All Snake Game logic

## Implementation Plan
1. Replace App.tsx with Car Racing Game using Canvas API + requestAnimationFrame
2. Game loop: scrolling road background, player car, enemy cars, collision detection
3. Player movement: keyboard (ArrowLeft/ArrowRight) and touch drag
4. Score tracking, speed scaling, high score in localStorage
5. Idle, playing, and game over states with overlays
6. Mobile-responsive canvas sizing
7. Update index.css with racing-themed design tokens
