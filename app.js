
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

        // 今回のセットを追加する前のPRを保存。
        // 追加後のPRと比較して「新記録」を判定します。
        const previousPR = await getExercisePR(exerciseId);

        await addSet({
          workoutId: currentWorkoutId,
          exerciseId,
          setNumber: exerciseSets.length + 1,
          weight,
          reps,
          completed: true
        });

        const currentPR = await getExercisePR(exerciseId);
        const prResult = detectNewPersonalRecord(
          previousPR,
          currentPR,
          weight,
          reps
        );

        weightInput.value = '';
        repsInput.value = '';

        await renderWorkout();

        if (prResult.isPR) {
          showPersonalRecordCelebration({
            exerciseId,
            weight,
            reps,
            result: prResult,
            pr: currentPR
          });
        }

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

    for (const set of sets) {
      if (!set.completed) continue;

      const setVolume = calculateSetVolume(set);
      totalSets++;
      totalVolume += setVolume;

      if (weeklyDay) weeklyDay.volume += setVolume;
      if (set.exerciseId) exerciseIds.add(set.exerciseId);
    }
  }

  let personalRecords = 0;
  const prList = [];
  for (const exerciseId of exerciseIds) {
    const pr = await getExercisePR(exerciseId);
    if (pr && Number(pr.maxWeight || 0) > 0) {
      personalRecords++;
      const exercise = await getExercise(exerciseId);
      prList.push({
        exerciseId,
        name: exercise ? getExerciseName(exercise) : 'WORKOUT EXERCISE',
        ...pr
      });
    }
  }

  prList.sort((a, b) => Number(b.estimated1RM || 0) - Number(a.estimated1RM || 0));

  const latestBody = bodyData[bodyData.length - 1] || null;
  const streak = calculateWorkoutStreak(workouts);

  return {
    workouts: completedWorkouts.length,
    streak,
    volume: totalVolume,
    sets: totalSets,
    personalRecords,
    prList,
    latestBody,
    recent: completedWorkouts.slice(0, 5),
    weeklyActivity
  };
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

function detectNewPersonalRecord(previousPR, currentPR, weight, reps) {
  const previousWeight = Number(previousPR?.maxWeight || 0);
  const previousReps = Number(previousPR?.maxReps || 0);
  const previous1RM = Number(previousPR?.estimated1RM || 0);

  const current1RM = calculate1RM(weight, reps);
  const weightPR = Number(weight) > previousWeight;
  const repsPR = Number(reps) > previousReps;
  const oneRMPR = current1RM > previous1RM;

  return {
    isPR: weightPR || repsPR || oneRMPR,
    weightPR,
    repsPR,
    oneRMPR,
    current1RM,
    previousWeight,
    previousReps,
    previous1RM
  };
}

async function openExerciseProgress(exerciseId) {
  const exercise = await getExercise(exerciseId);
  if (!exercise) {
    alert('種目データが見つかりません。');
    return;
  }

  const sets = (await getExerciseSets(exerciseId))
    .filter(set => set.completed && Number(set.weight) > 0 && Number(set.reps) > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  document.getElementById('exerciseProgressModal')?.remove();

  const name = getExerciseName(exercise);
  const pr = await getExercisePR(exerciseId);

  const pointsByDay = new Map();
  for (const set of sets) {
    const key = getLocalDateKey(set.createdAt);
    if (!key) continue;
    const current = pointsByDay.get(key) || {
      key,
      date: new Date(set.createdAt),
      weight: 0,
      oneRM: 0,
      volume: 0
    };
    current.weight = Math.max(current.weight, Number(set.weight) || 0);
    current.oneRM = Math.max(current.oneRM, calculate1RM(set.weight, set.reps));
    current.volume += calculateSetVolume(set);
    pointsByDay.set(key, current);
  }

  const points = [...pointsByDay.values()].sort((a,b) => a.date - b.date);
  const chart = (key, label, unit) => {
    if (!points.length) return `<div class="exercise-progress-empty">まだ記録がありません。</div>`;
    const max = Math.max(...points.map(p => Number(p[key] || 0)), 0);
    if (max <= 0) return `<div class="exercise-progress-empty">まだ記録がありません。</div>`;
    return `<div class="exercise-progress-chart">
      ${points.map(point => {
        const value = Number(point[key] || 0);
        const height = Math.max(value > 0 ? 8 : 0, Math.round(value / max * 100));
        return `<div class="exercise-progress-column">
          <span class="exercise-progress-value">${escapeHTML(formatStatNumber(value))}${escapeHTML(unit)}</span>
          <div class="exercise-progress-track"><div class="exercise-progress-bar" style="height:${height}%"></div></div>
          <span class="exercise-progress-label">${escapeHTML(`${point.date.getMonth()+1}/${point.date.getDate()}`)}</span>
        </div>`;
      }).join('')}
    </div>`;
  };

  const first = points[0];
  const latest = points[points.length - 1];
  const weightChange = latest && first ? Number(latest.weight) - Number(first.weight) : 0;
  const oneRMChange = latest && first ? Number(latest.oneRM) - Number(first.oneRM) : 0;

  const html = `
    <div class="modal exercise-progress-modal" id="exerciseProgressModal">
      <div class="modal-backdrop" data-close-exercise-progress="true"></div>
      <div class="modal-card exercise-progress-card">
        <div class="modal-header">
          <div>
            <span class="eyebrow">EXERCISE PROGRESS</span>
            <h3>${escapeHTML(name)}</h3>
            <small>種目別の成長推移</small>
          </div>
          <button type="button" id="closeExerciseProgress" aria-label="閉じる">×</button>
        </div>

        <div class="exercise-progress-summary">
          <div><small>BEST WEIGHT</small><strong>${escapeHTML(formatStatNumber(pr.maxWeight))} kg</strong></div>
          <div><small>BEST REPS</small><strong>${escapeHTML(formatStatNumber(pr.maxReps))}</strong></div>
          <div><small>BEST 1RM</small><strong>${escapeHTML(formatStatNumber(pr.estimated1RM))} kg</strong></div>
        </div>

        <div class="exercise-progress-change">
          <div><span>FIRST → LATEST</span><strong>${escapeHTML(formatStatNumber(first?.weight || 0))} → ${escapeHTML(formatStatNumber(latest?.weight || 0))} kg</strong><small>${weightChange >= 0 ? '+' : ''}${escapeHTML(formatStatNumber(weightChange))} kg</small></div>
          <div><span>EST. 1RM</span><strong>${escapeHTML(formatStatNumber(first?.oneRM || 0))} → ${escapeHTML(formatStatNumber(latest?.oneRM || 0))} kg</strong><small>${oneRMChange >= 0 ? '+' : ''}${escapeHTML(formatStatNumber(oneRMChange))} kg</small></div>
        </div>

        <div class="exercise-progress-section"><div class="quick-detail-section-title">WEIGHT PROGRESS</div>${chart('weight','WEIGHT',' kg')}</div>
        <div class="exercise-progress-section"><div class="quick-detail-section-title">EST. 1RM PROGRESS</div>${chart('oneRM','1RM',' kg')}</div>
        <div class="exercise-progress-section"><div class="quick-detail-section-title">VOLUME PROGRESS</div>${chart('volume','VOLUME',' kg')}</div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const close = () => document.getElementById('exerciseProgressModal')?.remove();
  document.getElementById('closeExerciseProgress')?.addEventListener('click', close);
  document.querySelector('[data-close-exercise-progress="true"]')?.addEventListener('click', close);

  if (!document.getElementById('exerciseProgressStyle')) {
    const style = document.createElement('style');
    style.id = 'exerciseProgressStyle';
    style.textContent = `
      .exercise-progress-modal{z-index:11500}.exercise-progress-card{width:min(94vw,560px);max-height:min(84vh,820px);overflow-y:auto}
      .exercise-progress-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:16px 0}.exercise-progress-summary>div{padding:11px 6px;border-radius:11px;background:rgba(255,255,255,.035);text-align:center}.exercise-progress-summary small{display:block;opacity:.55;font-size:.55rem;letter-spacing:.06em}.exercise-progress-summary strong{display:block;margin-top:4px;font-size:.82rem}
      .exercise-progress-change{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.exercise-progress-change>div{padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:11px}.exercise-progress-change span,.exercise-progress-change small{display:block;opacity:.55;font-size:.58rem;letter-spacing:.06em}.exercise-progress-change strong{display:block;margin:5px 0;font-size:.78rem}.exercise-progress-section{margin-top:17px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.exercise-progress-chart{height:155px;display:grid;grid-template-columns:repeat(${Math.max(points.length,1)},minmax(24px,1fr));gap:5px;align-items:end;overflow-x:auto;padding-top:7px}.exercise-progress-column{min-width:24px;height:100%;display:grid;grid-template-rows:22px 1fr 22px;align-items:end;text-align:center}.exercise-progress-value{font-size:.54rem;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.exercise-progress-track{height:100%;min-height:80px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid rgba(255,255,255,.09)}.exercise-progress-bar{width:min(20px,70%);border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.28))}.exercise-progress-label{font-size:.56rem;opacity:.5;padding-top:4px}.exercise-progress-empty{min-height:100px;display:flex;align-items:center;justify-content:center;opacity:.55;font-size:.76rem}@media(max-width:380px){.exercise-progress-change{grid-template-columns:1fr}.exercise-progress-summary strong{font-size:.74rem}}
    `;
    document.head.appendChild(style);
  }
}

function showPersonalRecordCelebration({ exerciseId, weight, reps, result, pr }) {
  document.getElementById('personalRecordModal')?.remove();

  const exerciseName = getExerciseNameByIdSync(exerciseId);
  const badges = [];

  if (result.weightPR) badges.push('WEIGHT PR');
  if (result.repsPR) badges.push('REPS PR');
  if (result.oneRMPR) badges.push('1RM PR');

  const modalHTML = `
    <div class="modal personal-record-modal" id="personalRecordModal">
      <div class="modal-backdrop" data-close-pr="true"></div>
      <div class="modal-card personal-record-card">
        <div class="pr-trophy">🏆</div>
        <span class="eyebrow">NEW PERSONAL RECORD</span>
        <h3>${escapeHTML(exerciseName)}</h3>
        <div class="pr-main-value">${escapeHTML(formatStatNumber(weight))} kg × ${escapeHTML(formatStatNumber(reps))}</div>
        <div class="pr-sub-value">Estimated 1RM: ${escapeHTML(formatStatNumber(result.current1RM))} kg</div>
        <div class="pr-badge-list">
          ${badges.map(badge => `<span class="pr-badge">${escapeHTML(badge)}</span>`).join('')}
        </div>
        <div class="pr-best-grid">
          <div><small>BEST WEIGHT</small><strong>${escapeHTML(formatStatNumber(pr.maxWeight))} kg</strong></div>
          <div><small>BEST REPS</small><strong>${escapeHTML(formatStatNumber(pr.maxReps))}</strong></div>
          <div><small>BEST 1RM</small><strong>${escapeHTML(formatStatNumber(pr.estimated1RM))} kg</strong></div>
        </div>
        <button type="button" class="primary-button" id="closePersonalRecord">CONTINUE</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const close = () => {
    document.getElementById('personalRecordModal')?.remove();
  };

  document.getElementById('closePersonalRecord')?.addEventListener('click', close);
  document.querySelector('[data-close-pr="true"]')?.addEventListener('click', close);

  if (!document.getElementById('personalRecordStyle')) {
    const style = document.createElement('style');
    style.id = 'personalRecordStyle';
    style.textContent = `
      .personal-record-modal { z-index: 11000; }
      .personal-record-card { width: min(88vw, 430px); text-align: center; padding: 28px 20px 22px; }
      .pr-trophy { font-size: 3rem; margin-bottom: 8px; animation: prPop .45s ease-out; }
      .personal-record-card h3 { margin: 6px 0 10px; font-size: 1.3rem; }
      .pr-main-value { font-size: 1.7rem; font-weight: 800; letter-spacing: .01em; }
      .pr-sub-value { margin-top: 6px; opacity: .62; font-size: .78rem; }
      .pr-badge-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; margin: 18px 0; }
      .pr-badge { padding: 6px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); font-size: .64rem; letter-spacing: .08em; }
      .pr-best-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin: 12px 0 18px; }
      .pr-best-grid > div { padding: 10px 5px; border-radius: 10px; background: rgba(255,255,255,.035); }
      .pr-best-grid small { display: block; opacity: .55; font-size: .55rem; letter-spacing: .06em; }
      .pr-best-grid strong { display: block; margin-top: 4px; font-size: .82rem; }
      @keyframes prPop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
    `;
    document.head.appendChild(style);
  }
}

function getExerciseNameByIdSync(exerciseId) {
  const exercise = currentWorkoutExercises.find(
    item => item.id === exerciseId
  );

  return exercise
    ? getExerciseName(exercise)
    : 'WORKOUT EXERCISE';
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

          <div class="quick-detail-section">
            <div class="quick-detail-section-title">PERSONAL RECORDS</div>
            ${stats.prList.length ? stats.prList.slice(0, 6).map(pr => `
              <button type="button" class="quick-detail-row pr-summary-row pr-progress-button" data-progress-exercise-id="${escapeHTML(pr.exerciseId)}">
                <span>${escapeHTML(pr.name)}</span>
                <strong>${escapeHTML(formatStatNumber(pr.maxWeight))} kg × ${escapeHTML(formatStatNumber(pr.maxReps))}<br><small>1RM ${escapeHTML(formatStatNumber(pr.estimated1RM))} kg · VIEW PROGRESS</small></strong>
              </button>
            `).join('') : `
              <div class="quick-detail-empty">まだ自己ベストの記録がありません。</div>
            `}
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

    document.querySelectorAll('[data-progress-exercise-id]').forEach(button => {
      button.addEventListener('click', () => {
        openExerciseProgress(button.dataset.progressExerciseId);
      });
    });

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
        .pr-summary-row {
          width: 100%;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,.055);
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }
        .pr-summary-row:active {
          opacity: .72;
        }
        .pr-summary-row strong small {
          opacity: .58;
          font-size: .65rem;
          font-weight: 500;
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
   AI COACH / PERSONAL COACH
   Record-based adaptive coaching. No external API required.
   Uses workout, PR, body and user goal settings to generate
   practical general guidance.
========================================================= */

const COACH_DEFAULTS = {
  goal: 'muscle',
  sex: 'male',
  age: 30,
  height: 170,
  activity: 1.55,
  proteinPerKg: 1.6
};

function coachGoalLabel(goal) {
  return ({
    muscle: '筋肉を増やす',
    strength: '筋力を伸ばす',
    fatloss: '体脂肪を落とす',
    maintain: '現状維持'
  })[goal] || '筋肉を増やす';
}

function coachActivityLabel(value) {
  const v = Number(value);
  if (v >= 1.725) return '高活動';
  if (v >= 1.55) return '中活動';
  if (v >= 1.375) return '軽活動';
  return '低活動';
}

async function getCoachSettings() {
  const saved = await getSetting('aiCoachProfile', {});
  return { ...COACH_DEFAULTS, ...(saved || {}) };
}

async function saveCoachSettings(settings) {
  return setSetting('aiCoachProfile', settings);
}

function calculateCoachCalories(weight, profile) {
  const w = Number(weight);
  const age = Number(profile.age) || 30;
  const height = Number(profile.height) || 170;
  const sex = profile.sex === 'female' ? -161 : 5;
  const bmr = 10 * w + 6.25 * height - 5 * age + sex;
  const tdee = bmr * Number(profile.activity || 1.55);

  if (profile.goal === 'muscle') return Math.round(tdee * 1.08);
  if (profile.goal === 'fatloss') return Math.round(tdee * 0.90);
  return Math.round(tdee);
}

function calculateCoachProtein(weight, profile) {
  const factor =
    profile.goal === 'muscle' ? 1.8 :
    profile.goal === 'strength' ? 1.7 :
    profile.goal === 'fatloss' ? 1.8 : 1.6;
  return Math.round(Number(weight) * factor);
}

function getCoachTargetFromPR(pr) {
  if (!pr || !Number(pr.maxWeight)) return null;
  const currentWeight = Number(pr.maxWeight);
  const currentReps = Number(pr.maxReps) || 0;
  const increment = currentWeight < 50 ? 2.5 : 5;
  const nextWeight = round(currentWeight + increment, 1);
  const nextReps = currentReps >= 8 ? 5 : Math.max(5, currentReps + 1);
  return { nextWeight, nextReps, currentWeight, currentReps };
}

async function calculateAICoach() {
  const [workouts, bodyData, profile] = await Promise.all([
    getWorkouts(),
    getBodyData(),
    getCoachSettings()
  ]);

  const completed = workouts
    .filter(w => w.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date));

  const now = new Date();
  const start7 = new Date(now);
  start7.setHours(0, 0, 0, 0);
  start7.setDate(start7.getDate() - 6);
  const start14 = new Date(start7);
  start14.setDate(start14.getDate() - 7);

  const thisWeek = completed.filter(w => new Date(w.completedAt || w.date) >= start7);
  const previousWeek = completed.filter(w => {
    const d = new Date(w.completedAt || w.date);
    return d >= start14 && d < start7;
  });

  let thisVolume = 0;
  for (const workout of thisWeek) {
    const sets = await getWorkoutSets(workout.id);
    thisVolume += sets.filter(s => s.completed).reduce((sum, s) => sum + calculateSetVolume(s), 0);
  }

  let previousVolume = 0;
  for (const workout of previousWeek) {
    const sets = await getWorkoutSets(workout.id);
    previousVolume += sets.filter(s => s.completed).reduce((sum, s) => sum + calculateSetVolume(s), 0);
  }

  const exerciseIds = new Set();
  for (const workout of completed.slice(0, 12)) {
    const sets = await getWorkoutSets(workout.id);
    sets.filter(s => s.completed && s.exerciseId).forEach(s => exerciseIds.add(s.exerciseId));
  }

  let bestExercise = null;
  let bestPR = null;
  for (const exerciseId of exerciseIds) {
    const pr = await getExercisePR(exerciseId);
    if (!pr || !pr.maxWeight) continue;
    if (!bestPR || Number(pr.estimated1RM) > Number(bestPR.estimated1RM)) {
      bestPR = pr;
      bestExercise = await getExercise(exerciseId);
    }
  }

  const latestBody = bodyData[bodyData.length - 1] || null;
  const weight = Number(latestBody?.weight || 0);
  const protein = weight ? calculateCoachProtein(weight, profile) : null;
  const calories = weight ? calculateCoachCalories(weight, profile) : null;
  const volumeChange = previousVolume > 0 ? ((thisVolume - previousVolume) / previousVolume) * 100 : null;

  let insight = 'まずはトレーニング記録を続けましょう。記録が増えるほど、コーチの提案があなた向けになります。';
  if (thisWeek.length >= 4 && volumeChange !== null && volumeChange > 20) {
    insight = '今週はトレーニング量が大きく増えています。重量を急いで上げるより、フォームと回復を優先しましょう。';
  } else if (thisWeek.length === 0) {
    insight = '今週のトレーニング記録がまだありません。まず1回、無理のない強度で始めましょう。';
  } else if (bestPR) {
    insight = `${getExerciseName(bestExercise)} の自己ベストを基準に、次回は小さな重量アップを狙うのがおすすめです。`;
  }

  const target = getCoachTargetFromPR(bestPR);

  return {
    profile,
    completed,
    thisWeekCount: thisWeek.length,
    previousWeekCount: previousWeek.length,
    thisVolume: round(thisVolume, 1),
    previousVolume: round(previousVolume, 1),
    volumeChange,
    latestBody,
    protein,
    calories,
    bestExercise,
    bestPR,
    target,
    insight,
    goalLabel: coachGoalLabel(profile.goal),
    activityLabel: coachActivityLabel(profile.activity)
  };
}

function openAICoachSettings() {
  getCoachSettings().then(profile => {
    const html = `
      <div class="modal ai-coach-modal" id="aiCoachSettingsModal">
        <div class="modal-backdrop" data-close-coach="true"></div>
        <div class="modal-card ai-coach-card">
          <div class="modal-header">
            <div><span class="eyebrow">AI COACH</span><h3>COACH PROFILE</h3><small>目標に合わせて提案を調整します</small></div>
            <button type="button" id="closeAICoachSettings">×</button>
          </div>
          <label class="coach-field">GOAL
            <select id="coachGoal">
              <option value="muscle" ${profile.goal === 'muscle' ? 'selected' : ''}>筋肉を増やす</option>
              <option value="strength" ${profile.goal === 'strength' ? 'selected' : ''}>筋力を伸ばす</option>
              <option value="fatloss" ${profile.goal === 'fatloss' ? 'selected' : ''}>体脂肪を落とす</option>
              <option value="maintain" ${profile.goal === 'maintain' ? 'selected' : ''}>現状維持</option>
            </select>
          </label>
          <div class="coach-two-col">
            <label class="coach-field">AGE<input id="coachAge" type="number" min="13" max="100" value="${escapeHTML(profile.age)}"></label>
            <label class="coach-field">HEIGHT (cm)<input id="coachHeight" type="number" min="100" max="250" value="${escapeHTML(profile.height)}"></label>
          </div>
          <label class="coach-field">SEX
            <select id="coachSex">
              <option value="male" ${profile.sex === 'male' ? 'selected' : ''}>男性</option>
              <option value="female" ${profile.sex === 'female' ? 'selected' : ''}>女性</option>
            </select>
          </label>
          <label class="coach-field">ACTIVITY
            <select id="coachActivity">
              <option value="1.2" ${Number(profile.activity) === 1.2 ? 'selected' : ''}>低活動</option>
              <option value="1.375" ${Number(profile.activity) === 1.375 ? 'selected' : ''}>軽活動</option>
              <option value="1.55" ${Number(profile.activity) === 1.55 ? 'selected' : ''}>中活動</option>
              <option value="1.725" ${Number(profile.activity) === 1.725 ? 'selected' : ''}>高活動</option>
            </select>
          </label>
          <p class="coach-note">※ 栄養値は一般的な目安です。医療・治療目的の食事指示ではありません。</p>
          <button type="button" class="primary-button" id="saveAICoachSettings">SAVE COACH PROFILE</button>
        </div>
      </div>`;

    document.getElementById('aiCoachSettingsModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    const close = () => document.getElementById('aiCoachSettingsModal')?.remove();
    document.getElementById('closeAICoachSettings')?.addEventListener('click', close);
    document.querySelector('[data-close-coach="true"]')?.addEventListener('click', close);
    document.getElementById('saveAICoachSettings')?.addEventListener('click', async () => {
      await saveCoachSettings({
        goal: document.getElementById('coachGoal')?.value || 'muscle',
        age: Number(document.getElementById('coachAge')?.value || 30),
        height: Number(document.getElementById('coachHeight')?.value || 170),
        sex: document.getElementById('coachSex')?.value || 'male',
        activity: Number(document.getElementById('coachActivity')?.value || 1.55)
      });
      close();
      await renderAICoachCard();
    });
  });
}

async function renderAICoachCard() {
  const host = document.getElementById('aiCoachHost');
  if (!host) return;
  try {
    const coach = await calculateAICoach();
    const targetText = coach.target
      ? `${escapeHTML(getExerciseName(coach.bestExercise))} · ${formatStatNumber(coach.target.nextWeight)} kg × ${formatStatNumber(coach.target.nextReps)}`
      : 'まずトレーニングを1回記録しましょう';
    const proteinText = coach.protein ? `${formatStatNumber(coach.protein)} g / day` : '体重を入力すると計算';
    const calorieText = coach.calories ? `${formatStatNumber(coach.calories)} kcal / day` : '体重を入力すると計算';
    const changeText = coach.volumeChange === null ? '—' : `${coach.volumeChange >= 0 ? '+' : ''}${round(coach.volumeChange, 1)}%`;

    host.innerHTML = `
      <section class="ai-coach-card-home">
        <div class="ai-coach-head">
          <div><span class="eyebrow">PERSONAL COACH</span><h3>🤖 AI COACH</h3></div>
          <button type="button" class="coach-settings-button" id="openAICoachSettings">⚙</button>
        </div>
        <div class="coach-goal-pill">GOAL · ${escapeHTML(coach.goalLabel)}</div>
        <div class="coach-insight">${escapeHTML(coach.insight)}</div>
        <div class="coach-mini-grid">
          <div><small>🎯 NEXT GOAL</small><strong>${targetText}</strong></div>
          <div><small>📈 7D VOLUME</small><strong>${formatStatNumber(coach.thisVolume)} kg <em>${changeText}</em></strong></div>
          <div><small>🥩 PROTEIN TARGET</small><strong>${proteinText}</strong></div>
          <div><small>🍽️ CALORIE GUIDE</small><strong>${calorieText}</strong></div>
        </div>
        <button type="button" class="primary-button coach-open-button" id="openAICoachDetail">VIEW COACHING</button>
      </section>`;

    document.getElementById('openAICoachSettings')?.addEventListener('click', openAICoachSettings);
    document.getElementById('openAICoachDetail')?.addEventListener('click', openAICoachDetail);
  } catch (error) {
    console.error('AI Coach render error:', error);
  }
}

async function openAICoachDetail() {
  const coach = await calculateAICoach();
  const targetText = coach.target
    ? `${getExerciseName(coach.bestExercise)} ${formatStatNumber(coach.target.nextWeight)} kg × ${formatStatNumber(coach.target.nextReps)}`
    : 'トレーニングを記録すると次の目標を提案します';
  const latestWeight = coach.latestBody?.weight;

  const html = `
    <div class="modal ai-coach-modal" id="aiCoachDetailModal">
      <div class="modal-backdrop" data-close-coach-detail="true"></div>
      <div class="modal-card ai-coach-detail-card">
        <div class="modal-header">
          <div><span class="eyebrow">PERSONAL TRAINING INTELLIGENCE</span><h3>🤖 AI COACH</h3><small>${escapeHTML(coach.goalLabel)}</small></div>
          <button type="button" id="closeAICoachDetail">×</button>
        </div>
        <div class="coach-detail-hero"><span>💡 COACH'S INSIGHT</span><p>${escapeHTML(coach.insight)}</p></div>
        <div class="coach-detail-section"><div class="quick-detail-section-title">🎯 NEXT GOAL</div><div class="coach-big-goal">${escapeHTML(targetText)}</div><small>現在の自己ベストから、無理のない小さなステップを提案しています。</small></div>
        <div class="coach-detail-section"><div class="quick-detail-section-title">📊 TRAINING ANALYSIS</div><div class="quick-detail-row"><span>THIS 7 DAYS</span><strong>${formatStatNumber(coach.thisWeekCount)} workouts · ${formatStatNumber(coach.thisVolume)} kg</strong></div><div class="quick-detail-row"><span>PREVIOUS 7 DAYS</span><strong>${formatStatNumber(coach.previousWeekCount)} workouts · ${formatStatNumber(coach.previousVolume)} kg</strong></div><div class="quick-detail-row"><span>VOLUME CHANGE</span><strong>${coach.volumeChange === null ? '—' : `${coach.volumeChange >= 0 ? '+' : ''}${round(coach.volumeChange,1)}%`}</strong></div></div>
        <div class="coach-detail-section"><div class="quick-detail-section-title">🍽️ NUTRITION GUIDE</div><div class="quick-detail-row"><span>BODY WEIGHT</span><strong>${latestWeight ? `${escapeHTML(latestWeight)} kg` : '未登録'}</strong></div><div class="quick-detail-row"><span>PROTEIN TARGET</span><strong>${coach.protein ? `${formatStatNumber(coach.protein)} g / day` : '体重を登録'}</strong></div><div class="quick-detail-row"><span>CALORIE GUIDE</span><strong>${coach.calories ? `${formatStatNumber(coach.calories)} kcal / day` : '体重を登録'}</strong></div><p class="coach-note">これは一般的な目安です。疾患、服薬、妊娠・授乳、摂食障害など個別の医療条件がある場合は、医師・管理栄養士に相談してください。</p></div>
        <div class="coach-detail-section"><div class="quick-detail-section-title">🥤 PROTEIN CHECK</div><p class="coach-protein-copy">1日のタンパク質目安を、現在の体重と目標から設定しています。食事で不足する場合は、食品やプロテインなど複数の選択肢から補う考え方がおすすめです。</p></div>
        <button type="button" class="primary-button" id="coachDetailSettings">EDIT COACH PROFILE</button>
      </div>
    </div>`;

  document.getElementById('aiCoachDetailModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  const close = () => document.getElementById('aiCoachDetailModal')?.remove();
  document.getElementById('closeAICoachDetail')?.addEventListener('click', close);
  document.querySelector('[data-close-coach-detail="true"]')?.addEventListener('click', close);
  document.getElementById('coachDetailSettings')?.addEventListener('click', () => { close(); openAICoachSettings(); });
}

function setupAICoach() {
  const home = document.getElementById('homeScreen') || document.body;
  if (!document.getElementById('aiCoachHost')) {
    const host = document.createElement('div');
    host.id = 'aiCoachHost';
    host.className = 'ai-coach-host';
    const statsGrid = home.querySelector('.stats-grid');
    if (statsGrid) statsGrid.insertAdjacentElement('afterend', host);
    else home.prepend(host);
  }
  renderAICoachCard();

  if (!document.getElementById('aiCoachStyle')) {
    const style = document.createElement('style');
    style.id = 'aiCoachStyle';
    style.textContent = `
      .ai-coach-host{margin:14px 0}.ai-coach-card-home,.ai-coach-detail-card{background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
      .ai-coach-card-home{padding:16px}.ai-coach-head{display:flex;justify-content:space-between;align-items:center}.ai-coach-head h3{margin:2px 0;font-size:1.15rem}.coach-settings-button{border:0;background:rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;color:inherit}.coach-goal-pill{display:inline-block;margin:9px 0;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.07);font-size:.62rem;letter-spacing:.08em}.coach-insight{font-size:.82rem;line-height:1.65;opacity:.82;margin:6px 0 12px}.coach-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.coach-mini-grid>div{padding:10px;border-radius:12px;background:rgba(255,255,255,.035)}.coach-mini-grid small{display:block;font-size:.55rem;opacity:.55;letter-spacing:.06em}.coach-mini-grid strong{display:block;margin-top:4px;font-size:.78rem;line-height:1.4}.coach-mini-grid em{font-style:normal;opacity:.7;margin-left:4px}.coach-open-button{width:100%;margin-top:11px}.ai-coach-detail-card,.ai-coach-card{width:min(92vw,520px);max-height:min(84vh,780px);overflow:auto}.coach-detail-hero{padding:14px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:12px}.coach-detail-hero span{font-size:.62rem;letter-spacing:.08em;opacity:.6}.coach-detail-hero p{margin:7px 0 0;line-height:1.7;font-size:.86rem}.coach-detail-section{margin-top:14px}.coach-big-goal{font-size:1.25rem;font-weight:800;margin:7px 0}.coach-detail-section small{opacity:.55}.coach-note{font-size:.68rem;line-height:1.6;opacity:.55;margin:10px 0 0}.coach-protein-copy{font-size:.78rem;line-height:1.65;opacity:.75}.coach-field{display:block;font-size:.65rem;letter-spacing:.08em;opacity:.8;margin:12px 0}.coach-field input,.coach-field select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit}.coach-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    `;
    document.head.appendChild(style);
  }
}

/* =========================================================
   Final Initialization
========================================================= */

async function initializeIronCoreUI() {

  await initializeApp();

  setupNavigation();

  setupQuickStats();

  setupAICoach();

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
