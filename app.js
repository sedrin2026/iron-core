document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. シーン・カメラ・レンダラーの設定
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 8.5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. ホログラム人体のグループを作成
  const humanGroup = new THREE.Group();

  // マテリアル（青く発光する網目）
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });

  // 強調表示用マテリアル（筋肉部分をより高密度・明るく）
  const muscleMaterial = new THREE.MeshBasicMaterial({
    color: 0x33f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.9
  });

  // 頭部
  const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
  headGeo.scale(0.85, 1.15, 0.9);
  const head = new THREE.Mesh(headGeo, wireMaterial);
  head.position.y = 2.1;
  humanGroup.add(head);

  // 胸部（厚い大胸筋）
  const chestGeo = new THREE.CylinderGeometry(0.72, 0.52, 0.9, 18, 6);
  chestGeo.scale(1.15, 1, 0.75);
  const chest = new THREE.Mesh(chestGeo, wireMaterial);
  chest.position.y = 1.25;
  humanGroup.add(chest);

  // 腹部（6パック）
  const absGeo = new THREE.CylinderGeometry(0.5, 0.45, 0.7, 16, 6);
  absGeo.scale(1.0, 1, 0.65);
  const abs = new THREE.Mesh(absGeo, wireMaterial);
  abs.position.y = 0.55;
  humanGroup.add(abs);

  // 骨盤
  const pelvisGeo = new THREE.CylinderGeometry(0.48, 0.4, 0.5, 16, 4);
  pelvisGeo.scale(1.05, 1, 0.7);
  const pelvis = new THREE.Mesh(pelvisGeo, wireMaterial);
  pelvis.position.y = 0.05;
  humanGroup.add(pelvis);

  // 【腕と肩の筋肉強化パーツ】（左右）
  [-1, 1].forEach(side => {
    // 1. 三角筋（肩のデカいメロン肩）
    const shoulderGeo = new THREE.SphereGeometry(0.36, 16, 16);
    shoulderGeo.scale(1.1, 1.2, 1.1);
    const shoulder = new THREE.Mesh(shoulderGeo, muscleMaterial);
    shoulder.position.set(side * 0.88, 1.5, 0);
    humanGroup.add(shoulder);

    // 2. 上腕骨ベース（腕の芯）
    const armGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.8, 12, 6);
    const arm = new THREE.Mesh(armGeo, wireMaterial);
    arm.position.set(side * 0.98, 0.95, 0);
    arm.rotation.z = side * -0.2;
    humanGroup.add(arm);

    // 3. 上腕二頭筋（力こぶの隆起）
    const bicepsGeo = new THREE.SphereGeometry(0.22, 14, 14);
    bicepsGeo.scale(0.85, 1.4, 0.95);
    const biceps = new THREE.Mesh(bicepsGeo, muscleMaterial);
    // 腕の前側に配置して力こぶを表現
    biceps.position.set(side * 0.96, 0.95, 0.12);
    biceps.rotation.z = side * -0.2;
    humanGroup.add(biceps);

    // 4. 前腕（肘から下のたくましい前腕筋肉群・腕橈骨筋）
    const foreArmGeo = new THREE.CylinderGeometry(0.24, 0.11, 0.85, 16, 8); // 上部を太く強調
    foreArmGeo.scale(1.1, 1.0, 0.9);
    const foreArm = new THREE.Mesh(foreArmGeo, muscleMaterial);
    foreArm.position.set(side * 1.2, 0.18, 0);
    foreArm.rotation.z = side * -0.15;
    humanGroup.add(foreArm);
  });

  // 両脚（左右）
  [-1, 1].forEach(side => {
    // 太もも（大腿四頭筋）
    const thighGeo = new THREE.CylinderGeometry(0.32, 0.22, 1.0, 16, 8);
    const thigh = new THREE.Mesh(thighGeo, wireMaterial);
    thigh.position.set(side * 0.32, -0.65, 0);
    thigh.rotation.z = side * -0.05;
    humanGroup.add(thigh);

    // すね・ふくらはぎ
    const calfGeo = new THREE.CylinderGeometry(0.21, 0.12, 1.1, 14, 8);
    const calf = new THREE.Mesh(calfGeo, wireMaterial);
    calf.position.set(side * 0.35, -1.65, 0);
    humanGroup.add(calf);
  });

  scene.add(humanGroup);

  // 3. 足元のSF円形グリッド台座
  const ringGeo1 = new THREE.RingGeometry(1.2, 1.23, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = -2.2;
  scene.add(ring1);

  const ringGeo2 = new THREE.RingGeometry(0.7, 0.72, 32);
  const ring2 = new THREE.Mesh(ringGeo2, ringMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = -2.2;
  scene.add(ring2);

  const gridHelper = new THREE.PolarGridHelper(1.8, 16, 8, 64, 0x00e5ff, 0x00e5ff);
  gridHelper.position.y = -2.21;
  gridHelper.material.opacity = 0.25;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // 4. アニメーション
  function animate() {
    requestAnimationFrame(animate);
    humanGroup.rotation.y += 0.005;
    ring1.rotation.z -= 0.003;
    ring2.rotation.z += 0.005;
    renderer.render(scene, camera);
  }
  animate();

  // リサイズ対応
  window.addEventListener('resize', () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
});
