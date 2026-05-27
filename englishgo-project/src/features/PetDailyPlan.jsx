const LEARNING_TASK_ORDER = ['srs_5', 'quiz_3', 'speak_1'];

const LEARNING_LABELS = {
  srs_5: 'SRS',
  quiz_3: 'Quiz',
  speak_1: 'Speaking',
};

const LEARNING_TONES = {
  srs_5: 'violet',
  quiz_3: 'blue',
  speak_1: 'teal',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function countForTask(task, taskCounts) {
  return taskCounts[task.statKey] || 0;
}

function getTaskLabel(task) {
  return task.label || LEARNING_LABELS[task.id] || task.name || task.id;
}

export function buildLearningProgress({ dailyTaskDefs = [], taskCounts = {} } = {}) {
  const taskById = new Map(dailyTaskDefs.map(task => [task.id, task]));

  return LEARNING_TASK_ORDER
    .map(id => taskById.get(id))
    .filter(Boolean)
    .map(task => {
      const target = Math.max(0, task.target || 0);
      const rawCount = countForTask(task, taskCounts);
      const count = target > 0 ? clamp(rawCount, 0, target) : Math.max(0, rawCount);
      const pct = target > 0 ? Math.round((count / target) * 100) : 100;
      const label = getTaskLabel(task);

      return {
        id: task.id,
        label,
        text: `${label} ${count}/${target}`,
        done: target === 0 || count >= target,
        count,
        target,
        pct: clamp(pct, 0, 100),
        tone: LEARNING_TONES[task.id] || 'neutral',
      };
    });
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
  const claimedIds = new Set(claimedToday);
  const hatchableEggs = eggs.filter(egg => {
    const needed = eggHatchTasks[egg.rarity];
    return isKnownEgg(egg) && Number.isFinite(needed) && (egg.progress || 0) >= needed;
  });

  if (hatchableEggs.length > 0) {
    return {
      kind: 'hatch',
      action: 'eggs',
      title: `${hatchableEggs.length} 顆蛋可以孵化`,
      description: '先到蛋倉孵化新夥伴，讓今天的學習成果變成寵物成長。',
      buttonLabel: '去蛋倉',
    };
  }

  const claimableTasks = dailyTaskDefs.filter(task => {
    return !claimedIds.has(task.id) && countForTask(task, taskCounts) >= (task.target || 0);
  });

  if (claimableTasks.length > 0) {
    return {
      kind: 'claim',
      action: 'tasks',
      title: `${claimableTasks.length} 個任務獎勵可領取`,
      description: '先領取今日任務獎勵，讓寵物拿到金幣與經驗值。',
      buttonLabel: '領任務獎勵',
    };
  }

  if ((quickCarePlan.total || 0) > 0) {
    const careParts = [
      ['餵食', quickCarePlan.feed || 0],
      ['清潔', quickCarePlan.clean || 0],
      ['休息', quickCarePlan.sleep || 0],
    ]
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${label} ${count}`);

    return {
      kind: 'quickCare',
      action: 'quickCare',
      title: `${quickCarePlan.total} 項照顧可以快速完成`,
      description: `可快速處理：${careParts.join('、')}。`,
      buttonLabel: '一鍵照顧',
    };
  }

  if ((quickCarePlan.needsFood || 0) > 0) {
    return {
      kind: 'shop',
      action: 'shop',
      title: `補食物給 ${quickCarePlan.needsFood} 位夥伴`,
      description: '有寵物需要餵食，但目前缺少可用食物。',
      buttonLabel: '去補食物',
    };
  }

  const learningProgress = buildLearningProgress({ dailyTaskDefs, taskCounts });
  const nextLearning = learningProgress.find(item => !item.done);

  if (nextLearning) {
    return {
      kind: 'learn',
      action: 'tasks',
      title: `繼續完成 ${nextLearning.label}`,
      description: `${nextLearning.text}，完成後可以累積任務獎勵與孵蛋進度。`,
      buttonLabel: '去學習任務',
      learningProgress,
    };
  }

  if (pets.length === 0 && eggs.length === 0) {
    return {
      kind: 'empty',
      action: 'dex',
      title: '先迎接第一位寵物夥伴',
      description: '完成學習任務或抽蛋後，就能開始照顧自己的寵物。',
      buttonLabel: '看寵物圖鑑',
      learningProgress,
    };
  }

  const remainingCount = Math.max(0, totalPetKinds - ownedCount);

  return {
    kind: 'collection',
    action: 'dex',
    title: remainingCount > 0 ? `還有 ${remainingCount} 位夥伴等待收集` : '今日寵物狀態已完成',
    description: remainingCount > 0 ? '保持學習節奏，繼續孵蛋與擴充收藏。' : '任務、照顧與收藏都已整理好。',
    buttonLabel: '查看圖鑑',
    learningProgress,
  };
}

function resolveChipTone(tone, fallback) {
  const tones = {
    violet: '#7B61FF',
    blue: '#185FA5',
    teal: '#1D9E75',
    neutral: fallback,
  };
  return tones[tone] || tone || fallback;
}

export function DailyPetPlan({ plan, learningProgress = [], onAction, S = {}, c = {} }) {
  if (!plan) return null;
  const styles = {
    card: S.card || {},
    btn: S.btn || {},
    bg1: S.bg1 || '#ffffff',
    bg2: S.bg2 || '#f3f2ee',
    bd: S.bd || '#ddd',
    t1: S.t1 || '#222',
    t2: S.t2 || '#555',
    t3: S.t3 || '#777',
  };
  const theme = {
    cl: c.cl || '#1D9E75',
    ac: c.ac || '#0F6E56',
  };
  const tone = plan.tone || theme.cl;

  return (
    <section
      data-testid="pet-daily-plan"
      style={{
        ...styles.card,
        padding: '14px',
        marginBottom: 12,
        border: `1px solid ${tone}44`,
        background: `linear-gradient(135deg, ${tone}14, var(--color-background-primary, #fff))`,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
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
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flex: '0 0 auto',
            minHeight: 40,
            maxWidth: '100%',
            whiteSpace: 'normal',
          }}
        >
          {plan.buttonLabel}
        </button>
      </div>

      {learningProgress.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {learningProgress.map(item => {
            const chipTone = resolveChipTone(item.tone, tone);
            return (
              <div
                key={item.id}
                data-testid={`pet-learning-chip-${item.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: '100%',
                  padding: '5px 8px',
                  borderRadius: 999,
                  border: `1px solid ${item.done ? '#1D9E7544' : styles.bd}`,
                  background: item.done ? '#E1F5EE' : styles.bg1,
                  color: item.done ? '#0F6E56' : styles.t2,
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: 'normal',
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
                    overflow: 'hidden',
                    display: 'inline-flex',
                    flex: '0 0 auto',
                  }}
                >
                  <span
                    style={{
                      width: `${item.pct || 0}%`,
                      background: item.done ? '#1D9E75' : chipTone,
                      borderRadius: 999,
                    }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
