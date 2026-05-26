const LEARNING_TASK_IDS = new Set(['srs_5', 'quiz_3', 'speak_1']);

const LEARNING_LABELS = {
  srs_5: 'SRS',
  quiz_3: 'Quiz',
  speak_1: 'Speaking',
};

function countForTask(task, taskCounts) {
  return taskCounts[task.statKey] || 0;
}

function isLearningTask(task) {
  return LEARNING_TASK_IDS.has(task.id);
}

function getTaskLabel(task) {
  return task.label || LEARNING_LABELS[task.id] || task.name || task.id;
}

export function buildLearningProgress({ dailyTaskDefs = [], taskCounts = {} } = {}) {
  return dailyTaskDefs
    .filter(isLearningTask)
    .map(task => {
      const count = countForTask(task, taskCounts);
      const target = task.target || 0;
      const label = getTaskLabel(task);

      return {
        id: task.id,
        label,
        text: `${label} ${count}/${target}`,
        done: count >= target,
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
      `餵食 ${quickCarePlan.feed || 0}`,
      `清潔 ${quickCarePlan.clean || 0}`,
      `休息 ${quickCarePlan.sleep || 0}`,
    ];

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

export function DailyPetPlan() {
  return null;
}
