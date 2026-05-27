import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyPetPlan, buildLearningProgress, buildPetDailyPlan } from './PetDailyPlan.jsx';

const learningTaskDefs = [
  { id: 'srs_5', label: 'SRS', target: 5, statKey: 'srsToday' },
  { id: 'quiz_3', label: 'Quiz', target: 3, statKey: 'quizToday' },
  { id: 'speak_1', label: 'Speaking', target: 1, statKey: 'speakToday' },
  { id: 'feed_1', label: 'Feed', target: 1, statKey: 'feedToday' },
];

const shuffledLearningTaskDefs = [
  learningTaskDefs[3],
  learningTaskDefs[2],
  learningTaskDefs[0],
  learningTaskDefs[1],
];

const allTasksClaimed = learningTaskDefs.map(task => task.id);

describe('buildLearningProgress', () => {
  it('returns canonical learning progress chips with incomplete progress marked not done', () => {
    const progress = buildLearningProgress({
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 1, speakToday: 0 },
    });

    expect(progress.map(item => item.id)).toEqual(['srs_5', 'quiz_3', 'speak_1']);
    expect(progress.map(item => item.label)).toEqual(['SRS', 'Quiz', 'Speaking']);
    expect(progress.map(item => item.text)).toEqual(['SRS 3/5', 'Quiz 1/3', 'Speaking 0/1']);
    expect(progress.map(item => item.done)).toEqual([false, false, false]);
  });

  it('keeps canonical order when daily task definitions are shuffled', () => {
    const progress = buildLearningProgress({
      dailyTaskDefs: shuffledLearningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 1, speakToday: 0 },
    });

    expect(progress.map(item => item.id)).toEqual(['srs_5', 'quiz_3', 'speak_1']);
  });

  it('includes clamped count, target, pct, and tone fields for future UI chips', () => {
    const progress = buildLearningProgress({
      dailyTaskDefs: shuffledLearningTaskDefs,
      taskCounts: { srsToday: 9, quizToday: 1, speakToday: -2 },
    });

    expect(progress).toEqual([
      expect.objectContaining({
        id: 'srs_5',
        count: 5,
        target: 5,
        pct: 100,
        tone: expect.any(String),
        text: 'SRS 5/5',
        done: true,
      }),
      expect.objectContaining({
        id: 'quiz_3',
        count: 1,
        target: 3,
        pct: 33,
        tone: expect.any(String),
        text: 'Quiz 1/3',
        done: false,
      }),
      expect.objectContaining({
        id: 'speak_1',
        count: 0,
        target: 1,
        pct: 0,
        tone: expect.any(String),
        text: 'Speaking 0/1',
        done: false,
      }),
    ]);
    expect(progress.every(item => item.tone.length > 0)).toBe(true);
  });
});

describe('buildPetDailyPlan', () => {
  it('recommends hatchable eggs before claimable tasks', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [{ id: 'egg-1', petId: 'cat', rarity: 'N', progress: 10 }],
      eggHatchTasks: { N: 10, R: 15 },
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
    });

    expect(plan.kind).toBe('hatch');
    expect(plan.action).toBe('eggs');
    expect(plan.title).toContain('1');
  });

  it('includes a visual tone on recommendation plans', () => {
    const hatchPlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [{ id: 'egg-1', petId: 'cat', rarity: 'N', progress: 10 }],
      eggHatchTasks: { N: 10 },
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
    });
    const claimPlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
    });
    const quickCarePlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 1, clean: 0, sleep: 0, needsFood: 0, total: 1 },
    });
    const shopPlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 1, total: 0 },
    });
    const learnPlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ['quiz_3', 'speak_1', 'feed_1'],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
    });
    const collectionPlan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 5, quizToday: 3, speakToday: 1 },
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect([
      hatchPlan,
      claimPlan,
      quickCarePlan,
      shopPlan,
      learnPlan,
      collectionPlan,
    ].map(plan => plan.tone)).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('recommends hatchable eggs before care', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [{ id: 'egg-1', petId: 'cat', rarity: 'N', progress: 10 }],
      eggHatchTasks: { N: 10 },
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 1, clean: 1, sleep: 0, needsFood: 0, total: 2 },
    });

    expect(plan.kind).toBe('hatch');
    expect(plan.action).toBe('eggs');
  });

  it('recommends claimable tasks when no egg is ready', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
    });

    expect(plan.kind).toBe('claim');
    expect(plan.action).toBe('tasks');
    expect(plan.title).toContain('1');
  });

  it('recommends claimable tasks before quick care', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: ['srs_5', 'quiz_3', 'speak_1'],
      quickCarePlan: { feed: 1, clean: 0, sleep: 0, needsFood: 0, total: 1 },
    });

    expect(plan.kind).toBe('claim');
    expect(plan.action).toBe('tasks');
  });

  it('recommends quick care before food buying when actionable care exists', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 1, clean: 1, sleep: 0, needsFood: 0, total: 2 },
    });

    expect(plan.kind).toBe('quickCare');
    expect(plan.action).toBe('quickCare');
    expect(plan.description).toContain('餵食 1');
    expect(plan.description).toContain('清潔 1');
    expect(plan.description).not.toContain('休息 0');
  });

  it('recommends quick care before shop when actionable care and missing food compete', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 1, clean: 0, sleep: 0, needsFood: 2, total: 1 },
    });

    expect(plan.kind).toBe('quickCare');
    expect(plan.action).toBe('quickCare');
  });

  it('recommends shop when only needsFood exists', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 2, total: 0 },
    });

    expect(plan.kind).toBe('shop');
    expect(plan.action).toBe('shop');
    expect(plan.title).toContain('補食物');
  });

  it('recommends shop before learning when food is missing', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ['quiz_3', 'speak_1', 'feed_1'],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 2, total: 0 },
    });

    expect(plan.kind).toBe('shop');
    expect(plan.action).toBe('shop');
  });

  it('recommends learning when care, eggs, and claims are settled', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ['quiz_3', 'speak_1', 'feed_1'],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
    });

    expect(plan.kind).toBe('learn');
    expect(plan.action).toBe('tasks');
    expect(plan.title).toContain('SRS');
  });

  it('recommends learning before empty state when learning is incomplete without pets or eggs', () => {
    const plan = buildPetDailyPlan({
      pets: [],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ['quiz_3', 'speak_1', 'feed_1'],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
    });

    expect(plan.kind).toBe('learn');
    expect(plan.action).toBe('tasks');
  });

  it('returns a safe empty state when there are no pets or eggs', () => {
    const plan = buildPetDailyPlan({
      pets: [],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 5, quizToday: 3, speakToday: 1 },
      claimedToday: allTasksClaimed,
    });

    expect(plan.kind).toBe('empty');
    expect(plan.action).toBe('dex');
    expect(plan.title).toContain('第一位');
  });

  it('recommends empty state before collection when there are no pets or eggs', () => {
    const plan = buildPetDailyPlan({
      pets: [],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 5, quizToday: 3, speakToday: 1 },
      claimedToday: allTasksClaimed,
      totalPetKinds: 4,
      ownedCount: 2,
    });

    expect(plan.kind).toBe('empty');
    expect(plan.action).toBe('dex');
  });

  it('returns collection state after care, eggs, claims, and learning are settled', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 5, quizToday: 3, speakToday: 1 },
      claimedToday: allTasksClaimed,
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
      totalPetKinds: 4,
      ownedCount: 1,
    });

    expect(plan.kind).toBe('collection');
    expect(plan.action).toBe('dex');
    expect(plan.title).toContain('3');
  });

  it('skips unknown eggs when looking for hatchable recommendations', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [{ id: 'egg-1', petId: 'unknown', rarity: 'N', progress: 10 }],
      eggHatchTasks: { N: 10 },
      isKnownEgg: egg => egg.petId !== 'unknown',
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 3, speakToday: 1 },
      claimedToday: ['quiz_3', 'speak_1', 'feed_1'],
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 0, total: 0 },
    });

    expect(plan.kind).toBe('learn');
  });
});

describe('DailyPetPlan', () => {
  it('renders the recommendation, learning chips, and dispatches the selected action', () => {
    const onAction = vi.fn();
    const plan = {
      kind: 'hatch',
      action: 'eggs',
      tone: '#EF9F27',
      title: '1 顆蛋可以孵化',
      description: '先把完成進度的蛋孵化。',
      buttonLabel: '查看蛋',
    };
    const learningProgress = [
      { id: 'srs_5', text: 'SRS 3/5', pct: 60, done: false, tone: '#7B61FF' },
      { id: 'quiz_3', text: 'Quiz 3/3', pct: 100, done: true, tone: '#185FA5' },
      { id: 'speak_1', text: 'Speaking 0/1', pct: 0, done: false, tone: '#1D9E75' },
    ];

    render(
      <DailyPetPlan
        plan={plan}
        learningProgress={learningProgress}
        onAction={onAction}
        S={{
          card: {},
          btn: {},
          bg1: '#ffffff',
          bg2: '#f3f2ee',
          bd: '#ddd',
          t1: '#222',
          t2: '#555',
          t3: '#777',
        }}
        c={{ cl: '#1D9E75', ac: '#0F6E56', bg: '#E1F5EE' }}
      />
    );

    expect(screen.getByTestId('pet-daily-plan')).toHaveTextContent('1 顆蛋可以孵化');
    expect(screen.getByTestId('pet-learning-chip-srs_5')).toHaveTextContent('SRS 3/5');
    expect(screen.getByTestId('pet-learning-chip-quiz_3')).toHaveTextContent('Quiz 3/3');
    expect(screen.getByTestId('pet-learning-chip-speak_1')).toHaveTextContent('Speaking 0/1');

    fireEvent.click(screen.getByRole('button', { name: '查看蛋' }));

    expect(onAction).toHaveBeenCalledWith('eggs', plan);
  });
});
