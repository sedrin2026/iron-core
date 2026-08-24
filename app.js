
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

    const exercises =
      await getExercises();

    if (!exercises.length) {
      await loadExercises();
    }

    console.log(
      'IRON CORE initialized successfully.'
    );

    console.log(
      `Exercise database: ${
        (await getExercises()).length
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

async function renderWorkout() {
  const container =
    document.getElementById(
      'exerciseList'
    );

  if (!container) {
    return;
  }

  if (
    !currentWorkoutExercises.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        <div>🏋️</div>

        <strong>
          NO EXERCISES YET
        </strong>

        <span>
          ＋ ADD EXERCISE から種目を追加してください。
        </span>
      </div>
    `;

    return;
  }

  container.innerHTML =
    currentWorkoutExercises
      .map((exercise, index) => {

        const name =
          getExerciseName(exercise);

        return `
          <article
            class="exercise-card workout-exercise-card"
            data-workout-exercise-index="${index}"
          >

            <div class="exercise-card-main">

              <div class="exercise-card-title">
                ${escapeHTML(name)}
              </div>

              <div class="exercise-card-subtitle">
                SETS
              </div>

            </div>

            <div class="exercise-card-meta">
              ${index + 1}
            </div>

          </article>
        `;
      })
      .join('');
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

  await initializeExerciseUI();

  setupWorkoutButtons();

  setupExerciseModal();

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
