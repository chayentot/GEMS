# GEMS: Mining Empire — Gameplay Preview

This is a separate gameplay feature from the existing GEMS gemstone mining and wallet economy.

## Confirmed gameplay rules

- The first mine is available at the start and produces the first material, Iron Ore.
- Locked factories are always bypassed by conveyor materials.
- An unlocked factory accepts its recipe ingredients into a limited input buffer.
- Each factory has a maximum input capacity (100 units in the current UI preview).
- A factory automatically processes a batch as soon as all required ingredients are present.
- If a factory is full, material continues to the next eligible unlocked factory.
- If no eligible unlocked factory can accept the material, it reaches the selling station and is converted to Gold.
- Gold is the separate in-game currency used to unlock factories. It is not GEMS and has no PHP cash value.

## Initial ten-material recipe chain

| Factory | Product | Inputs |
|---|---|---|
| 1 | Iron Ore | Starter mine |
| 2 | Iron Bars | 2 Iron Ore |
| 3 | Steel | 2 Iron Bars |
| 4 | Industrial Gears | 2 Steel |
| 5 | Reinforced Frame | 1 Iron Ore + 1 Industrial Gears |
| 6 | Mechanical Assembly | 1 Iron Bars + 1 Reinforced Frame |
| 7 | Power Generator | 1 Steel + 1 Mechanical Assembly |
| 8 | Control System | 1 Industrial Gears + 1 Mechanical Assembly |
| 9 | Heavy Mining Drill | 1 Reinforced Frame + 1 Power Generator |
| 10 | Ultimate Mining Core | 1 Mechanical Assembly + 1 Power Generator + 1 Control System + 1 Heavy Mining Drill |

## Current implementation status

The `/empire/` page is an interactive front-end gameplay preview. It simulates production, input storage, bypass, overflow selling, Gold and factory unlocking locally in the browser. The current prices, batch quantities, storage capacity and sell values are placeholders for gameplay testing.

It does not write to Supabase, alter existing GEMS balances, or implement authoritative offline production. Do not treat browser preview balances as real player progress.

## Before production implementation

The next phase needs a Supabase migration and secure database functions for player factory ownership, material inventory, production timestamps, capacity checks, conveyor routing, Gold transactions and offline catch-up. Because this website is a static GitHub Pages export, authoritative idle/offline production must run in trusted Supabase database functions (or another trusted backend), not in browser timers. Existing GEMS wallet, recharge, withdrawal and referral logic must remain unchanged.
