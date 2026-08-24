
'use strict';

/*
 * IRON CORE
 * Workout Data Engine
 *
 * - IndexedDB
 * - Exercise database
 * - Workout records
 * - Set records
 * - Body data
 * - Settings
 * - PR / volume / 1RM calculation
 */

const APP = {
  DB_NAME: 'iron-core-db',
  DB_VERSION: 1,

  STORES: {
    exercises: 'exercises',
    workouts: 'workouts',
    sets: 'sets',
    bodyData: 'bodyData',
    settings: 'settings'
  }
};

let db = null;

/* =========================================================
   Utility
========================================================= */

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* =========================================================
   IndexedDB
========================================================= */

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP.DB_NAME, APP.DB_VERSION);

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(APP.STORES.exercises)) {
        const store = database.createObjectStore(
          APP.STORES.exercises,
          { keyPath: 'id' }
        );

        store.createIndex('category', 'category', {
          unique: false
        });

        store.createIndex('name', 'name', {
          unique: false
        });
      }

      if (!database.objectStoreNames.contains(APP.STORES.workouts)) {
        const store = database.createObjectStore(
          APP.STORES.workouts,
          { keyPath: 'id' }
        );

        store.createIndex('date', 'date', {
          unique: false
        });

        store.createIndex('status', 'status', {
          unique: false
        });
      }

      if (!database.objectStoreNames.contains(APP.STORES.sets)) {
        const store = database.createObjectStore(
          APP.STORES.sets,
          { keyPath: 'id' }
        );

        store.createIndex('workoutId', 'workoutId', {
          unique: false
        });

        store.createIndex('exerciseId', 'exerciseId', {
          unique: false
        });
      }

      if (!database.objectStoreNames.contains(APP.STORES.bodyData)) {
        const store = database.createObjectStore(
          APP.STORES.bodyData,
          { keyPath: 'id' }
        );

        store.createIndex('date', 'date', {
          unique: false
        });
      }

      if (!database.objectStoreNames.contains(APP.STORES.settings)) {
        database.createObjectStore(
          APP.STORES.settings,
          { keyPath: 'key' }
        );
      }
    };

    request.onsuccess = event => {
      db = event.target.result;

      db.onerror = event => {
        console.error(
          'IndexedDB error:',
          event.target.error
        );
      };

      resolve(db);
    };

    request.onerror = event => {
      reject(event.target.error);
    };
  });
}

/* =========================================================
   Generic DB helpers
========================================================= */

function addRecord(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    );

    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    );

    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

function getRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readonly'
    );

    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readonly'
    );

    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    );

    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/* =========================================================
   Exercise Database
========================================================= */

async function loadExercises() {
  const response = await fetch('./exercises.json');

  if (!response.ok) {
    throw new Error(
      `exercises.json の読み込みに失敗しました: ${response.status}`
    );
  }

  const exercises = await response.json();

  const transaction = db.transaction(
    APP.STORES.exercises,
    'readwrite'
  );

  const store = transaction.objectStore(
    APP.STORES.exercises
  );

  for (const exercise of exercises) {
    store.put(exercise);
  }

  return exercises;
}

async function getExercises() {
  return getAllRecords(APP.STORES.exercises);
}

async function getExercise(id) {
  return getRecord(APP.STORES.exercises, id);
}

async function getExercisesByCategory(category) {
  const exercises = await getExercises();

  return exercises.filter(
    exercise => exercise.category === category
  );
}

/* =========================================================
   Workout
========================================================= */

async function createWorkout({
  name = 'Workout',
  category = '',
  notes = ''
} = {}) {
  const workout = {
    id: generateId('workout'),
    date: nowISO(),
    name,
    category,
    notes,
    status: 'active',
    startedAt: nowISO(),
    completedAt: null
  };

  await addRecord(
    APP.STORES.workouts,
    workout
  );

  return workout;
}

async function completeWorkout(workoutId) {
  const workout = await getRecord(
    APP.STORES.workouts,
    workoutId
  );

  if (!workout) {
    throw new Error('Workout が見つかりません。');
  }

  workout.status = 'completed';
  workout.completedAt = nowISO();

  return putRecord(
    APP.STORES.workouts,
    workout
  );
}

async function getWorkout(workoutId) {
  return getRecord(
    APP.STORES.workouts,
    workoutId
  );
}

async function getWorkouts() {
  const workouts = await getAllRecords(
    APP.STORES.workouts
  );

  return workouts.sort(
    (a, b) =>
      new Date(b.date) - new Date(a.date)
  );
}

/* =========================================================
   Set Records
========================================================= */

async function addSet({
  workoutId,
  exerciseId,
  setNumber,
  weight = 0,
  reps = 0,
  duration = 0,
  completed = false,
  notes = ''
}) {
  if (!workoutId) {
    throw new Error('workoutId が必要です。');
  }

  if (!exerciseId) {
    throw new Error('exerciseId が必要です。');
  }

  const set = {
    id: generateId('set'),
    workoutId,
    exerciseId,
    setNumber,
    weight: Number(weight) || 0,
    reps: Number(reps) || 0,
    duration: Number(duration) || 0,
    completed,
    notes,
    createdAt: nowISO()
  };

  await addRecord(
    APP.STORES.sets,
    set
  );

  return set;
}

async function updateSet(setId, updates) {
  const set = await getRecord(
    APP.STORES.sets,
    setId
  );

  if (!set) {
    throw new Error('セットが見つかりません。');
  }

  Object.assign(set, updates);

  return putRecord(
    APP.STORES.sets,
    set
  );
}

async function getWorkoutSets(workoutId) {
  const sets = await getAllRecords(
    APP.STORES.sets
  );

  return sets
    .filter(set => set.workoutId === workoutId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

async function getExerciseSets(exerciseId) {
  const sets = await getAllRecords(
    APP.STORES.sets
  );

  return sets
    .filter(set => set.exerciseId === exerciseId)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );
}

/* =========================================================
   Volume
========================================================= */

function calculateSetVolume(set) {
  return (
    Number(set.weight || 0) *
    Number(set.reps || 0)
  );
}

async function calculateWorkoutVolume(workoutId) {
  const sets = await getWorkoutSets(workoutId);

  return round(
    sets.reduce(
      (total, set) =>
        total + calculateSetVolume(set),
      0
    ),
    1
  );
}

/* =========================================================
   1RM
========================================================= */

/*
 * Epley Formula
 *
 * 1RM = weight × (1 + reps / 30)
 */

function calculate1RM(weight, reps) {
  weight = Number(weight);
  reps = Number(reps);

  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(reps) ||
    weight <= 0 ||
    reps <= 0
  ) {
    return 0;
  }

  if (reps === 1) {
    return weight;
  }

  return round(
    weight * (1 + reps / 30),
    1
  );
}

/* =========================================================
   Personal Records
========================================================= */

async function getExercisePR(exerciseId) {
  const sets = await getExerciseSets(exerciseId);

  if (!sets.length) {
    return {
      maxWeight: 0,
      maxReps: 0,
      maxVolume: 0,
      estimated1RM: 0,
      bestSet: null
    };
  }

  const maxWeight = Math.max(
    ...sets.map(set => Number(set.weight) || 0)
  );

  const maxReps = Math.max(
    ...sets.map(set => Number(set.reps) || 0)
  );

  const maxVolume = Math.max(
    ...sets.map(set => calculateSetVolume(set))
  );

  let bestSet = null;
  let estimated1RM = 0;

  for (const set of sets) {
    const oneRM = calculate1RM(
      set.weight,
      set.reps
    );

    if (oneRM > estimated1RM) {
      estimated1RM = oneRM;
      bestSet = set;
    }
  }

  return {
    maxWeight: round(maxWeight, 1),
    maxReps,
    maxVolume: round(maxVolume, 1),
    estimated1RM,
    bestSet
  };
}

/* =========================================================
   Body Data
========================================================= */

async function addBodyData({
  weight,
  bodyFat = null,
  muscleMass = null,
  notes = ''
}) {
  const data = {
    id: generateId('body'),
    date: nowISO(),
    weight:
      weight === null || weight === undefined
        ? null
        : Number(weight),
    bodyFat:
      bodyFat === null || bodyFat === undefined
        ? null
        : Number(bodyFat),
    muscleMass:
      muscleMass === null ||
      muscleMass === undefined
        ? null
        : Number(muscleMass),
    notes
  };

  return addRecord(
    APP.STORES.bodyData,
    data
  );
}

async function getBodyData() {
  const data = await getAllRecords(
    APP.STORES.bodyData
  );

  return data.sort(
    (a, b) =>
      new Date(a.date) -
      new Date(b.date)
  );
}

/* =========================================================
   Settings
========================================================= */

async function setSetting(key, value) {
  return putRecord(
    APP.STORES.settings,
    {
      key,
      value
    }
  );
}

async function getSetting(key, defaultValue = null) {
  const result = await getRecord(
    APP.STORES.settings,
    key
  );

  return result
    ? result.value
    : defaultValue;
}

/* =========================================================
   Backup / Restore
========================================================= */

async function exportData() {
  const data = {
    version: 1,
    exportedAt: nowISO(),

    workouts: await getAllRecords(
      APP.STORES.workouts
    ),

    sets: await getAllRecords(
      APP.STORES.sets
    ),

    bodyData: await getAllRecords(
      APP.STORES.bodyData
    ),

    settings: await getAllRecords(
      APP.STORES.settings
    )
  };

  return data;
}

async function importData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error(
      'バックアップデータが不正です。'
    );
  }

  const transaction = db.transaction(
    [
      APP.STORES.workouts,
      APP.STORES.sets,
      APP.STORES.bodyData,
      APP.STORES.settings
    ],
    'readwrite'
  );

  const stores = {
    workouts: transaction.objectStore(
      APP.STORES.workouts
    ),

    sets: transaction.objectStore(
      APP.STORES.sets
    ),

    bodyData: transaction.objectStore(
      APP.STORES.bodyData
    ),

    settings: transaction.objectStore(
      APP.STORES.settings
    )
  };

  for (const workout of data.workouts || []) {
    stores.workouts.put(workout);
  }

  for (const set of data.sets || []) {
    stores.sets.put(set);
  }

  for (const body of data.bodyData || []) {
    stores.bodyData.put(body);
  }

  for (const setting of data.settings || []) {
    stores.settings.put(setting);
  }

  return true;
}

/* =========================================================
   App Initialization
========================================================= */

async function initializeApp() {
  try {
    await openDatabase();

    // exercises.json を常に最新状態で
    // IndexedDBへ同期する
    const exercises =
      await loadExercises();

    console.log(
      'IRON CORE initialized successfully.'
    );

    console.log(
      `Exercise database: ${
        exercises.length
      } exercises`
    );

  } catch (error) {
    console.error(
      'IRON CORE initialization failed:',
      error
    );
  }
}

/* =========================================================
   Global API
========================================================= */

window.IronCore = {
  generateId,

  openDatabase,

  getExercises,
  getExercise,
  getExercisesByCategory,

  createWorkout,
  completeWorkout,
  getWorkout,
  getWorkouts,

  addSet,
  updateSet,
  getWorkoutSets,
  getExerciseSets,

  calculateSetVolume,
  calculateWorkoutVolume,

  calculate1RM,
  getExercisePR,

  addBodyData,
  getBodyData,

  setSetting,
  getSetting,

  exportData,
  importData
};
/* =========================================================
   UI Navigation
========================================================= */

function setupNavigation() {
  const buttons = document.querySelectorAll(
    '.nav-button'
  );

  const screens = document.querySelectorAll(
    '.screen'
  );

  buttons.forEach(button => {
    button.addEventListener('click', () => {

      const targetId =
        button.dataset.screen;

      if (!targetId) {
        return;
      }

      // 全画面を非表示
      screens.forEach(screen => {
        screen.classList.remove('active');
      });

      // 対象画面を表示
      const target =
        document.getElementById(targetId);

      if (target) {
        target.classList.add('active');
      }

      // ナビのactive状態を変更
      buttons.forEach(item => {
        item.classList.remove('active');
      });

      button.classList.add('active');
    });
  });
}
/* =========================================================
   IRON CORE UI
   Exercise Database / Navigation / Workout UI
========================================================= */

let currentExerciseCategory = 'all';
let currentWorkoutId = null;
let currentWorkoutExercises = [];

/* =========================================================
   Safe HTML
========================================================= */

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   Screen Navigation
========================================================= */

function showScreen(screenId) {
  const screens =
    document.querySelectorAll('.screen');

  screens.forEach(screen => {
    screen.classList.remove('active');
  });

  const target =
    document.getElementById(screenId);

  if (target) {
    target.classList.add('active');
  }

  const buttons =
    document.querySelectorAll('.nav-button');

  buttons.forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.screen === screenId
    );
  });
}

function setupNavigation() {
  const buttons =
    document.querySelectorAll('.nav-button');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const target =
        button.dataset.screen;

      if (target) {
        showScreen(target);
      }
    });
  });
}

/* =========================================================
   Exercise Name Helpers
========================================================= */

function getExerciseName(exercise) {
  return (
    exercise.name ||
    exercise.nameJa ||
    exercise.name_jp ||
    exercise.name_en ||
    exercise.title ||
    exercise.id ||
    'UNKNOWN EXERCISE'
  );
}

function getExerciseEnglishName(exercise) {
  return (
    exercise.name_en ||
    exercise.englishName ||
    exercise.nameEnglish ||
    ''
  );
}

function getExerciseEquipment(exercise) {
  return (
    exercise.equipment ||
    exercise.equipmentType ||
    exercise.tool ||
    '—'
  );
}

function getExerciseDescription(exercise) {
  return (
    exercise.description ||
    exercise.descriptionJa ||
    exercise.instructions ||
    '説明は登録されていません。'
  );
}

/* =========================================================
   Exercise Database
========================================================= */

async function renderExerciseDatabase(
  category = currentExerciseCategory
) {
  const container =
    document.getElementById(
      'exerciseDatabaseList'
    );

  if (!container) {
    return;
  }

  currentExerciseCategory = category;

  let exercises = [];

  try {
    exercises = await getExercises();
  } catch (error) {
    console.error(
      'Exercise database error:',
      error
    );

    container.innerHTML = `
      <div class="empty-state">
        <strong>DATABASE ERROR</strong>
        <span>種目データを読み込めませんでした。</span>
      </div>
    `;

    return;
  }

  if (category !== 'all') {
    exercises =
      exercises.filter(
        exercise =>
          exercise.category === category
      );
  }

  exercises.sort((a, b) =>
    getExerciseName(a).localeCompare(
      getExerciseName(b),
      'ja'
    )
  );

  if (!exercises.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div>💪</div>
        <strong>NO EXERCISES</strong>
        <span>
          このカテゴリーには種目がありません。
        </span>
      </div>
    `;

    return;
  }

  container.innerHTML =
    exercises.map(exercise => {

      const name =
        getExerciseName(exercise);

      const english =
        getExerciseEnglishName(exercise);

      const equipment =
        getExerciseEquipment(exercise);

      return `
        <article
          class="exercise-card"
          data-exercise-id="${escapeHTML(
            exercise.id
          )}"
          role="button"
          tabindex="0"
        >

          <div class="exercise-card-main">

            <div class="exercise-card-title">
              ${escapeHTML(name)}
            </div>

            ${
              english
                ? `
                  <div class="exercise-card-subtitle">
                    ${escapeHTML(english)}
                  </div>
                `
                : ''
            }

          </div>

          <div class="exercise-card-meta">
            ${escapeHTML(equipment)}
          </div>

        </article>
      `;
    }).join('');
}

/* =========================================================
   Exercise Detail
========================================================= */

async function openExerciseDetail(
  exerciseId
) {
  const exercise =
    await getExercise(exerciseId);

  if (!exercise) {
    alert('種目データが見つかりません。');
    return;
  }

  const name =
    getExerciseName(exercise);

  const english =
    getExerciseEnglishName(exercise);

  const category =
    exercise.category || '—';

  const equipment =
    getExerciseEquipment(exercise);

  const description =
    getExerciseDescription(exercise);

  const pr =
    await getExercisePR(exerciseId);

  const detailHTML = `
    <div
      class="modal exercise-detail-modal"
      id="exerciseDetailModal"
    >

      <div
        class="modal-backdrop"
        data-close-exercise-detail="true"
      ></div>

      <div class="modal-card">

        <div class="modal-header">

          <div>
            <span class="eyebrow">
              EXERCISE
            </span>

            <h3>
              ${escapeHTML(name)}
            </h3>

            ${
              english
                ? `
                  <small>
                    ${escapeHTML(english)}
                  </small>
                `
                : ''
            }
          </div>

          <button
            type="button"
            id="closeExerciseDetail"
          >
            ×
          </button>

        </div>

        <div class="exercise-detail-content">

          <div class="exercise-detail-row">
            <span>CATEGORY</span>
            <strong>
              ${escapeHTML(category)}
            </strong>
          </div>

          <div class="exercise-detail-row">
            <span>EQUIPMENT</span>
            <strong>
              ${escapeHTML(equipment)}
            </strong>
          </div>

          <div class="exercise-detail-description">
            <span>DESCRIPTION</span>

            <p>
              ${escapeHTML(description)}
            </p>
          </div>

          <div class="exercise-detail-pr">

            <span>PERSONAL RECORD</span>

            <strong>
              ${
                pr.maxWeight
                  ? `${pr.maxWeight} kg`
                  : 'NO RECORD'
              }
            </strong>

            <small>
              ${
                pr.estimated1RM
                  ? `EST. 1RM ${pr.estimated1RM} kg`
                  : ''
              }
            </small>

          </div>

          <button
            type="button"
            class="primary-button"
            id="addDetailExerciseButton"
          >
            ＋ ADD TO WORKOUT
          </button>

        </div>

      </div>

    </div>
  `;

  const existing =
    document.getElementById(
      'exerciseDetailModal'
    );

  if (existing) {
    existing.remove();
  }

  document.body.insertAdjacentHTML(
    'beforeend',
    detailHTML
  );

  const modal =
    document.getElementById(
      'exerciseDetailModal'
    );

  const close =
    () => modal?.remove();

  document
    .getElementById(
      'closeExerciseDetail'
    )
    ?.addEventListener(
      'click',
      close
    );

  modal
    ?.querySelector(
      '[data-close-exercise-detail="true"]'
    )
    ?.addEventListener(
      'click',
      close
    );

  document
    .getElementById(
      'addDetailExerciseButton'
    )
    ?.addEventListener(
      'click',
      async () => {

        await addExerciseToWorkout(
          exercise
        );

        close();

        showScreen(
          'workoutScreen'
        );
      }
    );
}

/* =========================================================
   Exercise Card Events
========================================================= */

function setupExerciseCardEvents() {
  const container =
    document.getElementById(
      'exerciseDatabaseList'
    );

  if (!container) {
    return;
  }

  container.addEventListener(
    'click',
    event => {

      const card =
        event.target.closest(
          '.exercise-card'
        );

      if (!card) {
        return;
      }

      const exerciseId =
        card.dataset.exerciseId;

      if (exerciseId) {
        openExerciseDetail(
          exerciseId
        );
      }
    }
  );

  container.addEventListener(
    'keydown',
    event => {

      if (
        event.key !== 'Enter' &&
        event.key !== ' '
      ) {
        return;
      }

      const card =
        event.target.closest(
          '.exercise-card'
        );

      if (!card) {
        return;
      }

      event.preventDefault();

      const exerciseId =
        card.dataset.exerciseId;

      if (exerciseId) {
        openExerciseDetail(
          exerciseId
        );
      }
    }
  );
}

/* =========================================================
   Exercise Filters
========================================================= */

function setupExerciseFilters() {
  const buttons =
    document.querySelectorAll(
      '.filter-button'
    );

  buttons.forEach(button => {

    button.addEventListener(
      'click',
      async () => {

        buttons.forEach(item => {
          item.classList.remove(
            'active'
          );
        });

        button.classList.add(
          'active'
        );

        const category =
          button.dataset.category ||
          'all';

        await renderExerciseDatabase(
          category
        );
      }
    );
  });
}

/* =========================================================
   Workout
========================================================= */

async function ensureWorkout() {

  if (currentWorkoutId) {
    const existing =
      await getWorkout(
        currentWorkoutId
      );

    if (
      existing &&
      existing.status === 'active'
    ) {
      return existing;
    }
  }

  const workout =
    await createWorkout({
      name: 'FREE WORKOUT'
    });

  currentWorkoutId =
    workout.id;

  currentWorkoutExercises = [];

  return workout;
}

async function addExerciseToWorkout(
  exercise
) {
  const workout =
    await ensureWorkout();

  const alreadyAdded =
    currentWorkoutExercises.some(
      item =>
        item.id === exercise.id
    );

  if (!alreadyAdded) {
    currentWorkoutExercises.push(
      exercise
    );
  }

  await renderWorkout();

  showScreen(
    'workoutScreen'
  );

  return workout;
}

async function getPreviousExerciseSet(exerciseId, currentWorkoutId) {
  const currentWorkout = currentWorkoutId
    ? await getWorkout(currentWorkoutId)
    : null;

  const workouts = await getWorkouts();
  const previousWorkouts = workouts
    .filter(workout =>
      workout.status === 'completed' &&
      (!currentWorkout ||
        new Date(workout.date) <
          new Date(currentWorkout.startedAt || currentWorkout.date))
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const workout of previousWorkouts) {
    const sets = await getWorkoutSets(workout.id);
    const exerciseSets = sets.filter(
      set => set.exerciseId === exerciseId && set.completed
    );

    if (exerciseSets.length) {
      const bestSet = [...exerciseSets].sort((a, b) => {
        const volumeDiff = calculateSetVolume(b) - calculateSetVolume(a);
        if (volumeDiff !== 0) return volumeDiff;
        return Number(b.weight || 0) - Number(a.weight || 0);
      })[0];

      return {
        workout,
        set: bestSet
      };
    }
  }

  return null;
}

function getProgressMessage(previousSet, currentWeight, currentReps) {
  if (!previousSet) return '';

  const weight = Number(currentWeight || 0);
  const reps = Number(currentReps || 0);
  if (weight <= 0 || reps <= 0) return '';

  const previousWeight = Number(previousSet.weight || 0);
  const previousReps = Number(previousSet.reps || 0);

  if (weight > previousWeight) {
    return '🔥 WEIGHT UP';
  }

  if (weight === previousWeight && reps > previousReps) {
    return `🔥 +${reps - previousReps} REPS`;
  }

  if (weight === previousWeight && reps === previousReps) {
    return '⚡ MATCHED';
  }

  return '';
}

function renderSetProgressBadge(previousSet, set) {
  const message = getProgressMessage(
    previousSet,
    set.weight,
    set.reps
  );

  return message
    ? `<span class="set-progress-badge">${escapeHTML(message)}</span>`
    : '';
}

async function renderWorkout() {
  const container =
    document.getElementById('exerciseList');

  if (!container) {
    return;
  }

  if (!currentWorkoutExercises.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🏋️</div>
        <strong>NO EXERCISES YET</strong>
        <span>＋ ADD EXERCISE から種目を追加してください。</span>
      </div>
    `;
    return;
  }

  const workout = currentWorkoutId
    ? await getWorkout(currentWorkoutId)
    : null;

  const allCurrentSets = currentWorkoutId
    ? await getWorkoutSets(currentWorkoutId)
    : [];

  let html = '';

  for (let index = 0; index < currentWorkoutExercises.length; index++) {
    const exercise = currentWorkoutExercises[index];
    const name = getExerciseName(exercise);
    const exerciseSets = allCurrentSets.filter(
      set => set.exerciseId === exercise.id
    );
    const previous = await getPreviousExerciseSet(
      exercise.id,
      currentWorkoutId
    );

    const previousHTML = previous
      ? `
        <div class="previous-performance">
          <span>PREVIOUS BEST</span>
          <strong>${previous.set.weight} kg × ${previous.set.reps} reps</strong>
          <small>${new Date(previous.workout.date).toLocaleDateString('ja-JP')}</small>
        </div>
      `
      : `
        <div class="previous-performance previous-empty">
          <span>PREVIOUS BEST</span>
          <strong>NO RECORD</strong>
        </div>
      `;

    html += `
      <article
        class="exercise-card workout-exercise-card"
        data-workout-exercise-index="${index}"
      >
        <div class="exercise-card-main">
          <div>
            <div class="exercise-card-title">
              ${escapeHTML(name)}
            </div>
            <div class="exercise-card-subtitle">
              ${escapeHTML(getExerciseEquipment(exercise))}
            </div>
          </div>
        </div>

        ${previousHTML}

        <div class="workout-set-area">
          ${
            exerciseSets.length
              ? exerciseSets.map((set, setIndex) => `
                  <div class="workout-set-row completed-set-row">
                    <span>SET ${setIndex + 1}</span>
                    <strong>${set.weight} kg × ${set.reps} reps</strong>
                    ${renderSetProgressBadge(previous?.set, set)}
                    <span class="set-check">✓</span>
                  </div>
                `).join('')
              : `
                <div class="workout-no-sets">
                  まだセットがありません
                </div>
              `
          }

          <div class="workout-input-row">
            <input
              type="number"
              min="0"
              step="0.5"
              inputmode="decimal"
              placeholder="重量 kg"
              class="workout-weight-input"
              data-exercise-id="${escapeHTML(exercise.id)}"
            />

            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              placeholder="回数"
              class="workout-reps-input"
              data-exercise-id="${escapeHTML(exercise.id)}"
            />

            <button
              type="button"
              class="primary-button add-set-button"
              data-exercise-id="${escapeHTML(exercise.id)}"
            >
              ＋ SET
            </button>
          </div>
        </div>
      </article>
    `;
  }

  container.innerHTML = html;

  container
    .querySelectorAll('.add-set-button')
    .forEach(button => {
      button.addEventListener('click', async () => {
        const exerciseId = button.dataset.exerciseId;

        const weightInput = container.querySelector(
          `.workout-weight-input[data-exercise-id="${exerciseId}"]`
        );
        const repsInput = container.querySelector(
          `.workout-reps-input[data-exercise-id="${exerciseId}"]`
        );

        const weight = Number(weightInput?.value || 0);
        const reps = Number(repsInput?.value || 0);

        if (weight <= 0 || reps <= 0) {
          alert('重量と回数を入力してください。');
          return;
        }

        const existingSets = currentWorkoutId
          ? await getWorkoutSets(currentWorkoutId)
          : [];

        const exerciseSets = existingSets.filter(
          set => set.exerciseId === exerciseId
        );

        await addSet({
          workoutId: currentWorkoutId,
          exerciseId,
          setNumber: exerciseSets.length + 1,
          weight,
          reps,
          completed: true
        });

        weightInput.value = '';
        repsInput.value = '';

        await renderWorkout();

        // セット完了と同時に90秒レストを開始。
        openRestTimer(90);
      });
    });
}

/* =========================================================
   Workout Buttons
========================================================= */

function setupWorkoutButtons() {

  document
    .getElementById(
      'startWorkoutButton'
    )
    ?.addEventListener(
      'click',
      async () => {

        await ensureWorkout();

        await renderWorkout();

        showScreen(
          'workoutScreen'
        );
      }
    );

  document
    .getElementById(
      'addExerciseButton'
    )
    ?.addEventListener(
      'click',
      async () => {

        await renderExerciseSelectModal();

      }
    );

  document
    .getElementById(
      'finishWorkoutButton'
    )
    ?.addEventListener(
      'click',
      async () => {

        if (!currentWorkoutId) {
          showScreen('homeScreen');
          return;
        }

        const workout =
          await getWorkout(
            currentWorkoutId
          );

        if (
          workout &&
          workout.status === 'active'
        ) {
          await completeWorkout(
            currentWorkoutId
          );
        }

        currentWorkoutId = null;
        currentWorkoutExercises = [];

        await renderWorkout();

        showScreen(
          'homeScreen'
        );
      }
    );
}

/* =========================================================
   Workout Exercise Select Modal
========================================================= */

async function renderExerciseSelectModal() {

  const modal =
    document.getElementById(
      'exerciseModal'
    );

  const list =
    document.getElementById(
      'exerciseSelectList'
    );

  if (!modal || !list) {
    return;
  }

  const exercises =
    await getExercises();

  list.innerHTML =
    exercises
      .map(exercise => {

        return `
          <button
            type="button"
            class="exercise-select-item"
            data-exercise-id="${escapeHTML(
              exercise.id
            )}"
          >
            <strong>
              ${escapeHTML(
                getExerciseName(
                  exercise
                )
              )}
            </strong>

            <small>
              ${escapeHTML(
                getExerciseEquipment(
                  exercise
                )
              )}
            </small>
          </button>
        `;
      })
      .join('');

  modal.classList.remove(
    'hidden'
  );

  list
    .querySelectorAll(
      '.exercise-select-item'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const exercise =
            await getExercise(
              button.dataset.exerciseId
            );

          if (exercise) {
            await addExerciseToWorkout(
              exercise
            );
          }

          modal.classList.add(
            'hidden'
          );
        }
      );
    });
}

/* =========================================================
   Exercise Select Modal Controls
========================================================= */

function setupExerciseModal() {

  const modal =
    document.getElementById(
      'exerciseModal'
    );

  const close =
    document.getElementById(
      'closeExerciseModal'
    );

  const backdrop =
    modal?.querySelector(
      '.modal-backdrop'
    );

  const search =
    document.getElementById(
      'exerciseSearchInput'
    );

  const list =
    document.getElementById(
      'exerciseSelectList'
    );

  close?.addEventListener(
    'click',
    () => {
      modal?.classList.add(
        'hidden'
      );
    }
  );

  backdrop?.addEventListener(
    'click',
    () => {
      modal?.classList.add(
        'hidden'
      );
    }
  );

  search?.addEventListener(
    'input',
    () => {

      const query =
        search.value
          .trim()
          .toLowerCase();

      list
        ?.querySelectorAll(
          '.exercise-select-item'
        )
        .forEach(item => {

          const text =
            item.textContent
              .toLowerCase();

          item.style.display =
            !query ||
            text.includes(query)
              ? ''
              : 'none';
        });
    }
  );
}

/* =========================================================
   Body Data Modal
========================================================= */

function setupBodyDataModal() {

  const modal =
    document.getElementById(
      'bodyDataModal'
    );

  const open =
    document.getElementById(
      'addBodyDataButton'
    );

  const close =
    document.getElementById(
      'closeBodyDataModal'
    );

  const save =
    document.getElementById(
      'saveBodyDataButton'
    );

  open?.addEventListener(
    'click',
    () => {
      modal?.classList.remove(
        'hidden'
      );
    }
  );

  close?.addEventListener(
    'click',
    () => {
      modal?.classList.add(
        'hidden'
      );
    }
  );

  modal
    ?.querySelector(
      '.modal-backdrop'
    )
    ?.addEventListener(
      'click',
      () => {
        modal.classList.add(
          'hidden'
        );
      }
    );

  save?.addEventListener(
    'click',
    async () => {

      const weight =
        document.getElementById(
          'bodyWeightInput'
        )?.value;

      const bodyFat =
        document.getElementById(
          'bodyFatInput'
        )?.value;

      const muscleMass =
        document.getElementById(
          'muscleMassInput'
        )?.value;

      if (!weight) {
        alert(
          '体重を入力してください。'
        );

        return;
      }

      await addBodyData({
        weight,
        bodyFat:
          bodyFat || null,
        muscleMass:
          muscleMass || null
      });

      modal?.classList.add(
        'hidden'
      );

      await updateHomeStats();
    }
  );
}

/* =========================================================
   Home Stats
========================================================= */

async function updateHomeStats() {

  try {

    const workouts =
      await getWorkouts();

    const bodyData =
      await getBodyData();

    const workoutCount =
      workouts.length;

    const countElement =
      document.getElementById(
        'workoutCountValue'
      );

    if (countElement) {
      countElement.textContent =
        workoutCount;
    }

    const latestBody =
      bodyData[
        bodyData.length - 1
      ];

    if (latestBody) {

      const weight =
        document.getElementById(
          'weightValue'
        );

      const fat =
        document.getElementById(
          'bodyFatValue'
        );

      const muscle =
        document.getElementById(
          'muscleValue'
        );

      if (weight) {
        weight.textContent =
          latestBody.weight ??
          '--';
      }

      if (fat) {
        fat.textContent =
          latestBody.bodyFat ??
          '--';
      }

      if (muscle) {
        muscle.textContent =
          latestBody.muscleMass ??
          '--';
      }
    }

  } catch (error) {
    console.error(
      'Home stats error:',
      error
    );
  }
}


/* =========================================================
   Quick Stats Detail
   ・HOMEのQUICK STATSをタップすると詳細を表示
   ・既存のUIデザイン/カラーを利用
========================================================= */

function formatStatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('ja-JP', {
    maximumFractionDigits: 1
  });
}

function getLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function calculateWorkoutStreak(workouts) {
  const completedKeys = new Set(
    workouts
      .filter(workout => workout.status === 'completed')
      .map(workout => getLocalDateKey(workout.completedAt || workout.date))
      .filter(Boolean)
  );

  if (!completedKeys.size) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  const todayKey = getLocalDateKey(cursor);

  if (!completedKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!completedKeys.has(getLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (completedKeys.has(getLocalDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function calculateQuickStatsDetail() {
  const workouts = await getWorkouts();
  const bodyData = await getBodyData();

  // 直近7日間のトレーニング回数・ボリュームを集計
  const weeklyActivity = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = getLocalDateKey(day);

    weeklyActivity.push({
      key,
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      workouts: 0,
      volume: 0
    });
  }

  const weeklyByKey = new Map(
    weeklyActivity.map(day => [day.key, day])
  );

  // 前週（直近7日のさらに前の7日間）も同じデータから集計する。
  const previousWeek = { workouts: 0, volume: 0 };
  const previousWeekStart = new Date(today);
  previousWeekStart.setDate(today.getDate() - 13);
  previousWeekStart.setHours(0, 0, 0, 0);
  const previousWeekEnd = new Date(today);
  previousWeekEnd.setDate(today.getDate() - 7);
  previousWeekEnd.setHours(0, 0, 0, 0);

  const completedWorkouts = workouts
    .filter(workout => workout.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date));

  let totalVolume = 0;
  let totalSets = 0;
  const exerciseIds = new Set();

  for (const workout of completedWorkouts) {
    const sets = await getWorkoutSets(workout.id);
    const workoutDateKey =
      getLocalDateKey(workout.completedAt || workout.date);

    const weeklyDay = weeklyByKey.get(workoutDateKey);
    if (weeklyDay) weeklyDay.workouts++;

    const workoutDate = new Date(workout.completedAt || workout.date);
    workoutDate.setHours(0, 0, 0, 0);
    const isPreviousWeek = workoutDate >= previousWeekStart && workoutDate <= previousWeekEnd;
    if (isPreviousWeek) previousWeek.workouts++;

    for (const set of sets) {
      if (!set.completed) continue;

      const setVolume = calculateSetVolume(set);
      totalSets++;
      totalVolume += setVolume;

      if (weeklyDay) weeklyDay.volume += setVolume;
      if (isPreviousWeek) previousWeek.volume += setVolume;
      if (set.exerciseId) exerciseIds.add(set.exerciseId);
    }
  }

  let personalRecords = 0;
  for (const exerciseId of exerciseIds) {
    const pr = await getExercisePR(exerciseId);
    if (pr && Number(pr.maxWeight || 0) > 0) personalRecords++;
  }

  const latestBody = bodyData[bodyData.length - 1] || null;
  const streak = calculateWorkoutStreak(workouts);

  return {
    workouts: completedWorkouts.length,
    streak,
    volume: totalVolume,
    sets: totalSets,
    personalRecords,
    latestBody,
    recent: completedWorkouts.slice(0, 5),
    weeklyActivity,
    previousWeek
  };
}

function formatComparisonPercent(current, previous) {
  if (previous === 0) {
    return current > 0 ? 'NEW' : '—';
  }
  const percent = ((current - previous) / previous) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function comparisonArrow(current, previous) {
  if (previous === 0) return current > 0 ? '↗' : '—';
  if (current > previous) return '↗';
  if (current < previous) return '↘';
  return '→';
}

function renderWeeklyComparison(stats) {
  const currentWorkouts = stats.weeklyActivity.reduce((sum, day) => sum + Number(day.workouts || 0), 0);
  const currentVolume = stats.weeklyActivity.reduce((sum, day) => sum + Number(day.volume || 0), 0);
  const previous = stats.previousWeek || { workouts: 0, volume: 0 };

  const workoutPct = formatComparisonPercent(currentWorkouts, previous.workouts);
  const volumePct = formatComparisonPercent(currentVolume, previous.volume);
  const workoutArrow = comparisonArrow(currentWorkouts, previous.workouts);
  const volumeArrow = comparisonArrow(currentVolume, previous.volume);

  return `
    <div class="quick-comparison-grid">
      <div class="quick-comparison-card">
        <div class="quick-comparison-label">📅 WORKOUTS</div>
        <div class="quick-comparison-values">
          <strong>${formatStatNumber(currentWorkouts)}</strong>
          <span>vs ${formatStatNumber(previous.workouts)}</span>
        </div>
        <div class="quick-comparison-change">${escapeHTML(workoutPct)} ${escapeHTML(workoutArrow)}</div>
        <small>THIS WEEK&nbsp;&nbsp; VS LAST WEEK</small>
      </div>
      <div class="quick-comparison-card">
        <div class="quick-comparison-label">🏋️ VOLUME</div>
        <div class="quick-comparison-values">
          <strong>${formatStatNumber(currentVolume)} kg</strong>
          <span>vs ${formatStatNumber(previous.volume)} kg</span>
        </div>
        <div class="quick-comparison-change">${escapeHTML(volumePct)} ${escapeHTML(volumeArrow)}</div>
        <small>THIS WEEK&nbsp;&nbsp; VS LAST WEEK</small>
      </div>
    </div>
  `;
}

function renderWeeklyBarChart(items, valueKey, unit, emptyText) {
  const maxValue = Math.max(
    ...items.map(item => Number(item[valueKey] || 0)),
    0
  );

  if (maxValue <= 0) {
    return `
      <div class="weekly-chart-empty">${escapeHTML(emptyText)}</div>
    `;
  }

  return `
    <div class="weekly-chart">
      ${items.map(item => {
        const value = Number(item[valueKey] || 0);
        const height = Math.max(
          value > 0 ? 8 : 0,
          Math.round((value / maxValue) * 100)
        );

        return `
          <div class="weekly-chart-column">
            <div class="weekly-chart-value">
              ${value > 0 ? escapeHTML(formatStatNumber(value)) : ''}
            </div>
            <div class="weekly-chart-track">
              <div
                class="weekly-chart-bar"
                style="height:${height}%"
                title="${escapeHTML(item.label)}: ${escapeHTML(formatStatNumber(value))}${escapeHTML(unit)}"
              ></div>
            </div>
            <span class="weekly-chart-label">
              ${escapeHTML(item.label)}
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function closeQuickStatsDetail() {
  document.getElementById('quickStatsDetailModal')?.remove();
}

async function openQuickStatsDetail() {
  try {
    const stats = await calculateQuickStatsDetail();
    const body = stats.latestBody;

    const recentHTML = stats.recent.length
      ? stats.recent.map(workout => {
          const date = new Date(workout.completedAt || workout.date);
          const dateText = Number.isNaN(date.getTime())
            ? '--'
            : date.toLocaleDateString('ja-JP', {
                month: '2-digit',
                day: '2-digit'
              });

          return `
            <div class="quick-detail-row">
              <span>${escapeHTML(dateText)}</span>
              <strong>${escapeHTML(workout.name || 'WORKOUT')}</strong>
            </div>
          `;
        }).join('')
      : `
          <div class="quick-detail-empty">
            まだ完了したトレーニングがありません。
          </div>
        `;

    const detailHTML = `
      <div class="modal quick-stats-detail-modal" id="quickStatsDetailModal">
        <div class="modal-backdrop" data-close-quick-stats="true"></div>

        <div class="modal-card quick-stats-detail-card">
          <div class="modal-header">
            <div>
              <span class="eyebrow">PERFORMANCE</span>
              <h3>QUICK STATS</h3>
              <small>トレーニングの詳細ステータス</small>
            </div>

            <button type="button" id="closeQuickStatsDetail" aria-label="閉じる">×</button>
          </div>

          <div class="quick-detail-grid">
            <div class="quick-detail-stat">
              <span>🔥</span>
              <strong>${formatStatNumber(stats.streak)}</strong>
              <small>DAY STREAK</small>
            </div>
            <div class="quick-detail-stat">
              <span>🏋️</span>
              <strong>${formatStatNumber(stats.volume)}</strong>
              <small>KG VOLUME</small>
            </div>
            <div class="quick-detail-stat">
              <span>🏆</span>
              <strong>${formatStatNumber(stats.personalRecords)}</strong>
              <small>PERSONAL RECORDS</small>
            </div>
            <div class="quick-detail-stat">
              <span>📅</span>
              <strong>${formatStatNumber(stats.workouts)}</strong>
              <small>WORKOUTS</small>
            </div>
          </div>

          <div class="quick-detail-section">
            <div class="quick-detail-section-title">TRAINING TOTALS</div>
            <div class="quick-detail-row">
              <span>TOTAL SETS</span>
              <strong>${formatStatNumber(stats.sets)}</strong>
            </div>
            <div class="quick-detail-row">
              <span>AVERAGE VOLUME / WORKOUT</span>
              <strong>${formatStatNumber(stats.workouts ? stats.volume / stats.workouts : 0)} kg</strong>
            </div>
          </div>

          <div class="quick-detail-section weekly-performance-section">
            <div class="quick-detail-section-title">LAST 7 DAYS · WORKOUTS</div>
            ${renderWeeklyBarChart(
              stats.weeklyActivity,
              'workouts',
              '',
              '過去7日間のトレーニング記録はありません。'
            )}
          </div>

          <div class="quick-detail-section weekly-performance-section">
            <div class="quick-detail-section-title">LAST 7 DAYS · VOLUME</div>
            ${renderWeeklyBarChart(
              stats.weeklyActivity,
              'volume',
              ' kg',
              '過去7日間のボリューム記録はありません。'
            )}
          </div>

          <div class="quick-detail-section weekly-comparison-section">
            <div class="quick-detail-section-title">WEEKLY COMPARISON · THIS WEEK VS LAST WEEK</div>
            ${renderWeeklyComparison(stats)}
          </div>

          <div class="quick-detail-section">
            <div class="quick-detail-section-title">LATEST BODY DATA</div>
            <div class="quick-detail-row">
              <span>BODY WEIGHT</span>
              <strong>${body?.weight ?? '--'}${body?.weight != null ? ' kg' : ''}</strong>
            </div>
            <div class="quick-detail-row">
              <span>BODY FAT</span>
              <strong>${body?.bodyFat ?? '--'}${body?.bodyFat != null ? ' %' : ''}</strong>
            </div>
            <div class="quick-detail-row">
              <span>MUSCLE MASS</span>
              <strong>${body?.muscleMass ?? '--'}${body?.muscleMass != null ? ' kg' : ''}</strong>
            </div>
          </div>

          <div class="quick-detail-section">
            <div class="quick-detail-section-title">RECENT WORKOUTS</div>
            ${recentHTML}
          </div>
        </div>
      </div>
    `;

    closeQuickStatsDetail();
    document.body.insertAdjacentHTML('beforeend', detailHTML);

    document
      .getElementById('closeQuickStatsDetail')
      ?.addEventListener('click', closeQuickStatsDetail);

    document
      .querySelector('[data-close-quick-stats="true"]')
      ?.addEventListener('click', closeQuickStatsDetail);

    if (!document.getElementById('quickStatsDetailStyle')) {
      const style = document.createElement('style');
      style.id = 'quickStatsDetailStyle';
      style.textContent = `
        .stats-grid.quick-stats-clickable {
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .stats-grid.quick-stats-clickable .stat-card {
          transition: transform .16s ease, filter .16s ease;
        }
        .stats-grid.quick-stats-clickable:active .stat-card {
          transform: scale(.985);
          filter: brightness(1.08);
        }
        .quick-stats-detail-modal {
          z-index: 10000;
        }
        .quick-stats-detail-card {
          width: min(92vw, 520px);
          max-height: min(82vh, 760px);
          overflow-y: auto;
        }
        .quick-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 16px 0;
        }
        .quick-detail-stat {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          padding: 14px 12px;
          background: rgba(255,255,255,.035);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .quick-detail-stat span {
          font-size: 1.05rem;
        }
        .quick-detail-stat strong {
          font-size: 1.45rem;
          line-height: 1.1;
        }
        .quick-detail-stat small {
          opacity: .62;
          font-size: .68rem;
          letter-spacing: .08em;
        }
        .quick-detail-section {
          margin-top: 16px;
          border-top: 1px solid rgba(255,255,255,.08);
          padding-top: 12px;
        }
        .quick-detail-section-title {
          font-size: .68rem;
          letter-spacing: .12em;
          opacity: .58;
          margin-bottom: 6px;
        }
        .quick-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,.055);
        }
        .quick-detail-row:last-child {
          border-bottom: 0;
        }
        .quick-detail-row span {
          opacity: .68;
          font-size: .75rem;
        }
        .quick-detail-row strong {
          text-align: right;
          font-size: .88rem;
        }
        .quick-detail-empty {
          padding: 12px 0;
          opacity: .58;
          font-size: .8rem;
        }
        .weekly-performance-section {
          overflow: hidden;
        }
        .weekly-chart {
          height: 168px;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          align-items: end;
          padding: 8px 2px 0;
        }
        .weekly-chart-column {
          min-width: 0;
          height: 100%;
          display: grid;
          grid-template-rows: 22px 1fr 22px;
          align-items: end;
          text-align: center;
        }
        .weekly-chart-value {
          min-height: 22px;
          font-size: .62rem;
          opacity: .72;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .weekly-chart-track {
          height: 100%;
          min-height: 92px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,.09);
        }
        .weekly-chart-bar {
          width: min(22px, 72%);
          min-height: 0;
          border-radius: 6px 6px 2px 2px;
          background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.28));
          box-shadow: 0 0 12px rgba(255,255,255,.08);
          transition: height .35s ease;
        }
        .weekly-chart-label {
          display: block;
          padding-top: 5px;
          font-size: .62rem;
          opacity: .55;
          white-space: nowrap;
        }
        .weekly-chart-empty {
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          opacity: .55;
          font-size: .78rem;
          padding: 12px;
        }
        .quick-comparison-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .quick-comparison-card {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          padding: 12px;
          background: rgba(255,255,255,.035);
        }
        .quick-comparison-label {
          font-size: .68rem;
          letter-spacing: .06em;
          opacity: .62;
          margin-bottom: 8px;
        }
        .quick-comparison-values {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .quick-comparison-values strong {
          font-size: 1.05rem;
        }
        .quick-comparison-values span {
          font-size: .7rem;
          opacity: .55;
        }
        .quick-comparison-change {
          margin-top: 8px;
          font-size: .92rem;
          font-weight: 700;
        }
        .quick-comparison-card small {
          display: block;
          margin-top: 3px;
          font-size: .55rem;
          letter-spacing: .05em;
          opacity: .42;
        }
        @media (max-width: 380px) {
          .quick-comparison-grid {
            gap: 7px;
          }
          .quick-comparison-card {
            padding: 10px 9px;
          }
        }
        @media (max-width: 380px) {
          .quick-detail-grid {
            gap: 7px;
          }
          .quick-detail-stat {
            padding: 11px 9px;
          }
          .quick-detail-stat strong {
            font-size: 1.25rem;
          }
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error('Quick stats detail error:', error);
    alert('ステータスを読み込めませんでした。');
  }
}

function setupQuickStats() {
  const statsGrid = document.querySelector('.stats-grid');
  if (!statsGrid || statsGrid.dataset.quickStatsReady === 'true') return;

  statsGrid.dataset.quickStatsReady = 'true';
  statsGrid.classList.add('quick-stats-clickable');
  statsGrid.setAttribute('role', 'button');
  statsGrid.setAttribute('tabindex', '0');
  statsGrid.setAttribute('aria-label', 'クイックステータスの詳細を表示');

  statsGrid.addEventListener('click', openQuickStatsDetail);
  statsGrid.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openQuickStatsDetail();
    }
  });
}

/* =========================================================
   Exercise Screen Initialization
========================================================= */

async function initializeExerciseUI() {

  await renderExerciseDatabase(
    'all'
  );

  setupExerciseCardEvents();

  setupExerciseFilters();
}

/* =========================================================
   Final Initialization
========================================================= */

async function initializeIronCoreUI() {

  await initializeApp();

  setupNavigation();

  setupQuickStats();

  await initializeExerciseUI();

  setupWorkoutButtons();

  setupExerciseModal();

  setupRestTimer();

  setupBodyDataModal();

  await updateHomeStats();

  await renderWorkout();

  console.log(
    'IRON CORE UI initialized successfully.'
  );
}

/* =========================================================
   Start
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {
    initializeIronCoreUI();
  }
);
/* =========================================================
   REST TIMER
========================================================= */

let restTimerInterval = null;
let restTimerSeconds = 90;

/* -------------------------
   タイマー表示
------------------------- */

function updateRestTimerDisplay() {
  const display =
    document.getElementById('timerDisplay');

  if (!display) {
    return;
  }

  const minutes =
    Math.floor(restTimerSeconds / 60);

  const seconds =
    restTimerSeconds % 60;

  display.textContent =
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* -------------------------
   タイマー停止
------------------------- */

function stopRestTimer() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
}

/* -------------------------
   タイマー開始
------------------------- */

function startRestTimer() {
  stopRestTimer();

  updateRestTimerDisplay();

  restTimerInterval =
    setInterval(() => {

      restTimerSeconds--;

      if (restTimerSeconds <= 0) {
        restTimerSeconds = 0;

        updateRestTimerDisplay();

        stopRestTimer();

        // タイマー終了
        if (navigator.vibrate) {
          navigator.vibrate([300, 150, 300]);
        }

        return;
      }

      updateRestTimerDisplay();

    }, 1000);
}

/* -------------------------
   タイマーを開く
------------------------- */

function openRestTimer(
  seconds = 90
) {
  restTimerSeconds =
    Math.max(0, Number(seconds) || 90);

  const modal =
    document.getElementById(
      'restTimer'
    );

  if (!modal) {
    return;
  }

  modal.classList.remove('hidden');

  const status = document.getElementById('timerStatus');
  if (status) status.textContent = 'REST TIMER';

  updateRestTimerDisplay();
  startRestTimer();
}

/* -------------------------
   タイマーを閉じる
------------------------- */

function closeRestTimer() {
  stopRestTimer();

  const modal =
    document.getElementById(
      'restTimer'
    );

  modal?.classList.add(
    'hidden'
  );
}

/* -------------------------
   ＋30秒
------------------------- */

function addRestTime(seconds) {
  restTimerSeconds +=
    Number(seconds) || 0;

  updateRestTimerDisplay();
}

/* -------------------------
   −30秒
------------------------- */

function subtractRestTime(seconds) {
  restTimerSeconds =
    Math.max(
      0,
      restTimerSeconds -
        (Number(seconds) || 0)
    );

  updateRestTimerDisplay();

  if (restTimerSeconds <= 0) {
    stopRestTimer();
  }
}

/* =========================================================
   REST TIMER CONTROLS
========================================================= */

function setupRestTimer() {

  const modal =
    document.getElementById(
      'restTimer'
    );

  const minus =
    document.getElementById(
      'timerMinus'
    );

  const skip =
    document.getElementById(
      'timerSkip'
    );

  const plus =
    document.getElementById(
      'timerPlus'
    );

  if (!modal) {
    return;
  }

  /* −30 */
  minus?.addEventListener(
    'click',
    () => {
      subtractRestTime(30);
    }
  );

  /* SKIP */
  skip?.addEventListener(
    'click',
    () => {
      closeRestTimer();
    }
  );

  /* +30 */
  plus?.addEventListener(
    'click',
    () => {
      addRestTime(30);
    }
  );

  /* 背景タップで閉じる */
  modal
    .querySelector(
      '.modal-backdrop'
    )
    ?.addEventListener(
      'click',
      () => {
        closeRestTimer();
      }
    );

  updateRestTimerDisplay();
}

/* =========================================================
   REST TIMER API
========================================================= */

window.IronCoreRestTimer = {
  open: openRestTimer,
  close: closeRestTimer,
  start: startRestTimer,
  stop: stopRestTimer,
  addTime: addRestTime,
  subtractTime: subtractRestTime
};
