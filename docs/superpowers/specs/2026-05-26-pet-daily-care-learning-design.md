# EnglishGo Pet Daily Care And Learning Design

## Goal

Improve the existing pet system with a lightweight pass that makes the current care and learning loops easier to understand. The change should not introduce a new game mode, rewrite pet adventure, or redesign gacha. It should make the pet home answer three questions immediately:

- Which pet or egg needs attention now?
- What is the next useful action?
- How does today's English practice help pets grow?

## Current Context

The pet system already includes gacha, eggs, pet collection, daily tasks, care actions, duplicate pet rewards, adventure skills, pet adventure, cloud sync, and a pixel pet renderer.

The main implementation is split between:

- `englishgo-project/src/App.jsx`, which owns shared pet constants, helper functions, local storage state, cloud sync, and route wiring.
- `englishgo-project/src/features/PetsModule.jsx`, which owns pet UI screens for tasks, eggs, pets, details, shop, gacha, and adventure.
- `englishgo-project/src/components/PixelPet.jsx`, which renders pet sprites.

The existing pet page already has many useful signals, but the first screen is dense. Users can miss the link between learning tasks and pet progress because task progress, care needs, eggs, and pet list actions are shown as separate concepts.

## Scope

This project will add a clearer "today" layer on top of existing behavior.

In scope:

- Add a top-of-page daily pet guidance section on the main pet screen.
- Surface the best next action from existing state: care needed, hatchable eggs, claimable daily tasks, or learning task progress.
- Make learning-linked pet tasks visible with concise progress labels such as `SRS 3/5`, `Quiz 1/3`, and `Speaking 0/1`.
- Reuse existing task counters, egg progress, care helpers, pet inventory, and tab navigation.
- Add focused tests for the new guidance behavior.
- Run deterministic checks and render QA for the pet page.

Out of scope:

- New pet species, new sprites, or new gacha odds.
- New adventure battle rules.
- New backend schema.
- Rebalancing rewards.
- Large visual redesign of every pet screen.
- Rewriting inline styles or extracting a full design system.

## User Experience

The main pet page should start with a compact "Today's pet plan" section. It should feel like an operational dashboard, not a tutorial or landing page.

The section contains:

- A primary recommendation with one clear next step.
- A short reason that explains why the step matters.
- One action button that either performs the quick action or navigates to the relevant tab or screen.
- Small progress chips for learning-linked tasks.

Priority order for the primary recommendation:

1. Hatch an egg if any egg has enough progress.
2. Claim a completed daily pet task if any task target is met and unclaimed.
3. Quick-care pets if the existing quick-care plan has actionable feed, clean, or sleep work.
4. Buy food if pets need feeding and inventory cannot satisfy it.
5. Continue learning if SRS, quiz, or speaking pet tasks are incomplete.
6. Open pet collection when no urgent action exists.

The recommendation should avoid dead ends. If the action cannot be completed directly, it should move the user to the right existing tab or screen.

## Data Flow

The guidance should be derived from existing props and helpers inside `PetsGuardInner`.

Inputs:

- `pets`
- `eggs`
- `inventory`
- `coins`
- `petTasks`
- `taskCounts`
- `claimedToday`
- `DAILY_TASK_DEFS`
- `EGG_HATCH_TASKS`
- existing quick-care planning logic

Output:

- A small view model for the guidance section:
  - `kind`
  - `title`
  - `description`
  - `buttonLabel`
  - `onAction`
  - `tone`
  - learning progress items

The view model should be computed with `useMemo` where practical so rendering remains predictable and tests can assert stable output.

## Component Boundaries

Keep this as a lightweight module-level extraction inside `PetsModule.jsx` unless the implementation becomes difficult to test.

Planned units:

- A pure helper that builds learning progress from daily task definitions and task counts.
- A pure helper that selects the primary recommendation.
- A presentational `DailyPetPlan` component inside `PetsModule.jsx`.

This keeps the change close to the existing pet UI while giving the most important decision logic direct unit coverage.

## Error Handling

The guidance section should tolerate empty or partially missing state:

- If there are no pets and no eggs, it should point users to gacha or collection discovery without crashing.
- If `petTasks`, `taskCounts`, or `claimedToday` are missing, treat them as empty values.
- If an egg references an unknown pet or rarity, skip that egg for recommendation purposes.
- If quick care needs food but no food is available, route to the shop instead of attempting care.

## Accessibility And Responsive Behavior

The section must work on desktop and narrow mobile screens.

Requirements:

- No horizontal overflow.
- Buttons and chips wrap instead of clipping text.
- The primary button remains tappable on mobile.
- Long Traditional Chinese labels wrap inside their container.
- Do not add hidden instructions or large explanatory text blocks.

## Testing

Add or update tests to cover:

- Hatchable egg recommendation appears before other recommendations.
- Claimable daily task recommendation appears when no egg is ready.
- Quick-care recommendation appears when pets need existing actionable care.
- Learning progress chips show SRS, quiz, and speaking progress from existing counters.
- Empty pet state renders without crashing.

Verification commands:

```powershell
npm test
npm run build
git diff --check
```

Manual QA:

- Open the pet page on desktop.
- Open the pet page on a narrow mobile viewport.
- Confirm no console errors, horizontal overflow, clipped content, or broken navigation.
- Confirm the existing tabs, pet cards, eggs, and task views still work.

## Success Criteria

The change is successful when a returning user can open the pet page and immediately know the best useful action for today without learning any new system. Existing pet care, daily tasks, eggs, and learning counters should feel connected, while the underlying gameplay stays the same.
