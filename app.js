
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
  const response = await fetch('./data/exercises.json');

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

document.addEventListener(
  'DOMContentLoaded',
  initializeApp
);
