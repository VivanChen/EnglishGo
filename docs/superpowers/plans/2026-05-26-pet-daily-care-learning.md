# Pet Daily Care And Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact daily pet plan to the existing pet page so users can see the best next care, egg, task, or learning action immediately.

**Architecture:** Put the recommendation selector and progress-chip logic in a focused `PetDailyPlan.jsx` module with unit tests. Keep `PetsModule.jsx` as the owner of pet state and navigation; it will compute existing inputs, call the selector, and render the presentational plan card above the existing pet care center. This avoids rewriting pet gameplay while making the first screen clearer.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, existing inline style system in `PetsModule.jsx`.

---

## File Structure

- Create: `englishgo-project/src/features/PetDailyPlan.jsx`
  - Owns pure recommendation helpers and the small presentational `DailyPetPlan` component.
  - Exports `buildLearningProgress`, `buildPetDailyPlan`, and `DailyPetPlan`.
- Create: `englishgo-project/src/features/PetDailyPlan.test.jsx`
  - Tests recommendation priority, learning chips, empty state, and component action dispatch.
- Modify: `englishgo-project/src/features/PetsModule.jsx`
  - Imports the new helper/component.
  - Builds the daily plan from existing `PetsPage` state.
  - Adds a local action handler that routes to existing tabs, shop, or quick care.
  - Renders `DailyPetPlan` near the top of the main pet screen.

---

### Task 1: Recommendation Helper

**Files:**
- Create: `englishgo-project/src/features/PetDailyPlan.test.jsx`
- Create: `englishgo-project/src/features/PetDailyPlan.jsx`

- [ ] **Step 1: Write the failing helper tests**

Create `englishgo-project/src/features/PetDailyPlan.test.jsx` with this content:

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DailyPetPlan,
  buildLearningProgress,
  buildPetDailyPlan,
} from "./PetDailyPlan.jsx";

const dailyTaskDefs = [
  { id: "srs_5", statKey: "srsToday", name: "SRS 5 cards", target: 5, reward: { coins: 20, exp: 15 } },
  { id: "quiz_3", statKey: "quizToday", name: "Quiz 3 times", target: 3, reward: { coins: 15, exp: 10 } },
  { id: "speak_1", statKey: "speakToday", name: "Speaking 1 time", target: 1, reward: { coins: 25, exp: 20 } },
  { id: "feed_1", statKey: "feedToday", name: "Feed pet", target: 1, reward: { coins: 10, exp: 5 } },
];

const eggHatchTasks = { N: 10, R: 15 };
const knownEgg = (egg) => egg.petId !== "unknown";

describe("buildLearningProgress", () => {
  it("shows stable SRS, quiz, and speaking progress chips", () => {
    const progress = buildLearningProgress({
      dailyTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 1, speakToday: 0 },
    });

    expect(progress.map((item) => item.id)).toEqual(["srs_5", "quiz_3", "speak_1"]);
    expect(progress.map((item) => item.label)).toEqual(["SRS", "Quiz", "Speaking"]);
    expect(progress.map((item) => item.text)).toEqual(["SRS 3/5", "Quiz 1/3", "Speaking 0/1"]);
    expect(progress[0].done).toBe(false);
  });
});

describe("buildPetDailyPlan", () => {
  it("recommends hatchable eggs before claimable tasks and care", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [{ id: "egg-1", petId: "bunny", rarity: "N", progress: 10 }],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
      quickCarePlan: { feed: 1, clean: 0, sleep: 0, needsFood: 0, total: 1 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("hatch");
    expect(plan.action).toBe("eggs");
    expect(plan.title).toContain("1");
  });

  it("recommends claiming completed daily tasks when no egg is ready", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [{ id: "egg-1", petId: "bunny", rarity: "N", progress: 4 }],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("claim");
    expect(plan.action).toBe("tasks");
    expect(plan.title).toContain("1");
  });

  it("recommends quick care before buying food when care is actionable", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: {},
      claimedToday: [],
      quickCarePlan: { feed: 1, clean: 1, sleep: 0, needsFood: 0, total: 2 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("quickCare");
    expect(plan.action).toBe("quickCare");
    expect(plan.description).toContain("餵食 1");
    expect(plan.description).toContain("清潔 1");
  });

  it("recommends the shop when pets need food and inventory cannot cover feeding", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: {},
      claimedToday: [],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 2, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("shop");
    expect(plan.action).toBe("shop");
    expect(plan.title).toContain("補食物");
  });

  it("recommends learning when care, eggs, and claims are settled", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ["quiz_3", "speak_1"],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("learn");
    expect(plan.action).toBe("tasks");
    expect(plan.title).toContain("SRS");
  });

  it("returns a safe empty-state plan when there are no pets or eggs", () => {
    const plan = buildPetDailyPlan({
      pets: [],
      eggs: [],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: {},
      claimedToday: [],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 0,
    });

    expect(plan.kind).toBe("empty");
    expect(plan.action).toBe("dex");
    expect(plan.title).toContain("第一位");
  });

  it("skips unknown eggs when looking for hatchable recommendations", () => {
    const plan = buildPetDailyPlan({
      pets: [{ petId: "bunny" }],
      eggs: [{ id: "egg-unknown", petId: "unknown", rarity: "N", progress: 10 }],
      eggHatchTasks,
      isKnownEgg: knownEgg,
      dailyTaskDefs,
      taskCounts: {},
      claimedToday: [],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe("learn");
  });
});
```

- [ ] **Step 2: Run the helper tests and verify they fail**

Run:

```powershell
npm test -- src/features/PetDailyPlan.test.jsx
```

Expected: FAIL because `./PetDailyPlan.jsx` does not exist.

- [ ] **Step 3: Add the minimal helper implementation**

Create `englishgo-project/src/features/PetDailyPlan.jsx` with this content:

```jsx
import React from "react";

const LEARNING_TASKS = [
  { id: "srs_5", label: "SRS" },
  { id: "quiz_3", label: "Quiz" },
  { id: "speak_1", label: "Speaking" },
];

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function findTask(dailyTaskDefs, id) {
  return (dailyTaskDefs || []).find((task) => task.id === id);
}

export function buildLearningProgress({ dailyTaskDefs = [], taskCounts = {} } = {}) {
  return LEARNING_TASKS.map((meta) => {
    const task = findTask(dailyTaskDefs, meta.id);
    if (!task) return null;
    const count = Math.max(0, safeNumber(taskCounts[task.statKey]));
    const target = Math.max(1, safeNumber(task.target, 1));
    const shownCount = Math.min(count, target);
    return {
      id: task.id,
      statKey: task.statKey,
      label: meta.label,
      count: shownCount,
      target,
      done: count >= target,
      pct: Math.min(100, Math.round((shownCount / target) * 100)),
      text: `${meta.label} ${shownCount}/${target}`,
    };
  }).filter(Boolean);
}

function getReadyEggs({ eggs = [], eggHatchTasks = {}, isKnownEgg = () => true }) {
  return (eggs || []).filter((egg) => {
    if (!egg || !isKnownEgg(egg)) return false;
    const needed = Math.max(1, safeNumber(eggHatchTasks[egg.rarity], 1));
    return safeNumber(egg.progress) >= needed;
  });
}

function getClaimableTasks({ dailyTaskDefs = [], taskCounts = {}, claimedToday = [] }) {
  const claimed = new Set(claimedToday || []);
  return (dailyTaskDefs || []).filter((task) => {
    const count = safeNumber(taskCounts[task.statKey]);
    return !claimed.has(task.id) && count >= safeNumber(task.target, 1);
  });
}

function formatCareParts(quickCarePlan) {
  const parts = [];
  if (safeNumber(quickCarePlan.feed) > 0) parts.push(`餵食 ${quickCarePlan.feed}`);
  if (safeNumber(quickCarePlan.clean) > 0) parts.push(`清潔 ${quickCarePlan.clean}`);
  if (safeNumber(quickCarePlan.sleep) > 0) parts.push(`休息 ${quickCarePlan.sleep}`);
  return parts.join("、");
}

export function buildPetDailyPlan({
  pets = [],
  eggs = [],
  eggHatchTasks = {},
  isKnownEgg = () => true,
  dailyTaskDefs = [],
  taskCounts = {},
  claimedToday = [],
  quickCarePlan = {},
  totalPetKinds = 0,
  ownedCount = 0,
} = {}) {
  const readyEggs = getReadyEggs({ eggs, eggHatchTasks, isKnownEgg });
  if (readyEggs.length > 0) {
    return {
      kind: "hatch",
      action: "eggs",
      tone: "#EF9F27",
      title: `${readyEggs.length} 顆蛋可以孵化`,
      description: "先把完成進度的蛋孵化，讓新的寵物加入今天的學習。",
      buttonLabel: "查看蛋",
    };
  }

  const claimableTasks = getClaimableTasks({ dailyTaskDefs, taskCounts, claimedToday });
  if (claimableTasks.length > 0) {
    return {
      kind: "claim",
      action: "tasks",
      tone: "#1D9E75",
      title: `${claimableTasks.length} 個寵物任務可領`,
      description: "先領取已完成任務，把今天的練習轉成金幣與寵物經驗。",
      buttonLabel: "領任務",
    };
  }

  if (safeNumber(quickCarePlan.total) > 0) {
    return {
      kind: "quickCare",
      action: "quickCare",
      tone: "#EF9F27",
      title: "先快速照顧寵物",
      description: `可立即處理：${formatCareParts(quickCarePlan)}。`,
      buttonLabel: "一鍵照顧",
    };
  }

  if (safeNumber(quickCarePlan.needsFood) > 0) {
    return {
      kind: "shop",
      action: "shop",
      tone: "#EF9F27",
      title: "需要補食物",
      description: `${quickCarePlan.needsFood} 隻寵物想吃東西，但目前沒有合適食物。`,
      buttonLabel: "去商店",
    };
  }

  const learningProgress = buildLearningProgress({ dailyTaskDefs, taskCounts });
  const nextLearning = learningProgress.find((item) => !item.done);
  if (nextLearning) {
    return {
      kind: "learn",
      action: "tasks",
      tone: "#185FA5",
      title: `繼續完成 ${nextLearning.label}`,
      description: `${nextLearning.text}，完成後可以領寵物任務獎勵。`,
      buttonLabel: "看任務",
    };
  }

  if ((pets || []).length === 0 && (eggs || []).length === 0) {
    return {
      kind: "empty",
      action: "dex",
      tone: "#7B61FF",
      title: "先取得第一位寵物夥伴",
      description: "目前沒有寵物或蛋。先看看圖鑑，再回主選單取得寵物蛋。",
      buttonLabel: "看圖鑑",
    };
  }

  const total = Math.max(ownedCount, totalPetKinds || ownedCount);
  return {
    kind: "collection",
    action: "dex",
    tone: "#7B61FF",
    title: "今天狀態穩定",
    description: `已收集 ${ownedCount}/${total} 種寵物，可以查看圖鑑或繼續學習累積下一輪成長。`,
    buttonLabel: "看圖鑑",
  };
}

export function DailyPetPlan() {
  return null;
}
```

- [ ] **Step 4: Run the helper tests and verify they pass**

Run:

```powershell
npm test -- src/features/PetDailyPlan.test.jsx
```

Expected: PASS for helper tests. The component action test does not exist yet.

- [ ] **Step 5: Commit helper work**

Run:

```powershell
git add src/features/PetDailyPlan.jsx src/features/PetDailyPlan.test.jsx
git commit -m "feat: add pet daily plan selector"
```

Expected: Commit succeeds.

---

### Task 2: Daily Pet Plan Component

**Files:**
- Modify: `englishgo-project/src/features/PetDailyPlan.test.jsx`
- Modify: `englishgo-project/src/features/PetDailyPlan.jsx`

- [ ] **Step 1: Add the failing component test**

Append this test block to `englishgo-project/src/features/PetDailyPlan.test.jsx`:

```jsx
describe("DailyPetPlan", () => {
  it("renders the recommendation, learning chips, and dispatches the selected action", () => {
    const onAction = vi.fn();
    const plan = {
      kind: "hatch",
      action: "eggs",
      tone: "#EF9F27",
      title: "1 顆蛋可以孵化",
      description: "先把完成進度的蛋孵化。",
      buttonLabel: "查看蛋",
    };
    const learningProgress = [
      { id: "srs_5", text: "SRS 3/5", pct: 60, done: false },
      { id: "quiz_3", text: "Quiz 3/3", pct: 100, done: true },
      { id: "speak_1", text: "Speaking 0/1", pct: 0, done: false },
    ];

    render(
      <DailyPetPlan
        plan={plan}
        learningProgress={learningProgress}
        onAction={onAction}
        S={{
          card: {},
          btn: {},
          bg1: "#ffffff",
          bg2: "#f3f2ee",
          bd: "#ddd",
          t1: "#222",
          t2: "#555",
          t3: "#777",
        }}
        c={{ cl: "#1D9E75", ac: "#0F6E56", bg: "#E1F5EE" }}
      />
    );

    expect(screen.getByTestId("pet-daily-plan")).toHaveTextContent("1 顆蛋可以孵化");
    expect(screen.getByTestId("pet-learning-chip-srs_5")).toHaveTextContent("SRS 3/5");
    expect(screen.getByTestId("pet-learning-chip-quiz_3")).toHaveTextContent("Quiz 3/3");
    expect(screen.getByTestId("pet-learning-chip-speak_1")).toHaveTextContent("Speaking 0/1");

    fireEvent.click(screen.getByRole("button", { name: "查看蛋" }));

    expect(onAction).toHaveBeenCalledWith("eggs", plan);
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```powershell
npm test -- src/features/PetDailyPlan.test.jsx
```

Expected: FAIL because `DailyPetPlan` currently renders nothing.

- [ ] **Step 3: Implement the component**

Replace the temporary `DailyPetPlan` function at the bottom of `englishgo-project/src/features/PetDailyPlan.jsx` with this implementation:

```jsx
export function DailyPetPlan({ plan, learningProgress = [], onAction, S = {}, c = {} }) {
  if (!plan) return null;
  const styles = {
    card: S.card || {},
    btn: S.btn || {},
    bg1: S.bg1 || "#ffffff",
    bg2: S.bg2 || "#f3f2ee",
    bd: S.bd || "#ddd",
    t1: S.t1 || "#222",
    t2: S.t2 || "#555",
    t3: S.t3 || "#777",
  };
  const theme = {
    cl: c.cl || "#1D9E75",
    ac: c.ac || "#0F6E56",
    bg: c.bg || "#E1F5EE",
  };
  const tone = plan.tone || theme.cl;

  return (
    <section
      data-testid="pet-daily-plan"
      style={{
        ...styles.card,
        padding: "14px",
        marginBottom: 12,
        border: `1px solid ${tone}44`,
        background: `linear-gradient(135deg, ${tone}14, var(--color-background-primary, #fff))`,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: tone, fontWeight: 1000, marginBottom: 3 }}>今日寵物任務</div>
          <div style={{ fontSize: 15, color: styles.t1, fontWeight: 1000, lineHeight: 1.35 }}>{plan.title}</div>
          <div style={{ fontSize: 12, color: styles.t2, lineHeight: 1.6, marginTop: 4 }}>{plan.description}</div>
        </div>
        <button
          type="button"
          onClick={() => onAction?.(plan.action, plan)}
          style={{
            ...styles.btn,
            background: `linear-gradient(135deg, ${tone}, ${theme.ac})`,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            flex: "0 0 auto",
            minHeight: 40,
          }}
        >
          {plan.buttonLabel}
        </button>
      </div>

      {learningProgress.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {learningProgress.map((item) => (
            <div
              key={item.id}
              data-testid={`pet-learning-chip-${item.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
                padding: "5px 8px",
                borderRadius: 999,
                border: `1px solid ${item.done ? "#1D9E7544" : styles.bd}`,
                background: item.done ? "#E1F5EE" : styles.bg1,
                color: item.done ? "#0F6E56" : styles.t2,
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "normal",
              }}
            >
              <span>{item.text}</span>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 4,
                  borderRadius: 999,
                  background: styles.bg2,
                  overflow: "hidden",
                  display: "inline-flex",
                }}
              >
                <span
                  style={{
                    width: `${item.pct}%`,
                    background: item.done ? "#1D9E75" : tone,
                    borderRadius: 999,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```powershell
npm test -- src/features/PetDailyPlan.test.jsx
```

Expected: PASS for all tests in `PetDailyPlan.test.jsx`.

- [ ] **Step 5: Commit component work**

Run:

```powershell
git add src/features/PetDailyPlan.jsx src/features/PetDailyPlan.test.jsx
git commit -m "feat: render pet daily plan card"
```

Expected: Commit succeeds.

---

### Task 3: Integrate Daily Plan Into Pets Module

**Files:**
- Modify: `englishgo-project/src/features/PetsModule.jsx`

- [ ] **Step 1: Add the import**

In `englishgo-project/src/features/PetsModule.jsx`, add this import directly after the existing React import:

```jsx
import { DailyPetPlan, buildLearningProgress, buildPetDailyPlan } from "./PetDailyPlan.jsx";
```

- [ ] **Step 2: Build the plan view model**

Find this existing line in `PetsPage`:

```jsx
  const claimableTaskCount=DAILY_TASK_DEFS.filter(t=>!claimedToday.includes(t.id)&&(taskCounts[t.statKey]||0)>=t.target).length;
```

Insert this block immediately after that line:

```jsx
  const learningProgress=useMemo(()=>buildLearningProgress({
    dailyTaskDefs:DAILY_TASK_DEFS,
    taskCounts,
  }),[taskCounts]);
  const dailyPetPlan=useMemo(()=>buildPetDailyPlan({
    pets,
    eggs,
    eggHatchTasks:EGG_HATCH_TASKS,
    isKnownEgg:egg=>!!PETS[egg.rarity]?.some(p=>p.id===egg.petId),
    dailyTaskDefs:DAILY_TASK_DEFS,
    taskCounts,
    claimedToday,
    quickCarePlan,
    totalPetKinds,
    ownedCount:ownedIds.size,
  }),[pets,eggs,taskCounts,claimedToday,quickCarePlan,totalPetKinds,ownedIds]);
```

- [ ] **Step 3: Add the local action handler after `quickCareAll`**

Find the end of the existing `quickCareAll` function. It currently ends with:

```jsx
    if(needsFood>0)window.setTimeout(()=>showToast(`${needsFood} ?餃秘?拚??閬??抬?閮?鋆疏?,"?","info"),900);
  };
```

Insert this block immediately after the `quickCareAll` function:

```jsx
  const handleDailyPetPlanAction=useCallback((action)=>{
    if(action==="eggs"){setTab("eggs");return}
    if(action==="tasks"){setTab("tasks");return}
    if(action==="quickCare"){quickCareAll();return}
    if(action==="shop"){setShopOpen(true);return}
    setTab("dex");
  },[quickCareAll]);
```

- [ ] **Step 4: Render the daily plan near the top of the main pet screen**

Find this existing block in the main `PetsPage` return:

```jsx
    <section data-testid="pet-care-center" style={{...S.card,padding:"14px",marginBottom:12,border:`1px solid ${c.cl}33`,background:`radial-gradient(circle at 100% 0,${c.cl}18,transparent 34%),linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
```

Insert this component immediately before that `<section>`:

```jsx
    <DailyPetPlan
      plan={dailyPetPlan}
      learningProgress={learningProgress}
      onAction={handleDailyPetPlanAction}
      S={S}
      c={c}
    />
```

- [ ] **Step 5: Run focused tests and build**

Run:

```powershell
npm test -- src/features/PetDailyPlan.test.jsx
npm run build
```

Expected: Tests pass and Vite build completes.

- [ ] **Step 6: Commit integration**

Run:

```powershell
git add src/features/PetsModule.jsx
git commit -m "feat: show pet daily plan on pet home"
```

Expected: Commit succeeds.

---

### Task 4: Verification And Frontend QA

**Files:**
- No planned source edits.

- [ ] **Step 1: Run the deterministic checks**

Run from `englishgo-project`:

```powershell
npm test
npm run build
git diff --check
```

Expected:

- `npm test` passes.
- `npm run build` passes.
- `git diff --check` prints no whitespace errors.

- [ ] **Step 2: Start the local Vite server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Desktop render QA**

Open the local URL in Browser and navigate to the pet page. Verify:

- The daily pet plan appears above the existing pet care center.
- The primary recommendation changes when eggs are ready, tasks are claimable, or care is needed.
- The learning chips wrap and remain readable.
- Clicking the plan button moves to the correct existing tab or opens the shop.
- The browser console has no runtime errors.

- [ ] **Step 4: Mobile render QA**

Use a narrow phone viewport such as `390x844`. Verify:

- No horizontal overflow.
- The plan title, description, chips, and button wrap inside the card.
- The button remains tappable.
- Existing tabs, pet cards, egg cards, and task cards are not clipped.

- [ ] **Step 5: Commit any QA-only fixes**

If QA exposes a small layout or wiring issue, fix it, rerun:

```powershell
npm test
npm run build
git diff --check
```

Then commit:

```powershell
git add src/features/PetDailyPlan.jsx src/features/PetsModule.jsx src/features/PetDailyPlan.test.jsx
git commit -m "fix: polish pet daily plan layout"
```

Expected: Commit succeeds only if source files changed during QA.

---

## Self-Review

Spec coverage:

- Top-of-page daily guidance is implemented in Task 3.
- Best next action priority is covered in Task 1 tests and helper implementation.
- Learning-linked progress chips are covered in Task 1 and Task 2.
- Existing task counters, egg progress, care plan, and tab navigation are reused in Task 3.
- Focused tests are added in Tasks 1 and 2.
- Deterministic checks and desktop/mobile QA are covered in Task 4.

Unfinished-marker scan:

- The plan contains no unfinished marker text.
- Every code step includes exact file paths and concrete code.

Type consistency:

- `buildLearningProgress`, `buildPetDailyPlan`, and `DailyPetPlan` are created in `PetDailyPlan.jsx`, tested from `PetDailyPlan.test.jsx`, and imported by `PetsModule.jsx`.
- `DailyPetPlan` dispatches `(action, plan)`, and `handleDailyPetPlanAction` accepts `action`.
