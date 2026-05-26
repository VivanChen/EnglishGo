import { describe, expect, it } from 'vitest';
import { buildLearningProgress, buildPetDailyPlan } from './PetDailyPlan.jsx';

const learningTaskDefs = [
  { id: 'srs_5', label: 'SRS', target: 5, statKey: 'srsToday' },
  { id: 'quiz_3', label: 'Quiz', target: 3, statKey: 'quizToday' },
  { id: 'speak_1', label: 'Speaking', target: 1, statKey: 'speakToday' },
  { id: 'feed_1', label: 'Feed', target: 1, statKey: 'feedToday' },
];

describe('buildLearningProgress', () => {
  it('returns learning progress chips for unfinished daily learning tasks', () => {
    const progress = buildLearningProgress({
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 3, quizToday: 1, speakToday: 0 },
    });

    expect(progress.map(item => item.id)).toEqual(['srs_5', 'quiz_3', 'speak_1']);
    expect(progress.map(item => item.label)).toEqual(['SRS', 'Quiz', 'Speaking']);
    expect(progress.map(item => item.text)).toEqual(['SRS 3/5', 'Quiz 1/3', 'Speaking 0/1']);
    expect(progress.map(item => item.done)).toEqual([false, false, false]);
  });
});

describe('buildPetDailyPlan', () => {
  it('recommends hatchable eggs before claimable tasks and care', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      eggs: [{ id: 'egg-1', petId: 'cat', rarity: 'N', progress: 10 }],
      eggHatchTasks: { N: 10, R: 15 },
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { feedToday: 1 },
      claimedToday: [],
      quickCarePlan: { feed: 1, clean: 0, sleep: 0, needsFood: 0, total: 1 },
    });

    expect(plan.kind).toBe('hatch');
    expect(plan.action).toBe('eggs');
    expect(plan.title).toContain('1');
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

  it('recommends quick care before food buying when actionable care exists', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: learningTaskDefs.map(task => task.id),
      quickCarePlan: { feed: 1, clean: 1, sleep: 0, needsFood: 0, total: 2 },
    });

    expect(plan.kind).toBe('quickCare');
    expect(plan.action).toBe('quickCare');
    expect(plan.description).toContain('餵食 1');
    expect(plan.description).toContain('清潔 1');
  });

  it('recommends shop when only needsFood exists', () => {
    const plan = buildPetDailyPlan({
      pets: [{ id: 'pet-1' }],
      dailyTaskDefs: learningTaskDefs,
      claimedToday: learningTaskDefs.map(task => task.id),
      quickCarePlan: { feed: 0, clean: 0, sleep: 0, needsFood: 2, total: 0 },
    });

    expect(plan.kind).toBe('shop');
    expect(plan.action).toBe('shop');
    expect(plan.title).toContain('補食物');
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

  it('returns a safe empty state when there are no pets or eggs', () => {
    const plan = buildPetDailyPlan({
      pets: [],
      eggs: [],
      dailyTaskDefs: learningTaskDefs,
      taskCounts: { srsToday: 5, quizToday: 3, speakToday: 1 },
      claimedToday: learningTaskDefs.map(task => task.id),
    });

    expect(plan.kind).toBe('empty');
    expect(plan.action).toBe('dex');
    expect(plan.title).toContain('第一位');
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
